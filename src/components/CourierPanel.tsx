import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  Navigation,
  Phone,
  Radio,
  Star,
  Truck,
  User,
  Wallet,
  Zap,
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
  currentCourier: UserProfile;
  orders: Order[];
}

const FLOW: OrderStatus[] = [
  "Kurye Bekleniyor",
  "Kurye Atandı",
  "Kurye Kabul Etti",
  "Paket Alındı",
  "Teslimatta",
  "Teslim Edildi",
];

const getStatusLabel = (status: OrderStatus) => {
  switch (status) {
    case "Kurye Bekleniyor":
      return "Bekleniyor";
    case "Kurye Atandı":
      return "Atandı";
    case "Kurye Kabul Etti":
      return "Kabul";
    case "Paket Alındı":
      return "Paket Alındı";
    case "Teslimatta":
      return "Teslimatta";
    case "Teslim Edildi":
      return "Teslim Edildi";
    default:
      return status;
  }
};

const formatTime = (value?: string) => {
  if (!value) return "--:--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const CourierPanel: React.FC<Props> = ({
  currentCourier,
  orders,
}) => {
  const [activeTab, setActiveTab] =
    useState<"active" | "history">("active");

  const [courierStatus, setCourierStatus] =
    useState<CourierAvailability>(
      currentCourier.courierStatus || "Müsait"
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

  const [updatingOrderId, setUpdatingOrderId] =
    useState<string | null>(null);

  const watchIdRef =
    useRef<number | null>(null);

  /*
   * ==========================================
   * LIVE FIREBASE DATA
   * ==========================================
   */

  useEffect(() => {
    const sync = () => {
      const user =
        storage.getUserById(currentCourier.id);

      if (user) {
        setCourierStatus(
          user.courierStatus || "Müsait"
        );
      }

      const location =
        storage.getCourierLocation(
          currentCourier.id
        );

      setCourierLoc(location);

      setIsSharingLocation(
        Boolean(location?.isSharing)
      );
    };

    sync();

    const unsubscribe =
      storage.subscribe(sync);

    return () => {
      unsubscribe?.();

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
  }, [currentCourier.id]);

  /*
   * ==========================================
   * ORDERS
   * ==========================================
   */

  const myOrders = orders.filter(
    (order) =>
      order.courierId === currentCourier.id
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

  const todayKey =
    new Date().toLocaleDateString("tr-TR");

  const todayCompletedOrders =
    completedOrders.filter((order) => {
      if (!order.deliveredAt) return false;

      const date = new Date(order.deliveredAt);

      if (Number.isNaN(date.getTime())) {
        return false;
      }

      return (
        date.toLocaleDateString("tr-TR") ===
        todayKey
      );
    });

  const todayEarnings =
    todayCompletedOrders.reduce(
      (sum, order) =>
        sum +
        Math.round(
          Number(order.price || 0) * 0.7
        ),
      0
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

  const rating =
    currentCourier.rating ?? 5;

  const totalDeliveries =
    currentCourier.totalDeliveries ??
    completedOrders.length;

  /*
   * ==========================================
   * COURIER STATUS
   * ==========================================
   */

  const handleCourierStatus = async (
    status: CourierAvailability
  ) => {
    try {
      await storage.updateCourierStatus(
        currentCourier.id,
        status
      );

      setCourierStatus(status);
    } catch (error) {
      console.error(
        "Kurye durumu değiştirilemedi:",
        error
      );
    }
  };

  /*
   * ==========================================
   * LIVE GPS
   * ==========================================
   */

  const handleLocationToggle = async () => {
    try {
      /*
       * STOP LOCATION SHARING
       */

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

        const existing =
          storage.getCourierLocation(
            currentCourier.id
          );

        if (existing) {
          const stopped =
            await storage.updateCourierLocation({
              courierId:
                currentCourier.id,
              latitude:
                existing.latitude,
              longitude:
                existing.longitude,
              updatedAt:
                new Date().toISOString(),
              isSharing: false,
            });

          setCourierLoc(stopped);
        }

        setIsSharingLocation(false);
        setGeoError(null);

        return;
      }

      /*
       * GEOLOCATION CHECK
       */

      if (!("geolocation" in navigator)) {
        setGeoError(
          "Cihazınız GPS servisini desteklemiyor."
        );

        return;
      }

      setIsRequestingGeo(true);
      setGeoError(null);

      /*
       * GET CURRENT LOCATION
       */

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            setIsRequestingGeo(false);

            const {
              latitude,
              longitude,
            } = position.coords;

            /*
             * SAVE FIRST LOCATION
             */

            const updated =
              await storage.updateCourierLocation({
                courierId:
                  currentCourier.id,
                latitude,
                longitude,
                updatedAt:
                  new Date().toISOString(),
                isSharing: true,
              });

            setCourierLoc(updated);
            setIsSharingLocation(true);

            /*
             * START LIVE TRACKING
             */

            watchIdRef.current =
              navigator.geolocation.watchPosition(
                async (nextPosition) => {
                  try {
                    const next =
                      await storage.updateCourierLocation({
                        courierId:
                          currentCourier.id,
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
                      "GPS konumu Firebase'e kaydedilemedi:",
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
              "Konum Firebase'e kaydedilemedi."
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
            error.code ===
            error.TIMEOUT
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
    } catch (error) {
      console.error(
        "Konum paylaşım hatası:",
        error
      );

      setIsRequestingGeo(false);

      setGeoError(
        "Konum işlemi gerçekleştirilemedi."
      );
    }
  };

  /*
   * ==========================================
   * ORDER STATUS
   * ==========================================
   */

  const updateOrderStatus = async (
    orderId: string,
    nextStatus: OrderStatus
  ) => {
    if (updatingOrderId) return;

    try {
      if (
        nextStatus === "Teslim Edildi"
      ) {
        const order =
          orders.find(
            (item) =>
              item.id === orderId
          );

        if (order) {
          setProofOrder(order);
        }

        return;
      }

      setUpdatingOrderId(orderId);

      await storage.updateOrderStatus(
        orderId,
        nextStatus
      );
    } catch (error) {
      console.error(
        "Sipariş durumu güncellenemedi:",
        error
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  /*
   * ==========================================
   * ACTION
   * ==========================================
   */

  const getAction = (
    status: OrderStatus
  ) => {
    switch (status) {
      case "Kurye Atandı":
        return {
          status:
            "Kurye Kabul Etti" as OrderStatus,
          label: "Siparişi Kabul Et",
          icon: CheckCircle2,
          className:
            "bg-[#D6A84F] text-[#0B0B0D]",
        };

      case "Kurye Kabul Etti":
        return {
          status:
            "Paket Alındı" as OrderStatus,
          label: "Paketi Aldım",
          icon: PackageIcon,
          className:
            "bg-purple-600 text-white",
        };

      case "Paket Alındı":
        return {
          status:
            "Teslimatta" as OrderStatus,
          label: "Teslimata Başla",
          icon: Navigation,
          className:
            "bg-blue-600 text-white",
        };

      case "Teslimatta":
        return {
          status:
            "Teslim Edildi" as OrderStatus,
          label: "Teslimatı Tamamla",
          icon: CheckCircle2,
          className:
            "bg-emerald-600 text-white",
        };

      default:
        return null;
    }
  };

  /*
   * ==========================================
   * DELIVERY PROOF
   * ==========================================
   */

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
      await saveDeliveryProof({
        orderId:
          proofOrder.id,
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
    }
  };

  /*
   * ==========================================
   * RENDER
   * ==========================================
   */

  return (
    <div className="space-y-5 pb-24">

      {/* =====================================
          PREMIUM HEADER
          ===================================== */}

      <section className="relative overflow-hidden rounded-[28px] border border-[#303036] bg-[#151519] p-5 shadow-2xl">

        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#D6A84F]/10 blur-3xl" />

        <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="relative">

          <div className="flex flex-col gap-5">

            <div className="flex items-center justify-between gap-3">

              <div className="flex items-center gap-3">

                <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-[#D6A84F]/30 bg-[#D6A84F]/10">

                  {currentCourier.avatar ? (
                    <img
                      src={currentCourier.avatar}
                      alt={currentCourier.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Truck
                      size={27}
                      className="text-[#D6A84F]"
                    />
                  )}

                  <span className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-full border-2 border-[#151519] bg-emerald-400" />

                </div>

                <div>

                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#999999]">
                    Kurye Paneli
                  </span>

                  <h2 className="mt-0.5 text-xl font-black text-white">
                    Merhaba,{" "}
                    {currentCourier.name.split(" ")[0]}
                  </h2>

                  <div className="mt-1 flex items-center gap-2">

                    <span className="font-mono text-[10px] text-[#D6A84F]">
                      {currentCourier.plate ||
                        "PLAKA YOK"}
                    </span>

                    <span className="text-[#55555C]">
                      •
                    </span>

                    <span className="text-[10px] text-[#999999]">
                      {currentCourier.vehicle ||
                        "Kurye"}
                    </span>

                  </div>

                </div>

              </div>

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#303036] bg-[#0B0B0D]">

                <Truck
                  size={20}
                  className="text-[#D6A84F]"
                />

              </div>

            </div>

            {/* STATUS */}

            <div>

              <div className="mb-2 flex items-center justify-between">

                <span className="text-[10px] font-bold uppercase tracking-wider text-[#999999]">
                  Çalışma Durumu
                </span>

                <span
                  className={`flex items-center gap-1.5 text-[10px] font-bold ${
                    courierStatus === "Müsait"
                      ? "text-emerald-400"
                      : courierStatus === "Meşgul"
                      ? "text-amber-400"
                      : "text-red-400"
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {courierStatus}
                </span>

              </div>

              <div className="grid grid-cols-3 gap-1.5 rounded-2xl border border-[#303036] bg-[#0B0B0D] p-1.5">

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
                        void handleCourierStatus(
                          status
                        )
                      }
                      className={`rounded-xl px-2 py-2.5 text-[10px] font-bold transition ${
                        selected
                          ? status === "Müsait"
                            ? "bg-emerald-500 text-white"
                            : status === "Meşgul"
                            ? "bg-amber-500 text-[#0B0B0D]"
                            : "bg-red-500 text-white"
                          : "text-[#77777F]"
                      }`}
                    >
                      {status}
                    </button>
                  );
                })}

              </div>

            </div>

          </div>

          {/* PERFORMANCE STATS */}

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">

            <div className="rounded-2xl border border-[#303036] bg-[#202025] p-3">

              <div className="mb-2 flex items-center justify-between">

                <span className="text-[9px] uppercase tracking-wider text-[#77777F]">
                  Aktif
                </span>

                <Truck
                  size={14}
                  className="text-[#D6A84F]"
                />

              </div>

              <b className="text-xl font-black text-white">
                {activeOrders.length}
              </b>

              <span className="ml-1 text-[10px] text-[#77777F]">
                görev
              </span>

            </div>

            <div className="rounded-2xl border border-[#303036] bg-[#202025] p-3">

              <div className="mb-2 flex items-center justify-between">

                <span className="text-[9px] uppercase tracking-wider text-[#77777F]">
                  Bugün
                </span>

                <CheckCircle2
                  size={14}
                  className="text-emerald-400"
                />

              </div>

              <b className="text-xl font-black text-emerald-400">
                {todayCompletedOrders.length}
              </b>

              <span className="ml-1 text-[10px] text-[#77777F]">
                teslimat
              </span>

            </div>

            <div className="rounded-2xl border border-[#303036] bg-[#202025] p-3">

              <div className="mb-2 flex items-center justify-between">

                <span className="text-[9px] uppercase tracking-wider text-[#77777F]">
                  Puan
                </span>

                <Star
                  size={14}
                  className="text-[#D6A84F]"
                />

              </div>

              <b className="text-xl font-black text-[#D6A84F]">
                {Number(rating).toFixed(1)}
              </b>

              <span className="ml-1 text-[10px] text-[#77777F]">
                / 5
              </span>

            </div>

            <div className="rounded-2xl border border-[#303036] bg-[#202025] p-3">

              <div className="mb-2 flex items-center justify-between">

                <span className="text-[9px] uppercase tracking-wider text-[#77777F]">
                  Hakediş
                </span>

                <Wallet
                  size={14}
                  className="text-[#D6A84F]"
                />

              </div>

              <b className="text-xl font-black text-white">
                {todayEarnings}
              </b>

              <span className="ml-1 text-[10px] text-[#77777F]">
                TL bugün
              </span>

            </div>

          </div>

        </div>

      </section>

      {/* =====================================
          GPS
          ===================================== */}

      <section className="overflow-hidden rounded-[28px] border border-[#303036] bg-[#19191E] shadow-xl">

        <div className="border-b border-[#303036] p-4">

          <div className="flex items-center justify-between gap-3">

            <div className="flex items-center gap-3">

              <div
                className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                  isSharingLocation
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-[#222229] text-[#77777F]"
                }`}
              >
                <Radio size={18} />
              </div>

              <div>

                <div className="flex items-center gap-2">

                  <h3 className="text-sm font-black text-white">
                    Canlı GPS
                  </h3>

                  {isSharingLocation && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      CANLI
                    </span>
                  )}

                </div>

                <p className="mt-0.5 text-[10px] text-[#77777F]">
                  {isSharingLocation
                    ? "Müşteri konumunuzu canlı görebilir."
                    : "Teslimat takibi için konumunuzu paylaşın."}
                </p>

              </div>

            </div>

          </div>

        </div>

        <div className="p-4">

          <button
            type="button"
            onClick={() =>
              void handleLocationToggle()
            }
            disabled={isRequestingGeo}
            className={`flex min-h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl px-5 py-4 text-sm font-black transition ${
              isSharingLocation
                ? "border border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                : "bg-[#D6A84F] text-[#0B0B0D]"
            }`}
          >

            {isSharingLocation ? (
              <>
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400" />
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
              <div className="mt-3 flex items-center justify-between rounded-2xl border border-[#303036] bg-[#0B0B0D] p-3">

                <div className="flex items-center gap-2">

                  <MapPin
                    size={14}
                    className="text-emerald-400"
                  />

                  <span className="text-[10px] text-[#77777F]">
                    Konum
                  </span>

                </div>

                <span className="font-mono text-[10px] text-white">
                  {courierLoc.latitude.toFixed(4)}
                  {" , "}
                  {courierLoc.longitude.toFixed(4)}
                </span>

              </div>
            )}

          {geoError && (
            <div className="mt-3 flex gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">

              <AlertCircle
                size={16}
                className="shrink-0"
              />

              <span>{geoError}</span>

            </div>
          )}

        </div>

      </section>

      {/* =====================================
          EARNINGS MINI CARD
          ===================================== */}

      <section className="rounded-[28px] border border-[#D6A84F]/20 bg-gradient-to-br from-[#211E18] to-[#19191E] p-4">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#D6A84F]/10 text-[#D6A84F]">
              <Wallet size={18} />
            </div>

            <div>

              <span className="block text-[9px] uppercase tracking-wider text-[#77777F]">
                Toplam Hakediş
              </span>

              <b className="text-xl font-black text-white">
                {totalEarnings} TL
              </b>

            </div>

          </div>

          <div className="text-right">

            <span className="block text-[9px] text-[#77777F]">
              Toplam teslimat
            </span>

            <b className="text-sm text-[#D6A84F]">
              {totalDeliveries}
            </b>

          </div>

        </div>

      </section>

      {/* =====================================
          TABS
          ===================================== */}

      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#303036] bg-[#0B0B0D] p-1.5">

        <button
          type="button"
          onClick={() =>
            setActiveTab("active")
          }
          className={`rounded-xl px-4 py-3 text-xs font-black transition ${
            activeTab === "active"
              ? "bg-[#D6A84F] text-[#0B0B0D]"
              : "text-[#77777F]"
          }`}
        >
          Aktif Görevler
          <span className="ml-1 opacity-70">
            ({activeOrders.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveTab("history")
          }
          className={`rounded-xl px-4 py-3 text-xs font-black transition ${
            activeTab === "history"
              ? "bg-[#D6A84F] text-[#0B0B0D]"
              : "text-[#77777F]"
          }`}
        >
          Geçmiş
          <span className="ml-1 opacity-70">
            ({completedOrders.length})
          </span>
        </button>

      </div>

      {/* =====================================
          ACTIVE ORDERS
          ===================================== */}

      {activeTab === "active" && (
        <div className="space-y-4">

          {activeOrders.length === 0 ? (

            <div className="rounded-[28px] border border-[#303036] bg-[#19191E] p-12 text-center">

              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#222229]">
                <Truck
                  size={30}
                  className="text-[#55555C]"
                />
              </div>

              <h3 className="mt-4 font-black text-white">
                Aktif Görev Yok
              </h3>

              <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[#77777F]">
                Yönetici size yeni bir sipariş
                atadığında görev burada
                görünecektir.
              </p>

              <div className="mx-auto mt-4 flex w-fit items-center gap-1.5 rounded-full border border-[#303036] bg-[#0B0B0D] px-3 py-1.5 text-[9px] font-bold text-[#77777F]">
                <Clock3 size={12} />
                Yeni görev bekleniyor
              </div>

            </div>

          ) : (

            activeOrders.map((order) => {

              const action =
                getAction(order.status);

              const currentIndex =
                FLOW.indexOf(order.status);

              const isUpdating =
                updatingOrderId === order.id;

              const ActionIcon =
                action?.icon;

              return (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-[28px] border border-[#D6A84F]/35 bg-[#19191E] shadow-xl"
                >

                  {/* ORDER TOP */}

                  <div className="border-b border-[#303036] bg-gradient-to-r from-[#201E19] to-[#19191E] p-5">

                    <div className="flex items-center justify-between gap-3">

                      <div>

                        <div className="flex items-center gap-2">

                          <span className="font-mono text-xs font-black text-[#D6A84F]">
                            #{order.id}
                          </span>

                          <span className="rounded-full border border-[#303036] bg-[#0B0B0D] px-2 py-1 text-[9px] font-bold text-[#999999]">
                            {order.courierType}
                          </span>

                        </div>

                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#77777F]">
                          <Clock3 size={12} />
                          Oluşturulma:{" "}
                          {formatTime(
                            order.createdAt
                          )}
                        </div>

                      </div>

                      <div className="text-right">

                        <span className="block text-[9px] uppercase tracking-wider text-[#77777F]">
                          Sipariş
                        </span>

                        <b className="text-xl font-black text-[#D6A84F]">
                          {order.price} TL
                        </b>

                        <span className="block text-[9px] text-[#77777F]">
                          hakediş ≈{" "}
                          {Math.round(
                            Number(
                              order.price || 0
                            ) * 0.7
                          )} TL
                        </span>

                      </div>

                    </div>

                  </div>

                  {/* PROGRESS */}

                  <div className="p-4">

                    <div className="mb-2 flex items-center justify-between">

                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#77777F]">
                        Teslimat Durumu
                      </span>

                      <span className="text-[9px] font-bold text-[#D6A84F]">
                        {getStatusLabel(
                          order.status
                        )}
                      </span>

                    </div>

                    <div className="rounded-2xl border border-[#303036] bg-[#0B0B0D] p-3">

                      <div className="grid grid-cols-6 gap-1">

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
                                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[9px] font-black ${
                                    current
                                      ? "bg-[#D6A84F] text-[#0B0B0D] shadow-lg shadow-[#D6A84F]/20"
                                      : done
                                      ? "bg-emerald-500 text-white"
                                      : "border border-[#303036] bg-[#19191E] text-[#55555C]"
                                  }`}
                                >
                                  {done
                                    ? "✓"
                                    : index +
                                      1}
                                </div>

                                <span
                                  className={`mt-1 w-full truncate text-center text-[7px] ${
                                    current
                                      ? "font-bold text-[#D6A84F]"
                                      : "text-[#55555C]"
                                  }`}
                                >
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

                  </div>

                  {/* CUSTOMER */}

                  <div className="px-4">

                    <div className="flex items-center justify-between rounded-2xl border border-[#303036] bg-[#222229] p-3.5">

                      <div className="flex items-center gap-3">

                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-500/10 text-sky-400">
                          <User size={17} />
                        </div>

                        <div>

                          <span className="block text-[9px] uppercase tracking-wider text-[#77777F]">
                            Müşteri
                          </span>

                          <h4 className="text-xs font-black text-white">
                            {order.customerName}
                          </h4>

                        </div>

                      </div>

                      {order.customerPhone && (
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 py-2.5 text-xs font-black text-emerald-400"
                        >
                          <Phone size={15} />
                          Ara
                        </a>
                      )}

                    </div>

                  </div>

                  {/* ROUTE */}

                  <div className="p-4">

                    <div className="space-y-0 rounded-2xl border border-[#303036] bg-[#0B0B0D] p-4">

                      <div className="flex items-start gap-3">

                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#D6A84F]/10 text-[#D6A84F]">
                          <MapPin size={15} />
                        </div>

                        <div className="min-w-0">

                          <span className="block text-[9px] font-black uppercase tracking-wider text-[#77777F]">
                            01 • Paketi Al
                          </span>

                          <p className="mt-1 text-xs leading-5 text-white">
                            {order.pickupAddress}
                          </p>

                        </div>

                      </div>

                      <div className="ml-4 h-5 border-l border-dashed border-[#3A3A42]" />

                      <div className="flex items-start gap-3">

                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                          <Navigation size={15} />
                        </div>

                        <div className="min-w-0">

                          <span className="block text-[9px] font-black uppercase tracking-wider text-[#77777F]">
                            02 • Teslim Et
                          </span>

                          <p className="mt-1 text-xs leading-5 text-white">
                            {order.deliveryAddress}
                          </p>

                        </div>

                      </div>

                    </div>

                  </div>

                  {/* INFO GRID */}

                  <div className="grid grid-cols-3 gap-2 px-4">

                    <div className="rounded-2xl border border-[#303036] bg-[#222229] p-3 text-center">

                      <span className="block text-[8px] uppercase text-[#77777F]">
                        Paket
                      </span>

                      <b className="mt-1 block truncate text-[10px] text-white">
                        {order.packageType}
                      </b>

                    </div>

                    <div className="rounded-2xl border border-[#303036] bg-[#222229] p-3 text-center">

                      <span className="block text-[8px] uppercase text-[#77777F]">
                        Mesafe
                      </span>

                      <b className="mt-1 block text-[10px] text-white">
                        {order.distanceKm} KM
                      </b>

                    </div>

                    <div className="rounded-2xl border border-[#303036] bg-[#222229] p-3 text-center">

                      <span className="block text-[8px] uppercase text-[#77777F]">
                        Aciliyet
                      </span>

                      <b className="mt-1 block truncate text-[10px] text-[#D6A84F]">
                        {order.urgency}
                      </b>

                    </div>

                  </div>

                  {/* NOTE */}

                  {order.note && (
                    <div className="px-4 pt-4">

                      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">

                        <div className="mb-1 flex items-center gap-1.5">

                          <Zap
                            size={12}
                            className="text-amber-400"
                          />

                          <b className="text-[9px] uppercase tracking-wider text-amber-300">
                            Müşteri Notu
                          </b>

                        </div>

                        <p className="text-xs leading-5 text-amber-100">
                          {order.note}
                        </p>

                      </div>

                    </div>
                  )}

                  {/* ACTION */}

                  {action && (
                    <div className="p-4">

                      <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() =>
                          void updateOrderStatus(
                            order.id,
                            action.status
                          )
                        }
                        className={`flex min-h-[56px] w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-4 text-sm font-black shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 ${action.className}`}
                      >

                        {isUpdating ? (
                          <>
                            <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Güncelleniyor...
                          </>
                        ) : (
                          <>
                            {ActionIcon && (
                              <ActionIcon size={20} />
                            )}

                            {action.label}

                            <ChevronRight
                              size={18}
                            />
                          </>
                        )}

                      </button>

                    </div>
                  )}

                </article>
              );
            })

          )}

        </div>
      )}

      {/* =====================================
          HISTORY
          ===================================== */}

      {activeTab === "history" && (
        <div className="space-y-3">

          {completedOrders.length === 0 ? (

            <div className="rounded-[28px] border border-[#303036] bg-[#19191E] p-12 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#222229]">
                <Clock3
                  size={25}
                  className="text-[#55555C]"
                />
              </div>

              <h3 className="mt-4 font-black text-white">
                Henüz Teslimat Yok
              </h3>

              <p className="mt-1 text-xs text-[#77777F]">
                Tamamladığınız teslimatlar
                burada görünecek.
              </p>

            </div>

          ) : (

            completedOrders.map((order) => {

              const expanded =
                expandedHistoryId === order.id;

              const earning =
                Math.round(
                  Number(order.price || 0) *
                    0.7
                );

              return (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-2xl border border-[#303036] bg-[#19191E]"
                >

                  <button
                    type="button"
                    onClick={() =>
                      setExpandedHistoryId(
                        expanded
                          ? null
                          : order.id
                      )
                    }
                    className="w-full p-4 text-left"
                  >

                    <div className="flex items-center justify-between gap-3">

                      <div className="min-w-0">

                        <div className="mb-1 flex items-center gap-2">

                          <span className="font-mono text-xs font-black text-white">
                            #{order.id}
                          </span>

                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[9px] font-bold text-emerald-400">
                            <CheckCircle2
                              size={10}
                            />
                            Teslim Edildi
                          </span>

                        </div>

                        <p className="max-w-[230px] truncate text-xs text-[#999999]">
                          {order.pickupAddress
                            .split(",")[0]}{" "}
                          →{" "}
                          {order.deliveryAddress
                            .split(",")[0]}
                        </p>

                        <span className="mt-1 block text-[9px] text-[#55555C]">
                          {formatTime(
                            order.deliveredAt
                          )}
                        </span>

                      </div>

                      <div className="text-right">

                        <span className="block text-base font-black text-[#D6A84F]">
                          +{earning} TL
                        </span>

                        <span className="mt-1 block text-[9px] text-[#55555C]">
                          Hakediş
                        </span>

                        <ChevronRight
                          size={15}
                          className={`ml-auto mt-2 text-[#77777F] transition ${
                            expanded
                              ? "rotate-90"
                              : ""
                          }`}
                        />

                      </div>

                    </div>

                  </button>

                  {expanded && (
                    <div className="border-t border-[#303036] p-4">

                      <div className="mb-3 grid grid-cols-2 gap-2">

                        <div className="rounded-xl bg-[#222229] p-3">

                          <span className="block text-[9px] text-[#77777F]">
                            Müşteri
                          </span>

                          <b className="mt-1 block truncate text-xs text-white">
                            {order.customerName}
                          </b>

                        </div>

                        <div className="rounded-xl bg-[#222229] p-3">

                          <span className="block text-[9px] text-[#77777F]">
                            Sipariş Tutarı
                          </span>

                          <b className="mt-1 block text-xs text-white">
                            {order.price} TL
                          </b>

                        </div>

                      </div>

                      <DeliveryProofCard
                        order={order}
                      />

                    </div>
                  )}

                </article>
              );
            })

          )}

        </div>
      )}

      {/* =====================================
          DELIVERY PROOF MODAL
          ===================================== */}

      {proofOrder && (
        <DeliveryProofModal
          order={proofOrder}
          onClose={() =>
            setProofOrder(null)
          }
          onSubmit={handleProofSubmit}
        />
      )}

    </div>
  );
};

/*
 * Küçük paket ikonu.
 * Yeni dependency eklemeden lucide tarzında
 * basit bir SVG ikon kullanıyoruz.
 */

const PackageIcon: React.FC<{
  size?: number;
}> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m16.5 9.4-9-5.19" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.27 6.96 8.73 5.05 8.73-5.05" />
    <path d="M12 22.08V12" />
  </svg>
);