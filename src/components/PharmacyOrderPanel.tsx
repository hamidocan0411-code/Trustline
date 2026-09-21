import React, { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  MapPin,
  Phone,
  Pill,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { getStorage, ref, uploadBytes } from "firebase/storage";

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
import {
  pharmacyService,
  type NearbyPharmacy,
} from "../services/pharmacyService";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  pricing: PricingConfig;
  onOrderCreated: (order: Order) => void;
}

type DeliveryType = "Standart Teslimat" | "Acil Teslimat";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const PharmacyOrderPanel: React.FC<Props> = ({
  isOpen,
  onClose,
  currentUser,
  pricing,
  onOrderCreated,
}) => {
  const [pharmacyName, setPharmacyName] = useState("");
  const [pharmacyAddress, setPharmacyAddress] = useState("");
  const [nearbyPharmacies, setNearbyPharmacies] = useState<NearbyPharmacy[]>([]);
  const [selectedPharmacy, setSelectedPharmacy] = useState<NearbyPharmacy | null>(null);
  const [pharmacySearch, setPharmacySearch] = useState("");
  const [isLoadingPharmacies, setIsLoadingPharmacies] = useState(false);
  const [pharmacyLocationError, setPharmacyLocationError] = useState("");
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
  const [distanceError, setDistanceError] = useState("");
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [paymentAccepted, setPaymentAccepted] = useState(false);
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);
  const [uploadWarning, setUploadWarning] = useState("");
  const calculationRef = useRef(0);

  const courierType: CourierType =
    deliveryType === "Acil Teslimat" ? "Acil Kurye" : "Standart Kurye";
  const urgency: UrgencyLevel =
    deliveryType === "Acil Teslimat" ? "Acil" : "Normal";
  const packageSize: PackageSize = "Küçük";

  const price = calculateOrderPrice(
    distanceKm,
    courierType,
    pricing,
    packageSize
  ).finalPrice;

  const loadNearbyPharmacies = async () => {
    if (!navigator.geolocation) {
      setPharmacyLocationError(
        "Yakınınızdaki eczaneleri gösterebilmemiz için konum izni vermeniz gerekiyor."
      );
      return;
    }

    setIsLoadingPharmacies(true);
    setPharmacyLocationError("");

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const pharmacies = await pharmacyService.findNearbyPharmacies({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });

          setNearbyPharmacies(pharmacies);

          if (pharmacies.length === 0) {
            setPharmacyLocationError(
              "Konumunuza yakın bir eczane bulunamadı. Eczane adını ve adresini manuel olarak girebilirsiniz."
            );
          }
        } catch {
          setNearbyPharmacies([]);
          setPharmacyLocationError(
            "Yakındaki eczaneler yüklenemedi. Lütfen tekrar deneyin veya eczane bilgilerini manuel girin."
          );
        } finally {
          setIsLoadingPharmacies(false);
        }
      },
      () => {
        setNearbyPharmacies([]);
        setIsLoadingPharmacies(false);
        setPharmacyLocationError(
          "Yakınınızdaki eczaneleri gösterebilmemiz için konum izni vermeniz gerekiyor."
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  };

  const handleSelectPharmacy = (pharmacy: NearbyPharmacy) => {
    setSelectedPharmacy(pharmacy);
    setPharmacyName(pharmacy.name);
    setPharmacyAddress(pharmacy.address);
    setPharmacyLocationError("");
    setPharmacySearch("");
  };

  const handleChangePharmacy = () => {
    setSelectedPharmacy(null);
    setPharmacyName("");
    setPharmacyAddress("");
    setPharmacySearch("");
    setPharmacyLocationError("");
    loadNearbyPharmacies();
  };
  useEffect(() => {
    if (!isOpen) {
      setSuccessOrder(null);
      setErrorMsg("");
      setPaymentAccepted(false);
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
      void (async () => {
        try {
          setIsCalculatingDistance(true);
          setDistanceError("");

          const result = await mapService.calculateDistance(
            pickup,
            delivery
          );

          if (requestId !== calculationRef.current) return;

          if (
            result?.success &&
            typeof result.distanceKm === "number" &&
            result.distanceKm > 0
          ) {
            setDistanceKm(
              Math.round(result.distanceKm * 10) / 10
            );
          } else {
            setDistanceError(
              result?.error ||
                "Mesafe otomatik hesaplanamadı. Lütfen adresleri kontrol edin."
            );
          }
        } catch (error) {
          if (requestId !== calculationRef.current) return;

          setDistanceError(
            error instanceof Error
              ? error.message
              : "Mesafe hesaplanamadı."
          );
        } finally {
          if (requestId === calculationRef.current) {
            setIsCalculatingDistance(false);
          }
        }
      })();
    }, 700);

    return () => window.clearTimeout(timer);
  }, [pharmacyAddress, deliveryAddress]);

  const handleFileChange = (file: File | null) => {
    setErrorMsg("");

    if (!file) {
      setPrescriptionFile(null);
      return;
    }

    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      setErrorMsg(
        "Reçete veya belge yalnızca PDF, JPG, PNG ya da WEBP olabilir."
      );
      setPrescriptionFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(
        "Reçete veya belge boyutu en fazla 10 MB olabilir."
      );
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
        throw new Error(
          "Bu işlem yalnızca müşteri hesabıyla yapılabilir."
        );
      }

      const customerPhone =
        typeof currentUser.phone === "string"
          ? currentUser.phone.trim()
          : "";
      const safeReceiverPhone = receiverPhone.trim();

      if (!pharmacyName.trim()) {
        throw new Error("Lütfen eczane adını giriniz.");
      }
      if (!pharmacyAddress.trim()) {
        throw new Error("Lütfen eczane adresini giriniz.");
      }
      if (!productName.trim()) {
        throw new Error("Lütfen ürün/ilaç bilgisini giriniz.");
      }
      if (!Number.isFinite(quantity) || quantity < 1) {
        throw new Error("Ürün adedi en az 1 olmalıdır.");
      }
      if (!deliveryAddress.trim()) {
        throw new Error("Lütfen teslimat adresini giriniz.");
      }
      if (!receiverName.trim()) {
        throw new Error("Lütfen teslim alacak kişinin adını giriniz.");
      }
      if (!safeReceiverPhone) {
        throw new Error(
          "Lütfen teslim alacak kişinin telefonunu giriniz."
        );
      }
      if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
        throw new Error("Geçerli bir teslimat mesafesi hesaplanamadı.");
      }

      const orderId =
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `pharmacy_${Date.now()}_${Math.random()
              .toString(36)
              .slice(2, 10)}`;

      const now = new Date().toISOString();
      const description = productDescription.trim();
      const safeDeliveryNote = deliveryNote.trim();
      const combinedNote = [description, safeDeliveryNote]
        .filter(Boolean)
        .join(" | ");

      const safeFileName = prescriptionFile
        ? prescriptionFile.name.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          )
        : "";

      const prescriptionPath = prescriptionFile
        ? `pharmacy-prescriptions/${orderId}/${safeFileName}`
        : "";

      const newOrder: Order = {
        id: orderId,
        orderType: "pharmacy",
        customerId: currentUser.id,
        customerName:
          typeof currentUser.name === "string" && currentUser.name.trim()
            ? currentUser.name.trim()
            : "Müşteri",
        customerPhone,
        courierId: null,
        pickupAddress: pharmacyAddress.trim(),
        deliveryAddress: deliveryAddress.trim(),
        packageType: "Diğer",
        packageSize: "Küçük",
        packageCount: quantity,
        courierType,
        urgency,
        distanceKm,
        price,
        status: "Kurye Bekleniyor",
        note: combinedNote,
        estimatedDeliveryMinutes:
          deliveryType === "Acil Teslimat" ? 35 : 60,
        pharmacyName: pharmacyName.trim(),
        pharmacyAddress: pharmacyAddress.trim(),
        ...(selectedPharmacy?.phone
          ? { pharmacyPhone: selectedPharmacy.phone }
          : {}),
        ...(typeof selectedPharmacy?.latitude === "number"
          ? { pharmacyLatitude: selectedPharmacy.latitude }
          : {}),
        ...(typeof selectedPharmacy?.longitude === "number"
          ? { pharmacyLongitude: selectedPharmacy.longitude }
          : {}),
        ...(selectedPharmacy?.id
          ? { pharmacyPlaceId: selectedPharmacy.id }
          : {}),
        ...(selectedPharmacy?.openingHours
          ? { pharmacyOpeningHours: selectedPharmacy.openingHours }
          : {}),
        pharmacyProduct: productName.trim(),
        pharmacyProductDescription: description,
        pharmacyQuantity: quantity,
        pharmacyRecipientName: receiverName.trim(),
        pharmacyRecipientPhone: safeReceiverPhone,
        pharmacyDeliveryType: deliveryType,
        pharmacyPaymentMethod: "Nakit",
        ...(prescriptionFile
          ? {
              pharmacyPrescriptionPath: prescriptionPath,
              pharmacyPrescriptionFileName: safeFileName,
            }
          : {}),
        createdAt: now,
        updatedAt: now,
      };

      const createdOrder = await storage.createOrder(newOrder);

      if (prescriptionFile) {
        try {
          const firebaseStorage = getStorage(app);
          const fileRef = ref(firebaseStorage, prescriptionPath);

          await uploadBytes(fileRef, prescriptionFile, {
            contentType: prescriptionFile.type,
          });
        } catch (uploadError) {
          console.error(
            "Eczane reçete/belge yükleme hatası:",
            uploadError
          );

          setUploadWarning(
            "Siparişiniz oluşturuldu ancak reçete/belge yüklenemedi."
          );
        }
      }

      setSuccessOrder(createdOrder);
      onOrderCreated(createdOrder);
    } catch (error) {
      console.error("Eczane siparişi oluşturma hatası:", error);
      setErrorMsg(
        error instanceof Error
          ? error.message
          : "Eczane siparişi oluşturulamadı."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrorMsg("");
    if (!paymentAccepted) {
      setErrorMsg(
        "Siparişi oluşturabilmek için nakit ödeme bilgisini okuyup onaylamanız gerekiyor."
      );
      return;
    }

    if (!currentUser.id) {
      setErrorMsg(
        "Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın."
      );
      return;
    }

    if (currentUser.role !== "customer") {
      setErrorMsg(
        "Bu işlem yalnızca müşteri hesabıyla yapılabilir."
      );
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
                <h2 className="text-xl font-black text-white">
                  Eczane siparişiniz başarıyla oluşturuldu.
                </h2>
                <p className="mt-1 text-sm text-[#8F8F99]">
                  Siparişiniz mevcut Trustline Express operasyon akışına aktarıldı.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[#303036] p-2 text-[#888] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="space-y-3 p-5">
            <div className="rounded-2xl border border-[#303036] bg-[#101014] p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-bold text-[#777780]">
                  Sipariş numarası
                </span>
                <span className="break-all text-right font-mono text-xs font-black text-white">
                  #{successOrder.id}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-[#D6A84F]/20 bg-[#D6A84F]/5 p-4 text-sm text-[#D0D0D5]">
              Ödeme yöntemi: <span className="font-black text-[#D6A84F]">Nakit</span>
            </div>

            {uploadWarning && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs leading-5 text-amber-200">
                {uploadWarning}
              </div>
            )}

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
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-[#D6A84F]">
                Eczane Siparişi
              </div>
              <h2 className="text-lg font-black text-white">
                Eczaneden ürün teslimatı oluştur
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-[#303036] p-2 text-[#888] hover:text-white disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-h-[80vh] space-y-5 overflow-y-auto p-5 sm:p-6"
        >
          <div className="space-y-3 rounded-2xl border border-[#303036] bg-[#101014] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-black text-white">
                  Yakınınızdaki Eczaneler
                </div>
                <div className="mt-1 text-xs text-[#888]">
                  Konumunuza göre yakın eczaneleri seçebilirsiniz.
                </div>
              </div>

              <button
                type="button"
                onClick={loadNearbyPharmacies}
                disabled={isLoadingPharmacies}
                className="flex items-center gap-2 rounded-xl border border-[#303036] px-3 py-2 text-xs font-bold text-white hover:border-[#D6A84F] disabled:opacity-50"
              >
                <RefreshCw
                  size={15}
                  className={isLoadingPharmacies ? "animate-spin" : ""}
                />
                Yenile
              </button>
            </div>

            {selectedPharmacy ? (
              <div className="rounded-2xl border border-[#D6A84F]/40 bg-[#D6A84F]/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-black text-white">
                      {selectedPharmacy.name}
                    </div>

                    <div className="mt-1 text-xs leading-5 text-[#B8B8B8]">
                      {selectedPharmacy.address}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#D6A84F]">
                      <span className="rounded-full bg-[#D6A84F]/10 px-2 py-1">
                        {selectedPharmacy.distanceKm.toFixed(1)} km
                      </span>

                      {selectedPharmacy.phone ? (
                        <span className="flex items-center gap-1 rounded-full bg-[#D6A84F]/10 px-2 py-1">
                          <Phone size={12} />
                          {selectedPharmacy.phone}
                        </span>
                      ) : null}

                      {selectedPharmacy.openingHours ? (
                        <span className="flex items-center gap-1 rounded-full bg-[#D6A84F]/10 px-2 py-1">
                          <Clock size={12} />
                          {selectedPharmacy.openingHours}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleChangePharmacy}
                    className="shrink-0 rounded-xl border border-[#303036] px-3 py-2 text-xs font-black text-white hover:border-[#D6A84F]"
                  >
                    Eczaneyi Değiştir
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-[#777]"
                  />

                  <input
                    value={pharmacySearch}
                    onChange={(event) => setPharmacySearch(event.target.value)}
                    className="w-full rounded-xl border border-[#303036] bg-[#19191E] py-3 pl-10 pr-4 text-sm text-white outline-none focus:border-[#D6A84F]"
                    placeholder="Eczane ara..."
                  />
                </div>

                {isLoadingPharmacies ? (
                  <div className="rounded-xl border border-[#303036] p-4 text-center text-sm text-[#999]">
                    Yakınınızdaki eczaneler aranıyor...
                  </div>
                ) : null}

                {pharmacyLocationError ? (
                  <div className="rounded-xl border border-[#6B4F24] bg-[#D6A84F]/5 p-3 text-xs leading-5 text-[#D6A84F]">
                    {pharmacyLocationError}
                  </div>
                ) : null}

                {!isLoadingPharmacies &&
                nearbyPharmacies
                  .filter((pharmacy) =>
                    pharmacy.name
                      .toLocaleLowerCase("tr-TR")
                      .includes(
                        pharmacySearch.trim().toLocaleLowerCase("tr-TR")
                      )
                  )
                  .length > 0 ? (
                  <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {nearbyPharmacies
                      .filter((pharmacy) =>
                        pharmacy.name
                          .toLocaleLowerCase("tr-TR")
                          .includes(
                            pharmacySearch.trim().toLocaleLowerCase("tr-TR")
                          )
                      )
                      .map((pharmacy) => (
                        <button
                          key={pharmacy.id}
                          type="button"
                          onClick={() => handleSelectPharmacy(pharmacy)}
                          className="w-full rounded-2xl border border-[#303036] bg-[#19191E] p-4 text-left transition hover:border-[#D6A84F]"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-black text-white">
                                {pharmacy.name}
                              </div>

                              <div className="mt-1 text-xs leading-5 text-[#999]">
                                {pharmacy.address}
                              </div>
                            </div>

                            <span className="shrink-0 rounded-full bg-[#D6A84F]/10 px-2 py-1 text-[11px] font-bold text-[#D6A84F]">
                              {pharmacy.distanceKm.toFixed(1)} km
                            </span>
                          </div>

                          {(pharmacy.phone || pharmacy.openingHours) ? (
                            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[#888]">
                              {pharmacy.phone ? (
                                <span className="flex items-center gap-1">
                                  <Phone size={12} />
                                  {pharmacy.phone}
                                </span>
                              ) : null}

                              {pharmacy.openingHours ? (
                                <span className="flex items-center gap-1">
                                  <Clock size={12} />
                                  {pharmacy.openingHours}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </button>
                      ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#999999]">
                Eczane adı
              </span>
              <input
                value={pharmacyName}
                onChange={(event) => { setSelectedPharmacy(null); setPharmacyName(event.target.value); }}
                className="w-full rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]"
                placeholder="Eczane adı"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#999999]">
                Eczane adresi
              </span>
              <input
                value={pharmacyAddress}
                onChange={(event) => { setSelectedPharmacy(null); setPharmacyAddress(event.target.value); }}
                className="w-full rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]"
                placeholder="Ürünün alınacağı eczane adresi"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_140px]">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#999999]">
                Ürün / ilaç
              </span>
              <input
                value={productName}
                onChange={(event) => setProductName(event.target.value)}
                className="w-full rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]"
                placeholder="Ürün veya ilaç adı"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#999999]">
                Adet
              </span>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(event) =>
                  setQuantity(Math.max(1, Number(event.target.value) || 1))
                }
                className="w-full rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]"
              />
            </label>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-wide text-[#999999]">
              Ürün açıklaması
            </span>
            <textarea
              value={productDescription}
              onChange={(event) => setProductDescription(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]"
              placeholder="Doz, kutu bilgisi veya ürünle ilgili teslimat notu"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#999999]">
                Teslimat adresi
              </span>
              <input
                value={deliveryAddress}
                onChange={(event) => setDeliveryAddress(event.target.value)}
                className="w-full rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]"
                placeholder="Teslim edilecek adres"
              />
            </label>

            <div className="rounded-xl border border-[#303036] bg-[#101014] px-4 py-3">
              <div className="flex items-center gap-2 text-xs font-bold text-[#999999]">
                <MapPin size={14} className="text-[#D6A84F]" /> Mesafe
              </div>
              <div className="mt-1 text-lg font-black text-white">
                {isCalculatingDistance ? "Hesaplanıyor..." : `${distanceKm} km`}
              </div>
              {distanceError && (
                <p className="mt-1 text-[11px] text-red-300">{distanceError}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#999999]">
                Teslim alacak kişi
              </span>
              <input
                value={receiverName}
                onChange={(event) => setReceiverName(event.target.value)}
                className="w-full rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs font-black uppercase tracking-wide text-[#999999]">
                Telefon
              </span>
              <input
                value={receiverPhone}
                onChange={(event) => setReceiverPhone(event.target.value)}
                className="w-full rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]"
                inputMode="tel"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-black uppercase tracking-wide text-[#999999]">
                Teslimat türü
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(["Standart Teslimat", "Acil Teslimat"] as DeliveryType[]).map(
                  (type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setDeliveryType(type)}
                      className={`rounded-xl border px-3 py-3 text-xs font-black transition ${
                        deliveryType === type
                          ? "border-[#D6A84F] bg-[#D6A84F]/10 text-[#D6A84F]"
                          : "border-[#303036] bg-[#101014] text-[#999999]"
                      }`}
                    >
                      {type}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#D6A84F]/20 bg-[#D6A84F]/5 p-4">
              <div className="text-xs font-black uppercase tracking-wide text-[#999999]">
                Tahmini ücret
              </div>
              <div className="mt-1 text-2xl font-black text-[#D6A84F]">
                {new Intl.NumberFormat("tr-TR", {
                  style: "currency",
                  currency: "TRY",
                  maximumFractionDigits: 0,
                }).format(price)}
              </div>
              <div className="mt-1 text-[11px] text-[#777780]">
                Mevcut Trustline Express fiyatlandırması kullanılır.
              </div>
            </div>
          </div>

          <label className="space-y-2">
            <span className="text-xs font-black uppercase tracking-wide text-[#999999]">
              Teslimat notu
            </span>
            <textarea
              value={deliveryNote}
              onChange={(event) => setDeliveryNote(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-[#303036] bg-[#101014] px-4 py-3 text-sm text-white outline-none focus:border-[#D6A84F]"
              placeholder="Kurye için özel teslimat talimatı"
            />
          </label>

          <div className="rounded-2xl border border-[#303036] bg-[#101014] p-4">
            <div className="flex items-center gap-2 text-sm font-black text-white">
              <FileText size={16} className="text-[#D6A84F]" /> Reçete / gerekli belge
            </div>
            <p className="mt-2 text-xs leading-5 text-[#777780]">
              Reçete veya belge yükleme özelliği yakında eklenecek.
            </p>
          </div>

          <div className="rounded-2xl border border-[#D6A84F]/20 bg-[#D6A84F]/5 p-4 text-sm text-[#CFCFD5] space-y-3">
  <div>
    Bu sürümde ödeme yöntemi <span className="font-black text-[#D6A84F]">nakit</span> olarak uygulanmaktadır.
  </div>

  <label className="flex items-start gap-3 cursor-pointer">
    <input
      type="checkbox"
      checked={paymentAccepted}
      onChange={(event) => setPaymentAccepted(event.target.checked)}
      className="mt-1 h-4 w-4 accent-[#D6A84F]"
    />
    <span>
      Nakit ödeme yapılacağını okudum ve kabul ediyorum.
    </span>
  </label>
</div>

          {errorMsg && (
            <div className="flex gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              <AlertCircle size={17} className="mt-0.5 shrink-0" />
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-[#D6A84F] px-6 text-sm font-black text-[#0B0B0D] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Sipariş oluşturuluyor...
              </>
            ) : (
              "Eczane Siparişini Oluştur"
            )}
          </button>
        </form>
      </div>
    </div>
  );
};







