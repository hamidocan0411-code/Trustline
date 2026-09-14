const fs = require('fs');
const path = require('path');

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function write(file, content) {
  const full = path.join(root, file);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content, 'utf8');
}

function replaceOnce(file, from, to, label) {
  const content = read(file);
  const index = content.indexOf(from);
  if (index === -1) {
    throw new Error(`Patch marker not found in ${file}: ${label}`);
  }
  if (content.indexOf(from, index + from.length) !== -1) {
    console.warn(`Warning: marker appears more than once in ${file}: ${label}`);
  }
  write(file, content.slice(0, index) + to + content.slice(index + from.length));
}

function replaceAll(file, from, to, label) {
  const content = read(file);
  if (!content.includes(from)) {
    throw new Error(`Patch marker not found in ${file}: ${label}`);
  }
  write(file, content.split(from).join(to));
}

const pharmacyPanel = String.raw`import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  Loader2,
  MapPin,
  Pill,
  Upload,
  X,
} from "lucide-react";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

import type {
  CourierType,
  Order,
  PricingConfig,
  UrgencyLevel,
  UserProfile,
} from "../types";
import { calculateOrderPrice, type PackageSize } from "../utils/pricing";
import { storage } from "../services/storage";
import { mapService } from "../services/mapService";
import { app } from "../services/firebase";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  pricing: PricingConfig;
  onOrderCreated: (order: Order) => void;
}

type DeliveryType = "Standart Teslimat" | "Acil Teslimat";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

export const PharmacyOrderPanel: React.FC<Props> = ({
  isOpen,
  onClose,
  currentUser,
  pricing,
  onOrderCreated,
}) => {
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacyAddress, setPharmacyAddress] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [deliveryNote, setDeliveryNote] = useState("");
  const [deliveryType, setDeliveryType] = useState<DeliveryType>("Standart Teslimat");
  const [prescriptionFile, setPrescriptionFile] = useState<File | null>(null);
  const [distanceKm, setDistanceKm] = useState(10);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [distanceError, setDistanceError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [uploadWarning, setUploadWarning] = useState("");
  const calculationRef = useRef(0);

  const courierType: CourierType = deliveryType === "Acil Teslimat" ? "Acil Kurye" : "Standart Kurye";
  const urgency: UrgencyLevel = deliveryType === "Acil Teslimat" ? "Acil" : "Normal";
  const packageSize: PackageSize = "Küçük";
  const price = calculateOrderPrice(distanceKm, courierType, pricing, packageSize).finalPrice;

  useEffect(() => {
    if (!isOpen) {
      setSuccessOrder(null);
      setErrorMsg("");
      setUploadWarning("");
      return;
    }

    setReceiverName(currentUser.name || "");
    setReceiverPhone(currentUser.phone || "");
  }, [isOpen, currentUser.name, currentUser.phone]);

  useEffect(() => {
    const pickup = pharmacyAddress.trim();
    const delivery = deliveryAddress.trim();

    if (pickup.length < 3 || delivery.length < 3) {
      setIsCalculatingDistance(false);
      setDistanceError("");
      return;
    }

    const requestId = ++calculationRef.current;
    const timer = window.setTimeout(() => {
      (async () => {
        try {
          setIsCalculatingDistance(true);
          setDistanceError("");

          const result = await mapService.calculateDistance(pickup, delivery);

          if (requestId !== calculationRef.current) return;

          if (result?.success && typeof result.distanceKm === "number" && result.distanceKm > 0) {
            setDistanceKm(Math.round(result.distanceKm * 10) / 10);
          } else {
            setDistanceError(result?.error || "Mesafe otomatik hesaplanamadı. Lütfen adresleri kontrol edin.");
          }
        } catch (error) {
          if (requestId !== calculationRef.current) return;
          setDistanceError(error instanceof Error ? error.message : "Mesafe hesaplanamadı.");
        } finally {
          if (requestId === calculationRef.current) setIsCalculatingDistance(false);
        }
      })();
    }, 700);

    return () => window.clearTimeout(timer);
  }, [pharmacyAddress, deliveryAddress]);

  const resetForm = () => {
    setPharmacyName("");
    setPharmacyAddress("");
    setProductName("");
    setProductDescription("");
    setQuantity(1);
    setDeliveryAddress("");
    setReceiverName(currentUser.name || "");
    setReceiverPhone(currentUser.phone || "");
    setDeliveryNote("");
    setDeliveryType("Standart Teslimat");
    setPrescriptionFile(null);
    setDistanceKm(10);
    setDistanceError("");
    setErrorMsg("");
    setUploadWarning("");
  };

  const handleFileChange = (file: File | null) => {
    setErrorMsg("");
    if (!file) {
      setPrescriptionFile(null);
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setErrorMsg("Reçete veya belge yalnızca PDF, JPG, PNG ya da WEBP olabilir.");
      setPrescriptionFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg("Reçete veya belge boyutu en fazla 10 MB olabilir.");
      setPrescriptionFile(null);
      return;
    }

    setPrescriptionFile(file);
  };

  const createOrder = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg("");
    setUploadWarning("");

    try {
      if (currentUser.role !== "customer" || !currentUser.id) {
        throw new Error("Bu işlem yalnızca müşteri hesabıyla yapılabilir.");
      }

      const safeCustomerPhone = typeof currentUser.phone === "string" ? currentUser.phone.trim() : "";
      const safeReceiverPhone = receiverPhone.trim();

      if (!pharmacyName.trim()) throw new Error("Lütfen eczane adını giriniz.");
      if (!pharmacyAddress.trim()) throw new Error("Lütfen eczane adresini giriniz.");
      if (!productName.trim()) throw new Error("Lütfen ürün/ilaç bilgisini giriniz.");
      if (!Number.isFinite(quantity) || quantity < 1) throw new Error("Ürün adedi en az 1 olmalıdır.");
      if (!deliveryAddress.trim()) throw new Error("Lütfen teslimat adresini giriniz.");
      if (!receiverName.trim()) throw new Error("Lütfen teslim alacak kişinin adını giriniz.");
      if (!safeReceiverPhone) throw new Error("Lütfen teslim alacak kişinin telefonunu giriniz.");
      if (!Number.isFinite(distanceKm) || distanceKm <= 0) throw new Error("Geçerli bir teslimat mesafesi hesaplanamadı.");

      const orderId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `pharmacy_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      const now = new Date().toISOString();

      const safeDescription = productDescription.trim();
      const safeDeliveryNote = deliveryNote.trim();
      const combinedNote = [safeDescription, safeDeliveryNote].filter(Boolean).join(" | ");

      const sanitizedFileName = prescriptionFile
        ? prescriptionFile.name.replace(/[^a-zA-Z0-9._-]/g, "_")
        : "";

      const prescriptionPath = prescriptionFile
        ? `pharmacy-prescriptions/${orderId}/${sanitizedFileName}`
        : "";

      const orderPayload: Order = {
        id: orderId,
        orderType: "pharmacy",
        customerId: currentUser.id,
        customerName: typeof currentUser.name === "string" ? currentUser.name.trim() : "Müşteri",
        customerPhone: safeCustomerPhone,
        courierId: null,
        pickupAddress: pharmacyAddress.trim(),
        deliveryAddress: deliveryAddress.trim(),
        packageType: "Diğer",
        packageCount: quantity,
        courierType,
        urgency,
        distanceKm,
        price,
        status: "Kurye Bekleniyor",
        note: combinedNote,
        estimatedDeliveryMinutes: deliveryType === "Acil Teslimat" ? 35 : 60,
        pharmacyName: pharmacyName.trim(),
        pharmacyAddress: pharmacyAddress.trim(),
        pharmacyProduct: productName.trim(),
        pharmacyProductDescription: safeDescription,
        pharmacyQuantity: quantity,
        pharmacyRecipientName: receiverName.trim(),
        pharmacyRecipientPhone: safeReceiverPhone,
        pharmacyDeliveryType: deliveryType,
        pharmacyPaymentMethod: "Nakit",
        ...(prescriptionFile
          ? {
              pharmacyPrescriptionPath: prescriptionPath,
              pharmacyPrescriptionFileName: sanitizedFileName,
            }
          : {}),
        createdAt: now,
        updatedAt: now,
      };

      const created = await storage.createOrder(orderPayload);

      if (prescriptionFile) {
        try {
          const firebaseStorage = getStorage(app);
          const fileRef = ref(firebaseStorage, prescriptionPath);
          await uploadBytes(fileRef, prescriptionFile, {
            contentType: prescriptionFile.type,
          });
          await getDownloadURL(fileRef);
        } catch (uploadError) {
          console.error("Eczane reçete/belge yükleme hatası:", uploadError);
          setUploadWarning("Siparişiniz oluşturuldu ancak reçete/belge yüklenemedi. Sipariş detayında dosya yolu kayıtlıdır.");
        }
      }

      setSuccessOrder(created);
      onOrderCreated(created);
    } catch (error) {
      console.error("Eczane siparişi oluşturma hatası:", error);
      setErrorMsg(error instanceof Error ? error.message : "Eczane siparişi oluşturulamadı.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg("");

    if (!currentUser.id) {
      setErrorMsg("Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın.");
      return;
    }

    if (currentUser.role !== "customer") {
      setErrorMsg("Bu işlem yalnızca müşteri hesabıyla yapılabilir.");
      return;
    }

    await createOrder();
  };

  if (!isOpen) return null;

  if (successOrder) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-[#303036] bg-[#19191E] shadow-2xl">
          <div className="border-b border-[#303036] bg-[#111116] p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-emerald-400">
                  <CheckCircle2 size={13} /> Oluşturuldu
                </div>
                <h2 className="text-xl font-black text-white">Eczane siparişiniz başarıyla oluşturuldu.</h2>
                <p className="mt-1 text-sm text-[#8F8F99]">Siparişiniz mevcut TrustLine Express operasyon akışına aktarıldı.</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-xl border border-[#303036] p-2 text-[#888] hover:text-white">
                <X size={18} />
              </button>
            </div>
          </div>
          <div className="space-y-3 p-5">
            <div className="rounded-2xl border border-[#303036] bg-[#101014] p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-bold text-[#777780]">Sipariş numarası</span>
                <span className="break-all text-right font-mono text-xs font-black text-white">#{successOrder.id}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-[#D6A84F]/20 bg-[#D6A84F]/5 p-4 text-sm text-[#D0D0D5]">
              Ödeme yöntemi: <span className="font-black text-[#D6A84F]">Nakit</span>
            </div>
            {uploadWarning && <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-5 text-amber-200">{uploadWarning}</div>}
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-xl bg-[#D6A84F] py-3.5 text-sm font-black text-[#0B0B0D]"
            >
              Siparişlerime Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm">
      <div className="my-auto w-full max-w-3xl overflow-hidden rounded-3xl border border-[#303036] bg-[#19191E] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#303036] bg-[#111116]/95 p-5 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#D6A84F]/10 text-[#D6A84F]">
              <Pill size={21} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#D6A84F]">Eczane Siparişi</div>
              <h2 className="text-lg font-black text-white">Eczaneden ürün teslimatı oluştur</h2>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="rounded-xl border border-[#303036] p-2 text-[#888] hover:text-white disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#999999]">Eczane adı</span>
              <input value={pharmacyName} onChange={(e) => setPharmacyName(e.target.value)} className="w-full rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]" placeholder="Eczane adı" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#999999]">Eczane adresi</span>
              <input value={pharmacyAddress} onChange={(e) => setPharmacyAddress(e.target.value)} className="w-full rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]" placeholder="Ürünün alınacağı eczane adresi" />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#999999]">Ürün / ilaç</span>
              <input value={productName} onChange={(e) => setProductName(e.target.value)} className="w-full rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]" placeholder="Ürün veya ilaç adı" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#999999]">Adet</span>
              <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} className="w-full rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]" />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-wide text-[#999999]">Ürün açıklaması</span>
            <textarea value={productDescription} onChange={(e) => setProductDescription(e.target.value)} rows={3} className="w-full resize-none rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]" placeholder="Doz, kutu bilgisi veya ürünle ilgili teslimat notu" />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#999999]">Teslimat adresi</span>
              <input value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} className="w-full rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]" placeholder="Teslim edilecek adres" />
            </label>
            <div className="rounded-xl border border-[#303036] bg-[#101014] px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#999999]"><MapPin size={14} className="text-[#D6A84F]" /> Mesafe</div>
              <div className="mt-1 text-lg font-black text-white">{isCalculatingDistance ? "Hesaplanıyor..." : `${distanceKm} km`}</div>
              {distanceError && <p className="mt-1 text-[11px] text-red-300">{distanceError}</p>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#999999]">Teslim alacak kişi</span>
              <input value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className="w-full rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]" />
            </label>
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#999999]">Telefon</span>
              <input value={receiverPhone} onChange={(e) => setReceiverPhone(e.target.value)} className="w-full rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]" inputMode="tel" />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-wide text-[#999999]">Teslimat türü</div>
              <div className="grid grid-cols-2 gap-2">
                {(["Standart Teslimat", "Acil Teslimat"] as DeliveryType[]).map((type) => (
                  <button key={type} type="button" onClick={() => setDeliveryType(type)} className={`rounded-xl border px-3 py-3 text-xs font-black transition ${deliveryType === type ? "border-[#D6A84F] bg-[#D6A84F]/10 text-[#D6A84F]" : "border-[#303036] bg-[#101014] text-[#999999]"}`}>
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-[#D6A84F]/20 bg-[#D6A84F]/5 p-4">
              <div className="text-xs font-black uppercase tracking-wide text-[#999999]">Tahmini ücret</div>
              <div className="mt-1 text-2xl font-black text-[#D6A84F]">{new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(price)}</div>
              <div className="mt-1 text-[11px] text-[#777780]">Mevcut TrustLine Express fiyatlandırması kullanılır.</div>
            </div>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-wide text-[#999999]">Teslimat notu</span>
            <textarea value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)} rows={3} className="w-full resize-none rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]" placeholder="Kurye için özel teslimat talimatı" />
          </label>

          <div className="rounded-2xl border border-[#303036] bg-[#101014] p-4">
            <div className="flex items-center gap-2 text-sm font-black text-white"><FileText size={16} className="text-[#D6A84F]" /> Reçete / gerekli belge</div>
            <p className="mt-1 text-xs text-[#777780]">PDF, JPG, PNG veya WEBP • Maksimum 10 MB • İsteğe bağlı</p>
            <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#3A3A43] bg-[#17171C] px-4 py-3 text-xs font-bold text-[#B7B7C0] hover:border-[#D6A84F]/60 hover:text-white">
              <Upload size={15} />
              <span>{prescriptionFile ? prescriptionFile.name : "Belge seç"}</span>
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFileChange(e.target.files?.[0] || null)} />
            </label>
          </div>

          <div className="rounded-2xl border border-[#D6A84F]/20 bg-[#D6A84F]/5 p-4 text-sm text-[#CFCFD5]">
            Bu sürümde ödeme yöntemi <span className="font-black text-[#D6A84F]">nakit</span> olarak uygulanmaktadır.
          </div>

          {errorMsg && (
            <div className="flex gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200"><AlertCircle size={17} className="mt-0.5 shrink-0" />{errorMsg}</div>
          )}

          <button type="submit" disabled={isSubmitting} className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#D6A84F] px-6 text-sm font-black text-[#0B0B0D] disabled:cursor-not-allowed disabled:opacity-50">
            {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Sipariş oluşturuluyor...</> : "Eczane Siparişini Oluştur"}
          </button>
        </form>
      </div>
    </div>
  );
};
`;

write('src/components/PharmacyOrderPanel.tsx', pharmacyPanel);

replaceOnce(
  'src/types.ts',
  "export type UserRole = 'customer' | 'courier' | 'admin';",
  "export type UserRole = 'customer' | 'courier' | 'admin';\n\nexport type OrderType = 'standard' | 'pharmacy';",
  'OrderType type'
);

replaceOnce(
  'src/types.ts',
  "  id: string;\n  customerId: string;\n  customerName: string;\n  customerPhone: string;",
  "  id: string;\n  orderType?: OrderType;\n  customerId: string;\n  customerName: string;\n  customerPhone: string;",
  'OrderType in Order'
);

replaceOnce(
  'src/types.ts',
  "  estimatedDeliveryMinutes?: number;\n\n  deliveryProof?: DeliveryProof;",
  "  estimatedDeliveryMinutes?: number;\n\n  pharmacyName?: string;\n  pharmacyAddress?: string;\n  pharmacyProduct?: string;\n  pharmacyProductDescription?: string;\n  pharmacyQuantity?: number;\n  pharmacyRecipientName?: string;\n  pharmacyRecipientPhone?: string;\n  pharmacyDeliveryType?: 'Standart Teslimat' | 'Acil Teslimat';\n  pharmacyPaymentMethod?: 'Nakit';\n  pharmacyPrescriptionPath?: string;\n  pharmacyPrescriptionFileName?: string;\n\n  deliveryProof?: DeliveryProof;",
  'pharmacy fields'
);

replaceOnce(
  'src/components/NewOrderModal.tsx',
  "          id: generatedOrderId,\n\n          customerId:",
  "          id: generatedOrderId,\n\n          orderType: \"standard\",\n\n          customerId:",
  'standard orderType'
);

replaceOnce(
  'src/App.tsx',
  'import { NewOrderModal } from "./components/NewOrderModal";\n',
  'import { NewOrderModal } from "./components/NewOrderModal";\nimport { PharmacyOrderPanel } from "./components/PharmacyOrderPanel";\n',
  'pharmacy import'
);

replaceOnce(
  'src/App.tsx',
  '  const [isNewOrderOpen, setIsNewOrderOpen] =\n    useState(false);\n',
  '  const [isNewOrderOpen, setIsNewOrderOpen] =\n    useState(false);\n\n  const [isPharmacyOrderOpen, setIsPharmacyOrderOpen] =\n    useState(false);\n',
  'pharmacy modal state'
);

replaceOnce(
  'src/App.tsx',
  '  const handleOpenNewOrder = (\n    prefill?: Partial<Order>\n  ) => {\n    setNewOrderPrefill(\n      prefill\n    );\n\n    setIsNewOrderOpen(\n      true\n    );\n  };\n',
  '  const handleOpenNewOrder = (\n    prefill?: Partial<Order>\n  ) => {\n    setNewOrderPrefill(\n      prefill\n    );\n\n    setIsNewOrderOpen(\n      true\n    );\n  };\n\n  const handleOpenPharmacyOrder = () => {\n    if (currentUser?.role !== "customer") {\n      return;\n    }\n\n    setIsPharmacyOrderOpen(true);\n  };\n',
  'pharmacy open handler'
);

replaceOnce(
  'src/App.tsx',
  '                    onOpenNewOrder={\n                      handleOpenNewOrder\n                    }\n                    onOpenAI={() =>',
  '                    onOpenNewOrder={\n                      handleOpenNewOrder\n                    }\n                    onOpenPharmacyOrder={\n                      handleOpenPharmacyOrder\n                    }\n                    onOpenAI={() =>',
  'CustomerHome pharmacy prop'
);

replaceOnce(
  'src/App.tsx',
  '        onOrderCreated={(\n          order\n        ) => {\n          setActiveTab(\n            "orders"\n          );\n\n          setSelectedOrderId(\n            order.id\n          );\n        }}\n      />\n\n      <NotificationDrawer',
  '        onOrderCreated={(\n          order\n        ) => {\n          setActiveTab(\n            "orders"\n          );\n\n          setSelectedOrderId(\n            order.id\n          );\n        }}\n      />\n\n      <PharmacyOrderPanel\n        isOpen={isPharmacyOrderOpen}\n        onClose={() => setIsPharmacyOrderOpen(false)}\n        currentUser={currentUser}\n        pricing={pricing}\n        onOrderCreated={(order) => {\n          setIsPharmacyOrderOpen(false);\n          setActiveTab("orders");\n          setSelectedOrderId(order.id);\n        }}\n      />\n\n      <NotificationDrawer',
  'PharmacyOrderPanel render'
);

replaceOnce(
  'src/components/CustomerHome.tsx',
  '  Truck,\n  Zap,\n} from "lucide-react";',
  '  Truck,\n  Zap,\n  Pill,\n} from "lucide-react";',
  'Pill import'
);

replaceOnce(
  'src/components/CustomerHome.tsx',
  'interface Props {\n  onOpenNewOrder: (\n    prefill?: Partial<Order>\n  ) => void;',
  'interface Props {\n  onOpenNewOrder: (\n    prefill?: Partial<Order>\n  ) => void;\n  onOpenPharmacyOrder: () => void;',
  'CustomerHome prop'
);

replaceOnce(
  'src/components/CustomerHome.tsx',
  'export function CustomerHome({\n  onOpenNewOrder,\n  onOpenAI,',
  'export function CustomerHome({\n  onOpenNewOrder,\n  onOpenPharmacyOrder,\n  onOpenAI,',
  'CustomerHome destructuring'
);

replaceOnce(
  'src/components/CustomerHome.tsx',
  '                <button\n                  type="button"\n                  onClick={onOpenAI}\n                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#3A3A43] bg-white/[0.03] px-6 text-sm font-bold text-white transition hover:border-[#D6A84F]/40 hover:bg-white/[0.06]"\n                >\n                  <Bot\n                    size={18}\n                    className="text-[#D6A84F]"\n                  />\n\n                  Trustline AI\n                </button>',
  '                <button\n                  type="button"\n                  onClick={onOpenAI}\n                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#3A3A43] bg-white/[0.03] px-6 text-sm font-bold text-white transition hover:border-[#D6A84F]/40 hover:bg-white/[0.06]"\n                >\n                  <Bot\n                    size={18}\n                    className="text-[#D6A84F]"\n                  />\n\n                  Trustline AI\n                </button>\n\n                <button\n                  type="button"\n                  onClick={onOpenPharmacyOrder}\n                  className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-6 text-sm font-black text-emerald-300 transition hover:border-emerald-400/50 hover:bg-emerald-500/10"\n                >\n                  <Pill size={18} />\n                  Eczane Siparişi\n                </button>',
  'pharmacy home button'
);

replaceOnce(
  'src/components/AdminPanel.tsx',
  '  Order,\n  OrderStatus,\n  PricingConfig,',
  '  Order,\n  OrderStatus,\n  OrderType,\n  PricingConfig,',
  'OrderType import'
);

replaceOnce(
  'src/components/AdminPanel.tsx',
  '  const [statusFilter, setStatusFilter] =\n    useState<"Tümü" | OrderStatus>("Tümü");\n',
  '  const [statusFilter, setStatusFilter] =\n    useState<"Tümü" | OrderStatus>("Tümü");\n\n  const [orderTypeFilter, setOrderTypeFilter] =\n    useState<"all" | OrderType>("all");\n',
  'admin order type state'
);

replaceOnce(
  'src/components/AdminPanel.tsx',
  '          const matchesStatus =\n            statusFilter ===\n              "Tümü" ||\n            order.status ===\n              statusFilter;\n\n          return (\n            matchesSearch &&\n            matchesStatus\n          );',
  '          const matchesStatus =\n            statusFilter ===\n              "Tümü" ||\n            order.status ===\n              statusFilter;\n\n          const normalizedOrderType = order.orderType ?? "standard";\n          const matchesOrderType =\n            orderTypeFilter === "all" ||\n            normalizedOrderType === orderTypeFilter;\n\n          return (\n            matchesSearch &&\n            matchesStatus &&\n            matchesOrderType\n          );',
  'admin order type filter logic'
);

replaceOnce(
  'src/components/AdminPanel.tsx',
  '      safeOrders,\n      searchTerm,\n      statusFilter,\n    ]);',
  '      safeOrders,\n      searchTerm,\n      statusFilter,\n      orderTypeFilter,\n    ]);',
  'admin filter dependency'
);

replaceOnce(
  'src/components/AdminPanel.tsx',
  '              </select>\n            </div>\n\n            <div className="grid gap-3">',
  '              </select>\n\n              <div className="flex gap-2 md:flex-col lg:flex-row">\n                <button type="button" onClick={() => setOrderTypeFilter("all")} className={`rounded-xl border px-4 py-3 text-sm font-bold ${orderTypeFilter === "all" ? "border-[#D6A84F] bg-[#D6A84F]/10 text-[#D6A84F]" : "border-[#303036] bg-[#19191E] text-[#999999]"}`}>Tümü</button>\n                <button type="button" onClick={() => setOrderTypeFilter("standard")} className={`rounded-xl border px-4 py-3 text-sm font-bold ${orderTypeFilter === "standard" ? "border-[#D6A84F] bg-[#D6A84F]/10 text-[#D6A84F]" : "border-[#303036] bg-[#19191E] text-[#999999]"}`}>Normal Siparişler</button>\n                <button type="button" onClick={() => setOrderTypeFilter("pharmacy")} className={`rounded-xl border px-4 py-3 text-sm font-bold ${orderTypeFilter === "pharmacy" ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300" : "border-[#303036] bg-[#19191E] text-[#999999]"}`}>Eczane Siparişleri</button>\n              </div>\n            </div>\n\n            <div className="grid gap-3">',
  'admin order type controls'
);

replaceOnce(
  'src/components/AdminPanel.tsx',
  '                          <StatusBadge\n                            status={\n                              order.status\n                            }\n                          />',
  '                          <StatusBadge\n                            status={\n                              order.status\n                            }\n                          />\n\n                          {(order.orderType ?? "standard") === "pharmacy" ? (\n                            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[8px] font-black uppercase tracking-wide text-emerald-300">💊 ECZANE SİPARİŞİ</span>\n                          ) : (\n                            <span className="inline-flex items-center gap-1 rounded-full border border-[#303036] bg-[#101014] px-2 py-1 text-[8px] font-black uppercase tracking-wide text-[#8F8F99]">📦 NORMAL SİPARİŞ</span>\n                          )}',
  'admin order badge'
);

replaceOnce(
  'src/components/AdminPanel.tsx',
  '              {selectedOrder.deliveryProof && (',
  '              {selectedOrder.orderType === "pharmacy" && (\n                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">\n                  <div className="mb-3 flex items-center gap-2 text-sm font-black text-emerald-300">\n                    💊 Eczane Siparişi\n                  </div>\n                  <div className="grid gap-3 text-sm md:grid-cols-2">\n                    <div><span className="text-xs text-[#777780]">Eczane:</span><div className="mt-1 font-bold text-white">{selectedOrder.pharmacyName || "-"}</div></div>\n                    <div><span className="text-xs text-[#777780]">Ürün:</span><div className="mt-1 font-bold text-white">{selectedOrder.pharmacyProduct || "-"} × {selectedOrder.pharmacyQuantity || 0}</div></div>\n                    <div><span className="text-xs text-[#777780]">Teslim alan:</span><div className="mt-1 font-bold text-white">{selectedOrder.pharmacyRecipientName || selectedOrder.receiverName || "-"}</div></div>\n                    <div><span className="text-xs text-[#777780]">Telefon:</span><div className="mt-1 font-bold text-white">{selectedOrder.pharmacyRecipientPhone || selectedOrder.customerPhone || "-"}</div></div>\n                    <div className="md:col-span-2"><span className="text-xs text-[#777780]">Reçete / belge:</span><div className="mt-1 break-all font-mono text-xs text-[#C8C8D0]">{selectedOrder.pharmacyPrescriptionFileName || "Belge eklenmedi"}</div></div>\n                  </div>\n                </div>\n              )}\n\n              {selectedOrder.deliveryProof && (',
  'admin pharmacy details'
);

replaceOnce(
  'src/components/CourierPanel.tsx',
  '<span className="font-mono text-xs font-black text-white">#{order.id}</span>',
  '<span className="font-mono text-xs font-black text-white">#{order.id}</span>\n                          {order.orderType === "pharmacy" && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[8px] font-black text-emerald-300">💊 ECZANE</span>}',
  'courier pharmacy badge'
);

let storageRules = read('storage.rules');
const storageMarker = "    match /{allPaths=**} {";
if (!storageRules.includes('match /pharmacy-prescriptions/')) {
  storageRules = storageRules.replace(
    storageMarker,
    `    match /pharmacy-prescriptions/{orderId}/{fileName} {\n      allow read: if signedIn();\n\n      allow create, update:\n        if signedIn()\n        && request.resource.size <= 10 * 1024 * 1024\n        && (\n          request.resource.contentType.matches('image/.*')\n          || request.resource.contentType == 'application/pdf'\n        );\n\n      allow delete: if isAdmin();\n    }\n\n${storageMarker}`
  );
  write('storage.rules', storageRules);
}

console.log('Pharmacy module patch completed.');
console.log('Changed: types.ts, NewOrderModal.tsx, App.tsx, CustomerHome.tsx, AdminPanel.tsx, CourierPanel.tsx, storage.rules');
console.log('Created: src/components/PharmacyOrderPanel.tsx');
`;

write('scripts/add-pharmacy-order-module.cjs', patchScriptBody = String.raw`
${''}`);
