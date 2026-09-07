import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  MapPin,
  Navigation,
  Phone,
  Radio,
  Truck,
  User,
} from "lucide-react";

import type {
  CourierAvailability,
  CourierLocation,
  Order,
  OrderStatus,
  UserProfile,
} from "../types";

import { storage } from "../services/storage";
import { saveDeliveryProof } from "../services/deliveryProof";

import { DeliveryProofModal } from "./DeliveryProofModal";
import { DeliveryProofCard } from "./DeliveryProofCard";

interface Props {
  currentCourier?: UserProfile | null;
  orders?: Order[];
}

const FLOW: OrderStatus[] = [
  "Kurye Bekleniyor",
  "Kurye Atandı",
  "Kurye Kabul Etti",
  "Paket Alındı",
  "Teslimatta",
  "Teslim Edildi",
];

export const CourierPanel: React.FC<Props> = ({
  currentCourier,
  orders = [],
}) => {
  const [activeTab, setActiveTab] =
    useState<"active" | "history">("active");

  const [courierStatus, setCourierStatus] =
    useState<CourierAvailability>(
      currentCourier?.courierStatus || "Müsait"
    );

  const [proofOrder, setProofOrder] =
    useState<Order | null>(null);

  const [expandedHistoryId, setExpandedHistoryId] =
    useState<string | null>(null);

  const [isSharingLocation, setIsSharingLocation] =
    useState(false);

  const [courierLoc, setCourierLoc] =
    useState<CourierLocation | undefined>();

  const [geoError, setGeoError] =
    useState<string | null>(null);

  const [isRequestingGeo, setIsRequestingGeo] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const watchIdRef =
    useRef<number | null>(null);

  /*
   * KURYE PROFİLİ HENÜZ GELMEDİYSE
   * SİYAH EKRAN YERİNE YÜKLENİYOR GÖSTER.
   */
  if (!currentCourier) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#0B0B0D] px-5">
        <div className="w-full max-w-md rounded-3xl border border-[#303036] bg-[#19191E] p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D6A84F]/15 text-[#D6A84F]">
            <Truck size={30} />
          </div>

          <h2 className="mt-5 text-lg font-bold text-white">
            Kurye bilgileri yükleniyor...
          </h2>

          <p className="mt-2 text-sm text-[#999999]">
            Hesabınız hazırlanıyor. Lütfen birkaç saniye bekleyin.
          </p>

          <div className="mx-auto mt-5 h-1.5 w-32 overflow-hidden rounded-full bg-[#303036]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[#D6A84F]" />
          </div>
        </div>
      </div>
    );
  }

  const courierId = currentCourier.id;

  /*
   * orders yanlışlıkla undefined/null gelirse
   * uygulama çökmemesi için güvenli dizi kullan.
   */
  const safeOrders = Array.isArray(orders)
    ? orders
    : [];

  useEffect(() => {
    let mounted = true;

    const sync = () => {
      try {
        const user =
          storage.getUserById(courierId);

        if (mounted && user) {
          setCourierStatus(
            user.courierStatus || "Müsait"
          );
        }

        const location =
          storage.getCourierLocation(courierId);

        if (mounted) {
          setCourierLoc(location);
          setIsSharingLocation(
            Boolean(location?.isSharing)
          );
        }
      } catch (error) {
        console.error(
          "Kurye bilgileri yüklenemedi:",
          error
        );

        if (mounted) {
          setErrorMessage(
            "Kurye bilgileri yüklenirken bir hata oluştu."
          );
        }
      }
    };

    sync();

    let unsubscribe:
      | (() => void)
      | undefined;

    try {
      unsubscribe = storage.subscribe(sync);
    } catch (error) {
      console.error(
        "Storage listener hatası:",
        error
      );
    }

    return () => {
      mounted = false;

      try {
        unsubscribe?.();
      } catch (error) {
        console.warn(
          "Listener kapatma hatası:",
          error
        );
      }

      if (
        watchIdRef.current !== null &&
        "geolocation" in navigator
      ) {
        navigator.geolocation.clearWatch(
          watchIdRef.current
        );

        watchIdRef.current = null;
      }
    };
  }, [courierId]);

  const myOrders = safeOrders.filter(
    (order) =>
      order &&
      order.courierId === courierId
  );

  const activeOrders = myOrders.filter(
    (order) =>
      order.status !== "Teslim Edildi" &&
      order.status !== "İptal Edildi"
  );

  const completedOrders = myOrders.filter(
    (order) =>
      order.status === "Teslim Edildi"
  );

  const totalEarnings =
    completedOrders.reduce(
      (sum, order) =>
        sum +
        Math.round(
          Number(order.price || 0) * 0.7
        ),
      0
    );

  const handleCourierStatus = async (
    status: CourierAvailability
  ) => {
    try {
      setErrorMessage(null);

      const updated =
        await storage.updateCourierStatus(
          courierId,
          status
        );

      if (updated) {
        setCourierStatus(
          updated.courierStatus || status
        );
      } else {
        setCourierStatus(status);
      }
    } catch (error) {
      console.error(
        "Kurye durumu güncellenemedi:",
        error
      );

      setErrorMessage(
        "Kurye durumu güncellenemedi."
      );
    }
  };

  const handleLocationToggle = () => {
    if (isSharingLocation) {
      if (
        watchIdRef.current !== null &&
        "geolocation" in navigator
      ) {
        navigator.geolocation.clearWatch(
          watchIdRef.current
        );

        watchIdRef.current = null;
      }

      try {
        const existing =
          storage.getCourierLocation(
            courierId
          );

        if (existing) {
          const stopped =
            storage.updateCourierLocation({
              courierId,
              latitude: existing.latitude,
              longitude: existing.longitude,
              updatedAt:
                new Date().toISOString(),
              isSharing: false,
            });

          setCourierLoc(stopped);
        }
      } catch (error) {
        console.error(
          "GPS kapatma hatası:",
          error
        );
      }

      setIsSharingLocation(false);
      setGeoError(null);

      return;
    }

    if (
      !("geolocation" in navigator)
    ) {
      setGeoError(
        "Cihazınız GPS servisini desteklemiyor."
      );
      return;
    }

    setIsRequestingGeo(true);
    setGeoError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          setIsRequestingGeo(false);

          const {
            latitude,
            longitude,
          } = position.coords;

          const updated =
            storage.updateCourierLocation({
              courierId,
              latitude,
              longitude,
              updatedAt:
                new Date().toISOString(),
              isSharing: true,
            });

          setCourierLoc(updated);
          setIsSharingLocation(true);

          watchIdRef.current =
            navigator.geolocation.watchPosition(
              (nextPosition) => {
                try {
                  const next =
                    storage.updateCourierLocation({
                      courierId,
                      latitude:
                        nextPosition.coords
                          .latitude,
                      longitude:
                        nextPosition.coords
                          .longitude,
                      updatedAt:
                        new Date().toISOString(),
                      isSharing: true,
                    });

                  setCourierLoc(next);
                } catch (error) {
                  console.error(
                    "GPS konum güncelleme hatası:",
                    error
                  );
                }
              },
              (error) => {
                console.warn(
                  "GPS izleme hatası:",
                  error.message
                );
              },
              {
                enableHighAccuracy: true,
                maximumAge: 10000,
                timeout: 25000,
              }
            );
        } catch (error) {
          console.error(
            "GPS başlatma hatası:",
            error
          );

          setIsRequestingGeo(false);
          setGeoError(
            "Konum paylaşımı başlatılamadı."
          );
        }
      },
      (error) => {
        setIsRequestingGeo(false);

        if (
          error.code ===
          error.PERMISSION_DENIED
        ) {
          setGeoError(
            "Konum erişim izni reddedildi."
          );
        } else if (
          error.code === error.TIMEOUT
        ) {
          setGeoError(
            "GPS sinyali zaman aşımına uğradı."
          );
        } else {
          setGeoError(
            "Konum alınamadı: " +
              error.message
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
      }
    );
  };

  const updateOrderStatus = async (
    orderId: string,
    nextStatus: OrderStatus
  ) => {
    try {
      setErrorMessage(null);

      if (
        nextStatus === "Teslim Edildi"
      ) {
        const order =
          safeOrders.find(
            (item) =>
              item.id === orderId
          );

        if (order) {
          setProofOrder(order);
        }

        return;
      }

      await storage.updateOrderStatus(
        orderId,
        nextStatus
      );
    } catch (error) {
      console.error(
        "Sipariş durumu güncellenemedi:",
        error
      );

      setErrorMessage(
        "Sipariş durumu güncellenemedi."
      );
    }
  };

  const getAction = (
    status: OrderStatus
  ) => {
    switch (status) {
      case "Kurye Atandı":
        return {
          status:
            "Kurye Kabul Etti" as OrderStatus,
          label: "Kabul Et",
          className:
            "bg-[#D6A84F] text-[#0B0B0D]",
        };

      case "Kurye Kabul Etti":
        return {
          status:
            "Paket Alındı" as OrderStatus,
          label: "Paket Alındı",
          className:
            "bg-purple-600 text-white",
        };

      case "Paket Alındı":
        return {
          status:
            "Teslimatta" as OrderStatus,
          label: "Teslimatta",
          className:
            "bg-blue-600 text-white",
        };

      case "Teslimatta":
        return {
          status:
            "Teslim Edildi" as OrderStatus,
          label: "Teslimatı Tamamla",
          className:
            "bg-emerald-600 text-white",
        };

      default:
        return null;
    }
  };

  const handleProofSubmit = async (
    data: {
      receiverName: string;
      deliveryNote: string;
      signature: string;
      photoFile?: File;
    }
  ) => {
    if (!proofOrder) {
      return;
    }

    try {
      setErrorMessage(null);

      await saveDeliveryProof({
        orderId: proofOrder.id,
        receiverName:
          data.receiverName,
        deliveryNote:
          data.deliveryNote,
        signature:
          data.signature,
        photoFile:
          data.photoFile,
      });

      setProofOrder(null);
    } catch (error) {
      console.error(
        "Teslimat kanıtı kaydedilemedi:",
        error
      );

      setErrorMessage(
        "Teslimat kanıtı kaydedilemedi."
      );
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {errorMessage && (
        <div className="flex items-start gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertCircle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <div className="flex-1">
            {errorMessage}
          </div>

          <button
            type="button"
            onClick={() =>
              setErrorMessage(null)
            }
            className="text-xs font-bold text-red-300"
          >
            Kapat
          </button>
        </div>
      )}

      <div className="rounded-3xl border border-[#303036] bg-[#19191E] p-5 shadow-2xl">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
              {currentCourier.avatar ? (
                <img
                  src={currentCourier.avatar}
                  alt={currentCourier.name || "Kurye"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Truck size={24} />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">
                  {currentCourier.name ||
                    "Kurye"}
                </h2>

                <span className="rounded border border-[#303036] bg-[#0B0B0D] px-2 py-0.5 font-mono text-[10px] text-[#D6A84F]">
                  {currentCourier.plate ||
                    "Plaka Yok"}
                </span>
              </div>

              <p className="mt-0.5 text-xs text-[#999999]">
                {currentCourier.vehicle ||
                  "Kurye"}{" "}
                • ⭐{" "}
                {currentCourier.rating ??
                  "5.0"}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto rounded-2xl border border-[#303036] bg-[#0B0B0D] p-1.5">
            {(
              [
                "Müsait",
                "Meşgul",
                "Çevrimdışı",
              ] as CourierAvailability[]
            ).map((status) => {
              const selected =
                courierStatus === status;

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() =>
                    handleCourierStatus(
                      status
                    )
                  }
                  className={`whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-semibold ${
                    selected
                      ? status === "Müsait"
                        ? "bg-emerald-500 text-white"
                        : status === "Meşgul"
                        ? "bg-amber-500 text-[#0B0B0D]"
                        : "bg-red-500/20 text-red-400"
                      : "text-[#999999]"
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-[#303036] pt-4">
          <div className="rounded-2xl border border-[#303036]/60 bg-[#222229] p-3 text-center">
            <span className="block text-[10px] text-[#999999]">
              Aktif Görev
            </span>

            <b className="text-lg text-white">
              {activeOrders.length}
            </b>
          </div>

          <div className="rounded-2xl border border-[#303036]/60 bg-[#222229] p-3 text-center">
            <span className="block text-[10px] text-[#999999]">
              Tamamlanan
            </span>

            <b className="text-lg text-emerald-400">
              {completedOrders.length}
            </b>
          </div>

          <div className="rounded-2xl border border-[#303036]/60 bg-[#222229] p-3 text-center">
            <span className="block text-[10px] text-[#999999]">
              Hakediş
            </span>

            <b className="text-lg text-[#D6A84F]">
              {totalEarnings} TL
            </b>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-[#303036] bg-[#19191E] p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                isSharingLocation
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-[#222229] text-[#999999]"
              }`}
            >
              <Radio size={16} />
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">
                Canlı GPS
              </h3>

              <p className="text-[11px] text-[#999999]">
                {isSharingLocation
                  ? "Konumunuz paylaşılıyor."
                  : "Müşterinin canlı takip edebilmesi için açın."}
              </p>
            </div>
          </div>

          <span className="rounded-full px-2.5 py-1 text-[10px] font-bold text-[#999999]">
            {isSharingLocation
              ? "YAYINDA"
              : "KAPALI"}
          </span>
        </div>

        <button
          type="button"
          onClick={handleLocationToggle}
          disabled={isRequestingGeo}
          className={`flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 text-sm font-black ${
            isSharingLocation
              ? "border-2 border-emerald-500 bg-emerald-500/15 text-emerald-300"
              : "bg-[#D6A84F] text-[#0B0B0D]"
          }`}
        >
          {isSharingLocation ? (
            <>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              Canlı Konum Paylaşılıyor
            </>
          ) : (
            <>
              <Navigation size={19} />

              {isRequestingGeo
                ? "GPS İzni İsteniyor..."
                : "Konumumu Paylaş"}
            </>
          )}
        </button>

        {courierLoc &&
          isSharingLocation && (
            <div className="mt-3 rounded-xl border border-[#303036] bg-[#0B0B0D] p-3 font-mono text-[11px]">
              📍{" "}
              {Number(
                courierLoc.latitude
              ).toFixed(4)}
              ,{" "}
              {Number(
                courierLoc.longitude
              ).toFixed(4)}
            </div>
          )}

        {geoError && (
          <div className="mt-3 flex gap-2 rounded-xl border border-red-500/30 bg-red-500/15 p-3 text-xs text-red-300">
            <AlertCircle
              size={16}
              className="shrink-0"
            />

            {geoError}
          </div>
        )}
      </div>

      <div className="flex gap-2 border-b border-[#303036] pb-2">
        <button
          type="button"
          onClick={() =>
            setActiveTab("active")
          }
          className={`rounded-xl px-4 py-2 text-xs font-bold ${
            activeTab === "active"
              ? "bg-[#D6A84F] text-[#0B0B0D]"
              : "bg-[#19191E] text-[#999999]"
          }`}
        >
          Aktif Siparişler (
          {activeOrders.length})
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveTab("history")
          }
          className={`rounded-xl px-4 py-2 text-xs font-bold ${
            activeTab === "history"
              ? "bg-[#D6A84F] text-[#0B0B0D]"
              : "bg-[#19191E] text-[#999999]"
          }`}
        >
          Geçmiş (
          {completedOrders.length})
        </button>
      </div>

      {activeTab === "active" && (
        <div className="space-y-4">
          {activeOrders.length === 0 ? (
            <div className="rounded-3xl border border-[#303036] bg-[#19191E] p-12 text-center">
              <Truck
                size={45}
                className="mx-auto text-[#999999]/30"
              />

              <h3 className="mt-3 font-bold text-white">
                Aktif Sipariş Yok
              </h3>

              <p className="mt-1 text-xs text-[#999999]">
                Yönetici size yeni bir
                sipariş atadığında burada
                görünecektir.
              </p>
            </div>
          ) : (
            activeOrders.map((order) => {
              const action =
                getAction(order.status);

              const currentIndex =
                FLOW.indexOf(
                  order.status
                );

              return (
                <div
                  key={order.id}
                  className="space-y-4 rounded-3xl border-2 border-[#D6A84F]/50 bg-[#19191E] p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#D6A84F]">
                        #{order.id}
                      </span>

                      <span className="text-xs font-bold text-white">
                        {order.courierType ||
                          "Standart Kurye"}
                      </span>
                    </div>

                    <span className="text-base font-extrabold text-[#D6A84F]">
                      {Number(
                        order.price || 0
                      )}{" "}
                      TL
                    </span>
                  </div>

                  <div className="rounded-2xl border border-[#303036] bg-[#0B0B0D] p-3">
                    <span className="mb-2 block text-[10px] font-bold uppercase text-[#999999]">
                      Sipariş Aşaması
                    </span>

                    <div className="grid grid-cols-6 gap-1 text-center">
                      {FLOW.map(
                        (step, index) => {
                          const done =
                            currentIndex >=
                            index;

                          const current =
                            currentIndex ===
                            index;

                          return (
                            <div
                              key={step}
                              className="flex min-w-0 flex-col items-center"
                            >
                              <div
                                className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${
                                  current
                                    ? "bg-[#D6A84F] text-[#0B0B0D]"
                                    : done
                                    ? "bg-emerald-500 text-white"
                                    : "bg-[#19191E] text-[#999999]"
                                }`}
                              >
                                {done
                                  ? "✓"
                                  : index +
                                    1}
                              </div>

                              <span className="mt-1 w-full truncate text-[8px] text-[#999999]">
                                {step
                                  .replace(
                                    "Kurye ",
                                    ""
                                  )
                                  .replace(
                                    "Paket ",
                                    ""
                                  )}
                              </span>
                            </div>
                          );
                        }
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-[#303036] bg-[#222229] p-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/20 text-sky-400">
                        <User size={16} />
                      </div>

                      <div>
                        <span className="block text-[10px] text-[#999999]">
                          Müşteri
                        </span>

                        <h4 className="text-xs font-bold text-white">
                          {order.customerName ||
                            "Müşteri"}
                        </h4>
                      </div>
                    </div>

                    {order.customerPhone && (
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="flex items-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-bold text-emerald-400"
                      >
                        <Phone size={15} />
                        Ara
                      </a>
                    )}
                  </div>

                  <div className="space-y-3 rounded-2xl border border-[#303036] bg-[#0B0B0D] p-4">
                    <div className="flex items-start gap-2.5">
                      <MapPin
                        size={16}
                        className="shrink-0 text-[#D6A84F]"
                      />

                      <div>
                        <span className="block text-[10px] font-bold uppercase text-[#999999]">
                          Alınacak Adres
                        </span>

                        <p className="mt-0.5 text-xs text-white">
                          {order.pickupAddress ||
                            "Adres belirtilmemiş"}
                        </p>
                      </div>
                    </div>

                    <div className="ml-2 h-4 border-l-2 border-dashed border-[#303036]" />

                    <div className="flex items-start gap-2.5">
                      <Navigation
                        size={16}
                        className="shrink-0 text-emerald-400"
                      />

                      <div>
                        <span className="block text-[10px] font-bold uppercase text-[#999999]">
                          Teslim Adresi
                        </span>

                        <p className="mt-0.5 text-xs text-white">
                          {order.deliveryAddress ||
                            "Adres belirtilmemiş"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 text-xs text-[#999999]">
                    <span>
                      Paket:{" "}
                      <b className="text-white">
                        {order.packageType ||
                          "-"}
                      </b>
                    </span>

                    <span>
                      Mesafe:{" "}
                      <b className="text-white">
                        {Number(
                          order.distanceKm ||
                            0
                        )}{" "}
                        KM
                      </b>
                    </span>

                    <span>
                      Fiyat:{" "}
                      <b className="text-[#D6A84F]">
                        {Number(
                          order.price || 0
                        )}{" "}
                        TL
                      </b>
                    </span>
                  </div>

                  {order.note && (
                    <div className="rounded-2xl border border-[#303036] bg-[#222229] p-3 text-xs text-amber-200">
                      <b className="text-white">
                        Müşteri Notu:
                      </b>{" "}
                      {order.note}
                    </div>
                  )}

                  {action && (
                    <button
                      type="button"
                      onClick={() =>
                        updateOrderStatus(
                          order.id,
                          action.status
                        )
                      }
                      className={`flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-base font-black ${action.className}`}
                    >
                      <CheckCircle2
                        size={20}
                      />

                      {action.label}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-3">
          {completedOrders.length ===
          0 ? (
            <div className="rounded-3xl border border-[#303036] bg-[#19191E] p-12 text-center text-xs text-[#999999]">
              Henüz tamamlanan
              teslimatınız bulunmuyor.
            </div>
          ) : (
            completedOrders.map((order) => {
              const expanded =
                expandedHistoryId ===
                order.id;

              const pickup =
                order.pickupAddress ||
                "Alış adresi";

              const delivery =
                order.deliveryAddress ||
                "Teslim adresi";

              return (
                <div
                  key={order.id}
                  className="space-y-3 rounded-2xl border border-[#303036] bg-[#19191E] p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white">
                          #{order.id}
                        </span>

                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                          Teslim Edildi
                        </span>
                      </div>

                      <p className="max-w-xs truncate text-xs text-slate-300">
                        {pickup.split(",")[0]}{" "}
                        →{" "}
                        {delivery.split(",")[0]}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="block text-sm font-extrabold text-[#D6A84F]">
                        {Number(
                          order.price || 0
                        )}{" "}
                        TL
                      </span>

                      <span className="block text-[10px] text-emerald-400">
                        +
                        {Math.round(
                          Number(
                            order.price || 0
                          ) * 0.7
                        )}{" "}
                        TL
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          setExpandedHistoryId(
                            expanded
                              ? null
                              : order.id
                          )
                        }
                        className="text-[11px] font-bold text-[#D6A84F]"
                      >
                        {expanded
                          ? "Kanıtı Gizle"
                          : "Kanıtı İncele"}
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t border-[#303036] pt-3">
                      <DeliveryProofCard
                        order={order}
                      />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {proofOrder && (
        <DeliveryProofModal
          order={proofOrder}
          onClose={() =>
            setProofOrder(null)
          }
          onSubmit={
            handleProofSubmit
          }
        />
      )}
    </div>
  );
};

export default CourierPanel;