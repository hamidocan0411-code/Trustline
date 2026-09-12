import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  Check,
  Loader2,
  MapPin,
  Navigation,
  Sparkles,
  Truck,
  X,
} from "lucide-react";

import type {
  CourierType,
  Order,
  PackageType,
  PricingConfig,
  UrgencyLevel,
  UserProfile,
} from "../types";

import {
  calculateOrderPrice,
  type PackageSize,
} from "../utils/pricing";

import { storage } from "../services/storage";

import {
  type GeoCoordinate,
  mapService,
} from "../services/mapService";

import { RouteMap } from "./RouteMap";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  pricing: PricingConfig;
  prefillData?: Partial<Order>;
  onOrderCreated: (newOrder: Order) => void;
}

export const NewOrderModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentUser,
  pricing,
  prefillData,
  onOrderCreated,
}) => {
  const [pickupAddress, setPickupAddress] =
    useState("");

  const [deliveryAddress, setDeliveryAddress] =
    useState("");

  const [packageType, setPackageType] =
    useState<PackageType>("Evrak");

  const [packageCount, setPackageCount] =
    useState<number>(1);

  const [packageSize, setPackageSize] =
    useState<PackageSize>("Küçük");

  const [courierType, setCourierType] =
    useState<CourierType>("Standart Kurye");

  const [urgency, setUrgency] =
    useState<UrgencyLevel>("Normal");

  const [distanceKm, setDistanceKm] =
    useState<number>(10);

  const [note, setNote] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [
    showPaymentNotice,
    setShowPaymentNotice,
  ] = useState(false);

  const [errorMsg, setErrorMsg] =
    useState("");

  const [successOrder, setSuccessOrder] =
    useState<Order | null>(null);

  const [pickupCoords, setPickupCoords] =
    useState<GeoCoordinate | null>(null);

  const [deliveryCoords, setDeliveryCoords] =
    useState<GeoCoordinate | null>(null);

  const [routePoints, setRoutePoints] =
    useState<[number, number][]>([]);

  const [
    approximateDistanceText,
    setApproximateDistanceText,
  ] = useState("");

  const [isAutoCalculated, setIsAutoCalculated] =
    useState(false);

  const [
    isCalculatingDistance,
    setIsCalculatingDistance,
  ] = useState(false);

  const [autoCalcError, setAutoCalcError] =
    useState("");

  const [showMap, setShowMap] =
    useState(false);

  const calculationRequestRef =
    useRef(0);

  const debounceTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(
      null
    );

  /*
   * PREFILL
   */
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (prefillData?.pickupAddress) {
      setPickupAddress(
        prefillData.pickupAddress
      );
    }

    if (prefillData?.deliveryAddress) {
      setDeliveryAddress(
        prefillData.deliveryAddress
      );
    }

    if (prefillData?.packageType) {
      setPackageType(
        prefillData.packageType
      );
    }

    if (
      typeof prefillData?.packageCount ===
      "number"
    ) {
      setPackageCount(
        Math.max(
          1,
          prefillData.packageCount
        )
      );
    }

    if (prefillData?.courierType) {
      setCourierType(
        prefillData.courierType
      );
    }

    if (prefillData?.urgency) {
      setUrgency(
        prefillData.urgency
      );
    }

    if (
      typeof prefillData?.distanceKm ===
      "number" &&
      prefillData.distanceKm > 0
    ) {
      setDistanceKm(
        prefillData.distanceKm
      );
    }

    if (prefillData?.note) {
      setNote(
        prefillData.note
      );
    }
  }, [isOpen, prefillData]);

  /*
   * RESET SUCCESS STATE WHEN MODAL CLOSES
   */
  useEffect(() => {
    if (!isOpen) {
      setShowPaymentNotice(false);
      setSuccessOrder(null);
      setErrorMsg("");
    }
  }, [isOpen]);

  /*
   * AUTOMATIC DISTANCE CALCULATION
   */
  useEffect(() => {
    const pickup =
      pickupAddress.trim();

    const delivery =
      deliveryAddress.trim();

    if (
      pickup.length < 3 ||
      delivery.length < 3
    ) {
      setIsCalculatingDistance(false);
      setIsAutoCalculated(false);
      setApproximateDistanceText("");
      setAutoCalcError("");
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(
        debounceTimerRef.current
      );
    }

    const requestId =
      ++calculationRequestRef.current;

    debounceTimerRef.current =
      setTimeout(() => {
        (async () => {
          try {
            setIsCalculatingDistance(true);
            setAutoCalcError("");

            const result =
              await mapService.calculateDistance(
                pickup,
                delivery
              );

            if (
              requestId !==
              calculationRequestRef.current
            ) {
              return;
            }

            if (
              result &&
              result.success &&
              typeof result.distanceKm ===
                "number" &&
              result.distanceKm > 0
            ) {
              const roundedKm =
                Math.round(
                  result.distanceKm *
                    10
                ) / 10;

              setDistanceKm(
                roundedKm
              );

              setPickupCoords(
                result.pickupCoords ||
                  null
              );

              setDeliveryCoords(
                result.deliveryCoords ||
                  null
              );

              setRoutePoints(
                result.routePoints ||
                  []
              );

              setApproximateDistanceText(
                result.approximateDistanceText ||
                  ("Yaklaşık mesafe: " +
                    roundedKm +
                    " km")
              );

              setIsAutoCalculated(
                true
              );

              setAutoCalcError("");

              console.log(
                "OTOMATİK KM HESAPLANDI:",
                roundedKm
              );
            } else {
              setIsAutoCalculated(
                false
              );

              setAutoCalcError(
                result?.error ||
                  "Mesafe otomatik hesaplanamadı."
              );

              console.warn(
                "Otomatik KM hesaplanamadı:",
                result
              );
            }
          } catch (error) {
            if (
              requestId !==
              calculationRequestRef.current
            ) {
              return;
            }

            console.error(
              "Otomatik mesafe hesaplama hatası:",
              error
            );

            setIsAutoCalculated(
              false
            );

            setAutoCalcError(
              error instanceof Error &&
                error.message
                ? error.message
                : "Mesafe otomatik hesaplanamadı. Lütfen adresleri kontrol edin."
            );
          } finally {
            if (
              requestId ===
              calculationRequestRef.current
            ) {
              setIsCalculatingDistance(
                false
              );
            }
          }
        })();
      }, 700);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(
          debounceTimerRef.current
        );

        debounceTimerRef.current =
          null;
      }
    };
  }, [
    pickupAddress,
    deliveryAddress,
  ]);

  /*
   * COURIER / URGENCY
   */
  useEffect(() => {
    if (
      courierType ===
        "Acil Kurye" &&
      urgency === "Normal"
    ) {
      setUrgency("Acil");
    }

    if (
      courierType ===
      "VIP Kurye"
    ) {
      setUrgency("Çok Acil");
    }

    if (
      courierType ===
        "Standart Kurye" &&
      urgency !== "Normal"
    ) {
      setUrgency("Normal");
    }
  }, [
    courierType,
    urgency,
  ]);

  /*
   * PRICE
   */
  const {
    finalPrice,
    multiplier,
    isMinimumApplied,
    packageSizeFee,
  } =
    calculateOrderPrice(
      distanceKm,
      courierType,
      pricing,
      packageSize
    );

  /*
   * CREATE ORDER
   */
  const createOrder = async () => {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const verifiedPrice =
        calculateOrderPrice(
          distanceKm,
          courierType,
          pricing,
          packageSize
        ).finalPrice;

      const generatedOrderId =
        typeof crypto !==
          "undefined" &&
        typeof crypto.randomUUID ===
          "function"
          ? crypto.randomUUID()
          : "order_" +
            Date.now() +
            "_" +
            Math.random()
              .toString(36)
              .slice(2, 10);

      const now =
        new Date().toISOString();

      /*
       * Eski kullanıcı profillerinde phone alanı hiç olmayabilir.
       * Firestore undefined alanları kaydetmez; boş metin ise geçerli
       * bir değerdir ve sipariş akışının ödeme ekranında takılmasını
       * önler.
       */
      const customerPhone =
        typeof currentUser.phone ===
        "string"
          ? currentUser.phone.trim()
          : "";

      const newOrder =
        await storage.createOrder({
          id: generatedOrderId,

          customerId:
            currentUser.id,

          customerName:
            currentUser.name,

          customerPhone:
            customerPhone,

          courierId: null,

          pickupAddress:
            pickupAddress.trim(),

          deliveryAddress:
            deliveryAddress.trim(),

          packageType,

          packageCount,

          courierType,

          urgency,

          distanceKm,

          price: verifiedPrice,

          status:
            "Kurye Bekleniyor",

          note:
            note.trim(),

          estimatedDeliveryMinutes:
            courierType ===
            "Acil Kurye"
              ? 35
              : courierType ===
                "VIP Kurye"
              ? 25
              : 60,

          createdAt: now,

          updatedAt: now,
        });

      if (
        !newOrder ||
        !newOrder.id
      ) {
        throw new Error(
          "Sipariş oluşturuldu ancak sipariş bilgisi alınamadı."
        );
      }

      setErrorMsg("");
      setShowPaymentNotice(false);
      setSuccessOrder(
        newOrder
      );

      try {
        onOrderCreated(
          newOrder
        );
      } catch (
        callbackError
      ) {
        console.error(
          "Sipariş başarı callback hatası:",
          callbackError
        );
      }
    } catch (error) {
      console.error(
        "Sipariş oluşturma hatası:",
        error
      );

      setSuccessOrder(
        null
      );

      setErrorMsg(
        error instanceof Error &&
          error.message
          ? error.message
          : "Sipariş kaydedilirken bir hata oluştu. Lütfen tekrar deneyin."
      );
    } finally {
      setIsSubmitting(
        false
      );
    }
  };

  /*
   * FORM SUBMIT
   */
  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (isSubmitting) {
      return;
    }

    setErrorMsg("");

    if (!currentUser.id) {
      setErrorMsg(
        "Kullanıcı oturumu bulunamadı. Lütfen tekrar giriş yapın."
      );

      return;
    }

    if (
      currentUser.role !==
      "customer"
    ) {
      setErrorMsg(
        "Bu işlem yalnızca müşteri hesabıyla yapılabilir."
      );

      return;
    }

    if (
      !pickupAddress.trim()
    ) {
      setErrorMsg(
        "Lütfen paketin alınacağı adresi giriniz."
      );

      return;
    }

    if (
      !deliveryAddress.trim()
    ) {
      setErrorMsg(
        "Lütfen paketin teslim edileceği adresi giriniz."
      );

      return;
    }

    if (
      !Number.isFinite(
        distanceKm
      ) ||
      distanceKm <= 0
    ) {
      setErrorMsg(
        "Lütfen geçerli bir mesafe belirtiniz."
      );

      return;
    }

    if (
      packageCount < 1
    ) {
      setErrorMsg(
        "Paket adedi en az 1 olmalıdır."
      );

      return;
    }

    setShowPaymentNotice(
      true
    );
  };

  /*
   * QUICK ADDRESS
   */
  const handleQuickAddress = (
    from: string,
    to: string
  ) => {
    setPickupAddress(
      from
    );

    setDeliveryAddress(
      to
    );

    setPickupCoords(
      null
    );

    setDeliveryCoords(
      null
    );

    setRoutePoints(
      []
    );

    setIsAutoCalculated(
      false
    );

    setApproximateDistanceText(
      ""
    );

    setAutoCalcError(
      ""
    );
  };

  if (!isOpen) {
    return null;
  }

  /*
   * SUCCESS SCREEN
   */
  if (successOrder) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg bg-[#19191E] border border-[#303036] rounded-3xl shadow-2xl overflow-hidden my-auto"
          onClick={(e) =>
            e.stopPropagation()
          }
        >
          <div className="p-4 sm:p-5 border-b border-[#303036] flex items-center justify-between bg-[#0B0B0D]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#D6A84F]/20 border border-[#D6A84F]/40 flex items-center justify-center">
                <Check className="w-4 h-4 text-[#D6A84F]" />
              </div>

              <div>
                <h2 className="font-bold text-base sm:text-lg text-white">
                  Sipariş Durumu
                </h2>

                <p className="text-[11px] text-[#999999]">
                  Trustline Express
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#999999] hover:text-white hover:bg-[#222229]"
              aria-label="Kapat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 sm:p-6 text-center space-y-5">
            <div className="w-20 h-20 rounded-full bg-[#D6A84F]/20 border-2 border-[#D6A84F] flex items-center justify-center mx-auto text-[#D6A84F]">
              <Check className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs font-mono font-bold text-[#D6A84F]">
                SİPARİŞ BAŞARIYLA OLUŞTURULDU
              </span>

              <h3 className="text-2xl font-extrabold text-white mt-2">
                Paketiniz oluşturuldu!
              </h3>

              <p className="text-sm text-[#999999] mt-2 leading-relaxed">
                Siparişiniz başarıyla sisteme
                kaydedildi. Kurye atanması
                bekleniyor.
              </p>
            </div>

            <div className="bg-[#222229] border border-[#303036] rounded-2xl p-4 text-left space-y-3">
              <div className="flex justify-between gap-3">
                <span className="text-[#999999] text-xs">
                  Sipariş No:
                </span>

                <span className="font-mono font-bold text-white break-all text-right text-xs">
                  #{successOrder.id}
                </span>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-[#999999] text-xs">
                  Kurye Türü:
                </span>

                <span className="font-semibold text-[#D6A84F] text-xs">
                  {successOrder.courierType}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#999999] text-xs">
                  Mesafe:
                </span>

                <span className="font-semibold text-white text-xs">
                  {successOrder.distanceKm} KM
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#999999] text-xs">
                  Paket:
                </span>

                <span className="font-semibold text-white text-xs">
                  {successOrder.packageType}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#999999] text-xs">
                  Ödeme:
                </span>

                <span className="font-semibold text-white text-xs">
                  Nakit
                </span>
              </div>

              <div className="h-px bg-[#303036]" />

              <div className="flex justify-between">
                <span className="text-white font-bold">
                  Toplam:
                </span>

                <span className="text-lg font-extrabold text-[#D6A84F]">
                  {successOrder.price} TL
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 rounded-xl bg-[#D6A84F] text-[#0B0B0D] font-black text-sm"
            >
              Siparişlerime Git
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#19191E] border border-[#303036] rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) =>
          e.stopPropagation()
        }
      >
        <div className="p-4 sm:p-5 border-b border-[#303036] flex items-center justify-between bg-[#0B0B0D]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D6A84F]/20 border border-[#D6A84F]/40 flex items-center justify-center">
              <Truck className="w-4 h-4 text-[#D6A84F]" />
            </div>

            <div>
              <h2 className="font-bold text-base sm:text-lg text-white">
                Kurye Çağır
              </h2>

              <p className="text-[11px] text-[#999999]">
                Güvenli, hızlı ve şeffaf fiyatlı kurye siparişi
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={
              isSubmitting
            }
            className="p-1.5 rounded-lg text-[#999999] hover:text-white hover:bg-[#222229] disabled:opacity-50"
            aria-label="Kapat"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {showPaymentNotice ? (
            <div className="p-1 sm:p-2 space-y-5">
              <div className="text-center pt-2">
                <div className="w-16 h-16 rounded-full bg-[#D6A84F]/20 border-2 border-[#D6A84F] flex items-center justify-center mx-auto text-[#D6A84F]">
                  <Check className="w-8 h-8" />
                </div>

                <h3 className="text-xl font-extrabold text-white mt-4">
                  💳 Ödeme Bilgilendirmesi
                </h3>

                <p className="text-xs text-[#999999] mt-2 leading-relaxed">
                  Siparişinizi tamamlamadan önce ödeme yöntemleri hakkında sizi bilgilendirmek isteriz.
                </p>
              </div>

              <div className="bg-[#222229] border border-[#303036] rounded-2xl p-4 space-y-4 text-xs sm:text-sm text-[#CCCCCC] leading-relaxed">
                <p>
                  Trustline Express olarak ödeme deneyiminizi daha kolay ve esnek hale getirmek için sistemimizi geliştirmeye devam ediyoruz.
                </p>

                <p>
                  <strong className="text-white">
                    Şu anda siparişlerde nakit ödeme seçeneği aktiftir.
                  </strong>
                </p>

                <p>
                  Yakın zamanda yapılacak geliştirmelerle birlikte{" "}
                  <strong className="text-white">
                    kredi kartı ve banka kartı ile ödeme seçeneklerinin de
                  </strong>{" "}
                  kullanıma sunulması planlanmaktadır.
                </p>

                <p>
                  Bu geliştirme tamamlandığında siparişinizi oluştururken{" "}
                  <strong className="text-white">
                    nakit veya kart ile ödeme
                  </strong>{" "}
                  seçeneklerinden size uygun olanı tercih edebileceksiniz.
                </p>

                <p>
                  Amacımız, ödeme sürecini sizin için{" "}
                  <strong className="text-white">
                    kolay, hızlı ve güvenli
                  </strong>{" "}
                  hale getirmektir.
                </p>

                <div className="border-t border-[#303036] pt-3 text-[#D6A84F]">
                  <strong>Not:</strong>{" "}
                  Kart ile ödeme özelliği şu anda aktif değildir.
                  Kullanıma sunulduğunda ayrıca bilgilendirme yapılacaktır.
                </div>
              </div>

              <div className="bg-[#D6A84F]/10 border border-[#D6A84F]/30 rounded-xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-[#999999]">
                    Sipariş Tutarı
                  </span>

                  <span className="text-lg font-black text-[#D6A84F]">
                    {finalPrice} TL
                  </span>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-[#999999]">
                    Aktif Ödeme Yöntemi
                  </span>

                  <span className="text-xs font-bold text-white">
                    Nakit
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={createOrder}
                  disabled={
                    isSubmitting
                  }
                  className="w-full py-3.5 rounded-xl bg-[#D6A84F] text-[#0B0B0D] font-black text-sm hover:brightness-105 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sipariş oluşturuluyor...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Okudum, Onaylıyorum — Nakit Ödeme
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setShowPaymentNotice(
                      false
                    )
                  }
                  disabled={
                    isSubmitting
                  }
                  className="w-full py-3 rounded-xl bg-[#222229] border border-[#303036] text-[#999999] font-bold text-sm hover:text-white hover:border-[#44444C] transition disabled:opacity-50"
                >
                  Onaylamıyorum — Geri Dön
                </button>
              </div>

              <p className="text-center text-[9px] text-[#555555] leading-relaxed">
                Onay vermeden siparişiniz oluşturulmaz.
              </p>
            </div>
          ) : (
            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-4"
            >
              {prefillData &&
                (prefillData.pickupAddress ||
                  prefillData.deliveryAddress) && (
                  <div className="p-3 rounded-xl bg-[#D6A84F]/10 border border-[#D6A84F]/30 text-[#D6A84F] text-xs">
                    ✨ Trustline AI tarafından hazırlandı
                  </div>
                )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />

                  <span>
                    {errorMsg}
                  </span>
                </div>
              )}

              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#999999]">
                  Hızlı Rota:
                </span>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      handleQuickAddress(
                        "Levent Mah. Şişli / İstanbul",
                        "Maslak Mah. Sarıyer / İstanbul"
                      )
                    }
                    className="text-[10px] bg-[#222229] text-slate-300 px-2 py-1 rounded-md border border-[#303036]"
                  >
                    Levent → Maslak
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleQuickAddress(
                        "Moda Mah. Kadıköy / İstanbul",
                        "Ataşehir Varyap Plaza / İstanbul"
                      )
                    }
                    className="text-[10px] bg-[#222229] text-slate-300 px-2 py-1 rounded-md border border-[#303036]"
                  >
                    Kadıköy → Ataşehir
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleQuickAddress(
                        "Avcılar Merkez / İstanbul",
                        "Beşiktaş Çarşı / İstanbul"
                      )
                    }
                    className="text-[10px] bg-[#222229] text-slate-300 px-2 py-1 rounded-md border border-[#303036]"
                  >
                    Avcılar → Beşiktaş
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-[#D6A84F] uppercase font-bold flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      Alım Adresi
                    </label>

                    {isCalculatingDistance && (
                      <span className="text-[10px] text-[#D6A84F] flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Hesaplanıyor...
                      </span>
                    )}
                  </div>

                  <input
                    type="text"
                    required
                    value={
                      pickupAddress
                    }
                    onChange={(e) => {
                      setPickupAddress(
                        e.target.value
                      );

                      setPickupCoords(
                        null
                      );

                      setDeliveryCoords(
                        null
                      );

                      setRoutePoints(
                        []
                      );

                      setIsAutoCalculated(
                        false
                      );

                      setApproximateDistanceText(
                        ""
                      );

                      setAutoCalcError(
                        ""
                      );
                    }}
                    placeholder="Örn: Bahçelievler, İstanbul"
                    autoComplete="off"
                    className="w-full bg-[#222229] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-emerald-400 uppercase font-bold flex items-center gap-1.5 mb-1">
                    <Navigation className="w-3 h-3" />
                    Teslimat Adresi
                  </label>

                  <input
                    type="text"
                    required
                    value={
                      deliveryAddress
                    }
                    onChange={(e) => {
                      setDeliveryAddress(
                        e.target.value
                      );

                      setPickupCoords(
                        null
                      );

                      setDeliveryCoords(
                        null
                      );

                      setRoutePoints(
                        []
                      );

                      setIsAutoCalculated(
                        false
                      );

                      setApproximateDistanceText(
                        ""
                      );

                      setAutoCalcError(
                        ""
                      );
                    }}
                    placeholder="Örn: Beşiktaş, İstanbul"
                    autoComplete="off"
                    className="w-full bg-[#222229] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                  />
                </div>
              </div>

              {isCalculatingDistance && (
                <div className="p-3 rounded-xl bg-[#D6A84F]/10 border border-[#D6A84F]/30 text-[#D6A84F] text-xs flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adresler için güncel mesafe hesaplanıyor...
                </div>
              )}

              {isAutoCalculated &&
                approximateDistanceText && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-emerald-400">
                      <Sparkles className="w-4 h-4 shrink-0" />

                      <span className="font-bold text-xs">
                        {
                          approximateDistanceText
                        }
                      </span>
                    </div>

                    <span className="text-[10px] text-emerald-400 shrink-0">
                      OTOMATİK
                    </span>
                  </div>
                )}

              {autoCalcError && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />

                  <div>
                    <p className="font-semibold">
                      {
                        autoCalcError
                      }
                    </p>

                    <p className="text-[10px] mt-1">
                      KM alanından manuel değer girebilirsiniz.
                    </p>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-[#999999] uppercase font-semibold">
                    Mesafe
                  </label>

                  {isAutoCalculated && (
                    <span className="text-[9px] text-emerald-400 font-bold">
                      OTOMATİK
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={
                      distanceKm
                    }
                    onChange={(e) => {
                      const value =
                        Number(
                          e.target.value
                        );

                      setDistanceKm(
                        Number.isFinite(
                          value
                        )
                          ? value
                          : 0
                      );

                      setIsAutoCalculated(
                        false
                      );
                    }}
                    className="w-full bg-[#222229] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3.5 py-2.5 pr-12 text-sm text-white focus:outline-none"
                  />

                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#777777] font-bold">
                    KM
                  </span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase font-bold text-[#999999]">
                    CANLI HARİTA & ROTA
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setShowMap(
                        !showMap
                      )
                    }
                    className="text-[10px] text-[#D6A84F]"
                  >
                    {showMap
                      ? "Haritayı Gizle"
                      : "Haritayı Göster"}
                  </button>
                </div>

                {showMap && (
                  <RouteMap
                    pickupCoords={
                      pickupCoords
                    }
                    deliveryCoords={
                      deliveryCoords
                    }
                    routePoints={
                      routePoints
                    }
                    distanceKm={
                      distanceKm
                    }
                    approximateDistanceText={
                      approximateDistanceText
                    }
                    isAutoCalculated={
                      isAutoCalculated
                    }
                  />
                )}
              </div>

              <div>
                <label className="text-[10px] text-[#999999] uppercase block mb-1 font-semibold">
                  Paket Türü
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
                  {(
                    [
                      "Evrak",
                      "Küçük Paket",
                      "Orta Paket",
                      "Büyük Paket",
                      "Diğer",
                    ] as PackageType[]
                  ).map(
                    (type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          setPackageType(
                            type
                          )
                        }
                        className={
                          "py-2 px-1 rounded-lg border text-[10px] font-bold " +
                          (packageType ===
                          type
                            ? "bg-[#D6A84F] text-[#0B0B0D] border-[#D6A84F]"
                            : "bg-[#222229] text-[#999999] border-[#303036]")
                        }
                      >
                        {type}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#999999] uppercase block mb-1 font-semibold">
                  Paket Ebatı
                </label>

                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      ["Küçük", 0],
                      ["Orta", 50],
                      ["Büyük", 100],
                      ["Çok Büyük", 200],
                    ] as [
                      PackageSize,
                      number
                    ][]
                  ).map(
                    ([size, fee]) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() =>
                          setPackageSize(
                            size
                          )
                        }
                        className={
                          "py-2 px-1 rounded-lg border text-[10px] font-bold " +
                          (packageSize ===
                          size
                            ? "bg-[#D6A84F] text-[#0B0B0D] border-[#D6A84F]"
                            : "bg-[#222229] text-[#999999] border-[#303036]")
                        }
                      >
                        <div>
                          {size}
                        </div>

                        <div className="text-[9px] mt-0.5 opacity-70">
                          {fee === 0
                            ? "Ücretsiz"
                            : "+" +
                              fee +
                              " TL"}
                        </div>
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#999999] uppercase block mb-1 font-semibold">
                  Paket Adedi
                </label>

                <input
                  type="number"
                  min="1"
                  step="1"
                  value={
                    packageCount
                  }
                  onChange={(e) => {
                    const value =
                      Math.max(
                        1,
                        Number(
                          e.target.value
                        ) || 1
                      );

                    setPackageCount(
                      value
                    );
                  }}
                  className="w-full bg-[#222229] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-[#999999] uppercase block mb-1 font-semibold">
                  Kurye Türü
                </label>

                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      "Standart Kurye",
                      "Acil Kurye",
                      "VIP Kurye",
                    ] as CourierType[]
                  ).map(
                    (type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() =>
                          setCourierType(
                            type
                          )
                        }
                        className={
                          "py-2.5 px-1 rounded-lg border text-[10px] font-bold " +
                          (courierType ===
                          type
                            ? "bg-[#D6A84F] text-[#0B0B0D] border-[#D6A84F]"
                            : "bg-[#222229] text-[#999999] border-[#303036]")
                        }
                      >
                        {type}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#999999] uppercase block mb-1 font-semibold">
                  Aciliyet
                </label>

                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      "Normal",
                      "Acil",
                      "Çok Acil",
                    ] as UrgencyLevel[]
                  ).map(
                    (level) => (
                      <button
                        key={level}
                        type="button"
                        onClick={() =>
                          setUrgency(
                            level
                          )
                        }
                        disabled={
                          courierType ===
                          "Standart Kurye"
                        }
                        className={
                          "py-2 rounded-lg border text-[10px] font-bold disabled:opacity-60 " +
                          (urgency ===
                          level
                            ? "bg-[#D6A84F] text-[#0B0B0D] border-[#D6A84F]"
                            : "bg-[#222229] text-[#999999] border-[#303036]")
                        }
                      >
                        {level}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-[#999999] uppercase block mb-1 font-semibold">
                  Not
                </label>

                <textarea
                  value={note}
                  onChange={(e) =>
                    setNote(
                      e.target.value
                    )
                  }
                  rows={3}
                  placeholder="Kurye için özel teslimat notu..."
                  className="w-full bg-[#222229] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3.5 py-2.5 text-sm text-white resize-none focus:outline-none"
                />
              </div>

              <div className="bg-[#0B0B0D] border border-[#303036] rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-[#999999] text-xs">
                    Mesafe
                  </span>

                  <span className="text-white text-xs font-bold">
                    {distanceKm} KM
                  </span>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <span className="text-[#999999] text-xs">
                    Kurye çarpanı
                  </span>

                  <span className="text-white text-xs font-bold">
                    x{multiplier}
                  </span>
                </div>

                {isMinimumApplied && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[#999999] text-xs">
                      Minimum ücret
                    </span>

                    <span className="text-white text-xs font-bold">
                      Uygulandı
                    </span>
                  </div>
                )}

                {packageSizeFee >
                  0 && (
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[#999999] text-xs">
                      Paket ebat ek ücreti
                    </span>

                    <span className="text-white text-xs font-bold">
                      +{packageSizeFee} TL
                    </span>
                  </div>
                )}

                <div className="h-px bg-[#303036] my-3" />

                <div className="flex items-end justify-between">
                  <span className="text-white font-black">
                    Toplam
                  </span>

                  <span className="text-[#D6A84F] text-2xl font-black">
                    {finalPrice} TL
                  </span>
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  isCalculatingDistance
                }
                className="w-full py-3.5 rounded-xl bg-[#D6A84F] text-[#0B0B0D] font-black text-sm hover:brightness-105 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sipariş oluşturuluyor...
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4" />
                    Kurye Çağır —{" "}
                    {finalPrice} TL
                  </>
                )}
              </button>

              <p className="text-center text-[9px] text-[#555555] leading-relaxed">
                Sipariş oluşturulduğunda bilgileriniz güvenli şekilde Trustline Express sistemine kaydedilir.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewOrderModal;
