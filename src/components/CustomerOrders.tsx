import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CheckCircle2,
  Clock,
  Info,
  MapPin,
  Navigation,
  Package,
  Phone,
  Radio,
  Search,
  Truck,
  User,
  XCircle,
  ChevronDown,
  RefreshCw,
} from "lucide-react";

import type {
  CourierLocation,
  Order,
  OrderStatus,
} from "../types";

import { storage } from "../services/storage";

import {
  type GeoCoordinate,
  mapService,
} from "../services/mapService";

import { RouteMap } from "./RouteMap";
import { DeliveryProofCard } from "./DeliveryProofCard";

interface Props {
  orders: Order[];
  onOpenNewOrder: () => void;
  selectedOrderId?: string | null;
}

const ACTIVE_STATUSES: OrderStatus[] = [
  "Kurye Bekleniyor",
  "Kurye Atandı",
  "Kurye Kabul Etti",
  "Paket Alındı",
  "Teslimatta",
];

const STATUS_STEPS: OrderStatus[] = [
  "Kurye Bekleniyor",
  "Kurye Atandı",
  "Kurye Kabul Etti",
  "Paket Alındı",
  "Teslimatta",
  "Teslim Edildi",
];

const getStatusStepIndex = (
  status: OrderStatus
) => {
  return STATUS_STEPS.indexOf(status);
};

const formatDate = (date: string) => {
  try {
    return new Date(date).toLocaleDateString(
      "tr-TR",
      {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  } catch {
    return "-";
  }
};

const formatTime = (date: string) => {
  try {
    return new Date(date).toLocaleTimeString(
      "tr-TR",
      {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }
    );
  } catch {
    return "-";
  }
};

const OrderTrackingCard: React.FC<{
  order: Order;
}> = ({ order }) => {
  const [courierLocation, setCourierLocation] =
    useState<CourierLocation | undefined>(
      undefined
    );

  const [pickupCoords, setPickupCoords] =
    useState<GeoCoordinate | null>(null);

  const [deliveryCoords, setDeliveryCoords] =
    useState<GeoCoordinate | null>(null);

  const [routePoints, setRoutePoints] =
    useState<[number, number][]>([]);

  const [locationLoading, setLocationLoading] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    if (!order.courierId) {
      setCourierLocation(undefined);
      return;
    }

    const loadLocation = async () => {
      try {
        setLocationLoading(true);

        const location =
          await Promise.resolve(
            storage.getCourierLocation(
              order.courierId as string
            )
          );

        if (mounted) {
          setCourierLocation(
            location || undefined
          );
        }
      } catch (error) {
        console.warn(
          "Kurye konumu alınamadı:",
          error
        );
      } finally {
        if (mounted) {
          setLocationLoading(false);
        }
      }
    };

    loadLocation();

    let unsubscribe:
      | (() => void)
      | undefined;

    try {
      unsubscribe = storage.subscribe(
        loadLocation
      );
    } catch (error) {
      console.warn(
        "Kurye konum listener kurulamadı:",
        error
      );
    }

    mapService
      .calculateDistance(
        order.pickupAddress,
        order.deliveryAddress
      )
      .then((result) => {
        if (!mounted) return;

        if (result.pickupCoords) {
          setPickupCoords(
            result.pickupCoords
          );
        }

        if (result.deliveryCoords) {
          setDeliveryCoords(
            result.deliveryCoords
          );
        }

        if (
          result.routePoints &&
          result.routePoints.length > 0
        ) {
          setRoutePoints(
            result.routePoints
          );
        }
      })
      .catch((error) => {
        console.warn(
          "Rota bilgisi alınamadı:",
          error
        );
      });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [
    order.courierId,
    order.pickupAddress,
    order.deliveryAddress,
  ]);

  const isSharing =
    !!courierLocation?.isSharing;

  const hasLocation =
    !!courierLocation &&
    typeof courierLocation.latitude ===
      "number" &&
    typeof courierLocation.longitude ===
      "number";

  return (
    <div className="space-y-3 rounded-2xl border border-[#303036] bg-[#19191E] p-4 shadow-lg">
      {/* Tracking Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D6A84F]/30 bg-[#D6A84F]/10">
            <Navigation
              size={15}
              className="text-[#D6A84F]"
            />
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider">
              Kurye Takibi
            </h4>

            <p className="text-[9px] text-[#777777]">
              Canlı teslimat konumu
            </p>
          </div>
        </div>

        <span
          className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${
            isSharing
              ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
              : "border-[#303036] bg-[#222229] text-[#999999]"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isSharing
                ? "animate-pulse bg-emerald-400"
                : "bg-gray-500"
            }`}
          />

          {isSharing
            ? "Canlı GPS"
            : "GPS Bekleniyor"}
        </span>
      </div>

      {/* Map */}
      <RouteMap
        pickupCoords={pickupCoords}
        deliveryCoords={deliveryCoords}
        routePoints={routePoints}
        courierCoords={
          isSharing && hasLocation
            ? {
                lat: courierLocation!.latitude,
                lng: courierLocation!.longitude,
                name:
                  order.courierName ||
                  "Kurye",
              }
            : null
        }
        distanceKm={order.distanceKm}
        approximateDistanceText={`${order.distanceKm} km`}
        isAutoCalculated={true}
      />

      {/* Live GPS Information */}
      {isSharing && courierLocation ? (
        <div className="space-y-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-emerald-300">
              <Radio
                size={15}
                className="animate-pulse text-emerald-400"
              />

              <span className="font-medium">
                Kurye konumu anlık olarak
                iletiliyor.
              </span>
            </div>

            <span className="shrink-0 font-mono text-[10px] text-[#999999]">
              {formatTime(
                courierLocation.updatedAt
              )}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-emerald-500/10 pt-2 text-[9px] text-[#999999]">
            <span>
              📡 GPS bağlantısı aktif
            </span>

            {locationLoading && (
              <RefreshCw
                size={11}
                className="animate-spin text-emerald-400"
              />
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1 rounded-xl border border-[#303036] bg-[#222229] p-3 text-[11px] text-[#999999]">
          <p className="flex items-center gap-1.5 font-medium text-amber-300">
            <Info size={14} />

            Kurye henüz canlı konum
            paylaşımını başlatmadı.
          </p>

          <p className="text-[10px] leading-relaxed">
            Kurye GPS paylaşımını
            başlattığında konumu burada
            otomatik olarak
            görüntülenecektir.
          </p>
        </div>
      )}

      {/* Delivery ETA */}
      {order.estimatedDeliveryMinutes &&
        order.status !== "Teslim Edildi" && (
          <div className="flex items-center justify-between rounded-xl border border-[#D6A84F]/20 bg-[#D6A84F]/10 p-3">
            <div className="flex items-center gap-2">
              <Clock
                size={15}
                className="text-[#D6A84F]"
              />

              <div>
                <span className="block text-[9px] uppercase tracking-wide text-[#999999]">
                  Tahmini teslimat
                </span>

                <span className="text-xs font-bold text-[#D6A84F]">
                  Yaklaşık{" "}
                  {
                    order.estimatedDeliveryMinutes
                  }{" "}
                  dakika
                </span>
              </div>
            </div>

            <Truck
              size={20}
              className="text-[#D6A84F]"
            />
          </div>
        )}
    </div>
  );
};

export const CustomerOrders: React.FC<Props> = ({
  orders,
  onOpenNewOrder,
  selectedOrderId,
}) => {
  const [searchTerm, setSearchTerm] =
    useState("");

  const [filter, setFilter] =
    useState<
      "all" | "active" | "completed"
    >("all");

  const [expandedOrderId, setExpandedOrderId] =
    useState<string | null>(
      selectedOrderId || null
    );

  useEffect(() => {
    if (selectedOrderId) {
      setExpandedOrderId(
        selectedOrderId
      );
    }
  }, [selectedOrderId]);

  const safeOrders = Array.isArray(
    orders
  )
    ? orders
    : [];

  const activeOrderCount = useMemo(
    () =>
      safeOrders.filter((order) =>
        ACTIVE_STATUSES.includes(
          order.status
        )
      ).length,
    [safeOrders]
  );

  const completedOrderCount = useMemo(
    () =>
      safeOrders.filter(
        (order) =>
          order.status === "Teslim Edildi"
      ).length,
    [safeOrders]
  );

  const filteredOrders = useMemo(() => {
    const term =
      searchTerm
        .trim()
        .toLowerCase();

    return [...safeOrders]
      .filter((order) => {
        const searchableText = [
          order.id,
          order.pickupAddress,
          order.deliveryAddress,
          order.customerName,
          order.courierName,
          order.packageType,
          order.courierType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesSearch =
          !term ||
          searchableText.includes(term);

        if (!matchesSearch) {
          return false;
        }

        if (filter === "active") {
          return ACTIVE_STATUSES.includes(
            order.status
          );
        }

        if (filter === "completed") {
          return (
            order.status ===
            "Teslim Edildi"
          );
        }

        return true;
      })
      .sort(
        (a, b) =>
          new Date(
            b.createdAt
          ).getTime() -
          new Date(
            a.createdAt
          ).getTime()
      );
  }, [
    safeOrders,
    searchTerm,
    filter,
  ]);

  const getStatusBadge = (
    status: OrderStatus
  ) => {
    switch (status) {
      case "Kurye Bekleniyor":
        return (
          <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold text-amber-400">
            <Clock
              size={12}
              className="animate-spin"
            />
            Kurye Bekleniyor
          </span>
        );

      case "Kurye Atandı":
        return (
          <span className="flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/15 px-2.5 py-1 text-[10px] font-bold text-blue-400">
            <User size={12} />
            Kurye Atandı
          </span>
        );

      case "Kurye Kabul Etti":
        return (
          <span className="flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-1 text-[10px] font-bold text-indigo-300">
            <CheckCircle2 size={12} />
            Kurye Kabul Etti
          </span>
        );

      case "Paket Alındı":
        return (
          <span className="flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/15 px-2.5 py-1 text-[10px] font-bold text-purple-300">
            <Package size={12} />
            Paket Alındı
          </span>
        );

      case "Teslimatta":
        return (
          <span className="flex items-center gap-1 rounded-full border border-[#D6A84F]/40 bg-[#D6A84F]/20 px-2.5 py-1 text-[10px] font-bold text-[#D6A84F]">
            <Truck
              size={12}
              className="animate-pulse"
            />
            Teslimatta
          </span>
        );

      case "Teslim Edildi":
        return (
          <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
            <CheckCircle2 size={12} />
            Teslim Edildi
          </span>
        );

      case "İptal Edildi":
        return (
          <span className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/15 px-2.5 py-1 text-[10px] font-bold text-red-400">
            <XCircle size={12} />
            İptal Edildi
          </span>
        );

      default:
        return null;
    }
  };

  const handleCancelOrder = async (
    orderId: string
  ) => {
    const confirmed = window.confirm(
      "Bu siparişi iptal etmek istediğinize emin misiniz?"
    );

    if (!confirmed) {
      return;
    }

    try {
      await Promise.resolve(
        storage.updateOrderStatus(
          orderId,
          "İptal Edildi"
        )
      );
    } catch (error) {
      console.error(
        "Sipariş iptal edilemedi:",
        error
      );

      window.alert(
        "Sipariş iptal edilemedi. Lütfen tekrar deneyin."
      );
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="overflow-hidden rounded-2xl border border-[#303036] bg-[#19191E]">
        <div className="relative p-4 sm:p-5">
          <div className="absolute right-0 top-0 h-32 w-32 rounded-full bg-[#D6A84F]/5 blur-3xl" />

          <div className="relative flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />

                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                  Sistem Aktif
                </span>
              </div>

              <h2 className="font-['Space_Grotesk'] text-xl font-bold">
                Siparişlerim
                <span className="ml-2 text-[#D6A84F]">
                  ({safeOrders.length})
                </span>
              </h2>

              <p className="mt-1 text-xs text-[#999999]">
                Kurye gönderilerinizin
                durumunu ve canlı konumunu
                takip edin.
              </p>
            </div>

            <button
              onClick={onOpenNewOrder}
              className="flex items-center justify-center gap-2 rounded-xl bg-[#D6A84F] px-4 py-2.5 text-xs font-bold text-[#0B0B0D] shadow-lg shadow-[#D6A84F]/10 transition hover:bg-[#c49740] active:scale-[0.98]"
            >
              <Truck size={16} />
              Yeni Kurye Çağır
            </button>
          </div>

          {/* Quick Stats */}
          {safeOrders.length > 0 && (
            <div className="relative mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-xl border border-[#303036] bg-[#0B0B0D]/50 p-3">
                <span className="block text-[9px] uppercase tracking-wide text-[#777777]">
                  Toplam
                </span>

                <span className="mt-1 block text-lg font-extrabold text-white">
                  {safeOrders.length}
                </span>
              </div>

              <div className="rounded-xl border border-[#D6A84F]/20 bg-[#D6A84F]/5 p-3">
                <span className="block text-[9px] uppercase tracking-wide text-[#777777]">
                  Aktif
                </span>

                <span className="mt-1 block text-lg font-extrabold text-[#D6A84F]">
                  {activeOrderCount}
                </span>
              </div>

              <div className="col-span-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 sm:col-span-1">
                <span className="block text-[9px] uppercase tracking-wide text-[#777777]">
                  Teslim Edildi
                </span>

                <span className="mt-1 block text-lg font-extrabold text-emerald-400">
                  {completedOrderCount}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#999999]"
          />

          <input
            type="text"
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(
                event.target.value
              )
            }
            placeholder="Sipariş no, adres veya kurye ara..."
            className="w-full rounded-xl border border-[#303036] bg-[#19191E] py-2.5 pl-9 pr-3 text-xs text-white outline-none transition placeholder:text-[#666666] focus:border-[#D6A84F]"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            {
              key: "all" as const,
              label: "Tümü",
              count: safeOrders.length,
            },
            {
              key: "active" as const,
              label: "Aktif",
              count: activeOrderCount,
            },
            {
              key: "completed" as const,
              label: "Tamamlanan",
              count: completedOrderCount,
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() =>
                setFilter(tab.key)
              }
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                filter === tab.key
                  ? "border-[#D6A84F]/40 bg-[#D6A84F]/15 text-[#D6A84F]"
                  : "border-[#303036] bg-[#19191E] text-[#999999] hover:text-white"
              }`}
            >
              {tab.label}

              <span
                className={`rounded-full px-1.5 py-0.5 text-[9px] ${
                  filter === tab.key
                    ? "bg-[#D6A84F]/20"
                    : "bg-[#222229]"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-[#303036] bg-[#19191E] p-10 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#303036] bg-[#0B0B0D]">
            <Package
              size={36}
              className="text-[#999999]/40"
            />
          </div>

          <h3 className="mt-4 font-bold">
            Sipariş Bulunamadı
          </h3>

          <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#999999]">
            {searchTerm ||
            filter !== "all"
              ? "Arama veya filtre kriterlerinize uygun sipariş bulunamadı."
              : "Henüz bir kurye talebiniz bulunmuyor."}
          </p>

          {!searchTerm &&
            filter === "all" && (
              <button
                onClick={onOpenNewOrder}
                className="mt-4 rounded-xl bg-[#D6A84F] px-4 py-2 text-xs font-bold text-[#0B0B0D] transition hover:bg-[#c49740]"
              >
                İlk Siparişi Oluştur
              </button>
            )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const expanded =
              expandedOrderId ===
              order.id;

            const currentStep =
              getStatusStepIndex(
                order.status
              );

            const isActive =
              ACTIVE_STATUSES.includes(
                order.status
              );

            return (
              <div
                key={order.id}
                className={`overflow-hidden rounded-2xl border bg-[#19191E] transition ${
                  expanded
                    ? "border-[#D6A84F]/40 shadow-lg shadow-black/20"
                    : "border-[#303036] hover:border-[#D6A84F]/30"
                }`}
              >
                {/* Order Summary */}
                <button
                  type="button"
                  onClick={() =>
                    setExpandedOrderId(
                      expanded
                        ? null
                        : order.id
                    )
                  }
                  className="w-full p-4 text-left"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded-lg border border-[#303036] bg-[#0B0B0D] px-2.5 py-1 font-mono text-xs font-bold text-[#D6A84F]">
                        #{order.id}
                      </span>

                      <span className="truncate text-[10px] text-[#999999]">
                        {formatDate(
                          order.createdAt
                        )}
                      </span>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {getStatusBadge(
                        order.status
                      )}

                      <ChevronDown
                        size={15}
                        className={`text-[#777777] transition-transform ${
                          expanded
                            ? "rotate-180"
                            : ""
                        }`}
                      />
                    </div>
                  </div>

                  {/* Addresses */}
                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <MapPin
                        size={15}
                        className="mt-0.5 shrink-0 text-[#D6A84F]"
                      />

                      <div className="min-w-0">
                        <span className="block text-[10px] text-[#999999]">
                          Alım
                        </span>

                        <p className="truncate font-medium">
                          {
                            order.pickupAddress
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Navigation
                        size={15}
                        className="mt-0.5 shrink-0 text-emerald-400"
                      />

                      <div className="min-w-0">
                        <span className="block text-[10px] text-[#999999]">
                          Teslimat
                        </span>

                        <p className="truncate font-medium">
                          {
                            order.deliveryAddress
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Order Footer */}
                  <div className="mt-4 flex items-center justify-between border-t border-[#303036]/60 pt-3">
                    <div className="flex min-w-0 items-center gap-2 text-[10px] text-[#999999]">
                      <span className="rounded bg-[#222229] px-2 py-1">
                        {order.packageType}
                      </span>

                      <span className="hidden rounded bg-[#222229] px-2 py-1 text-[#D6A84F] sm:inline">
                        {order.courierType}
                      </span>

                      <span>
                        {order.distanceKm} KM
                      </span>
                    </div>

                    <span className="shrink-0 font-mono text-sm font-extrabold text-white">
                      {Number(
                        order.price || 0
                      ).toLocaleString(
                        "tr-TR"
                      )}{" "}
                      TL
                    </span>
                  </div>

                  {/* Active mini indicator */}
                  {isActive && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/10 bg-emerald-500/5 px-2.5 py-2 text-[9px] text-emerald-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      Siparişiniz aktif olarak
                      takip ediliyor
                    </div>
                  )}
                </button>

                {/* Expanded Content */}
                {expanded && (
                  <div className="space-y-4 border-t border-[#303036] bg-[#222229] p-4">
                    {/* Status Timeline */}
                    {order.status !==
                      "İptal Edildi" && (
                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#999999]">
                            Teslimat Süreci
                          </span>

                          <span className="text-[9px] font-medium text-[#D6A84F]">
                            {currentStep >=
                            0
                              ? `${Math.min(
                                  currentStep +
                                    1,
                                  STATUS_STEPS.length
                                )}/${STATUS_STEPS.length}`
                              : ""}
                          </span>
                        </div>

                        <div className="overflow-x-auto pb-1">
                          <div className="grid min-w-[420px] grid-cols-6 gap-1">
                            {STATUS_STEPS.map(
                              (
                                step,
                                index
                              ) => {
                                const done =
                                  currentStep >=
                                  index;

                                const current =
                                  currentStep ===
                                  index;

                                return (
                                  <div
                                    key={
                                      step
                                    }
                                    className="relative flex min-w-0 flex-col items-center text-center"
                                  >
                                    {index <
                                      STATUS_STEPS.length -
                                        1 && (
                                      <div
                                        className={`absolute left-1/2 top-3 h-px w-full ${
                                          currentStep >
                                          index
                                            ? "bg-emerald-500"
                                            : "bg-[#303036]"
                                        }`}
                                      />
                                    )}

                                    <div
                                      className={`relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold ${
                                        current
                                          ? "bg-[#D6A84F] text-[#0B0B0D] ring-4 ring-[#D6A84F]/20"
                                          : done
                                          ? "bg-emerald-500 text-white"
                                          : "border border-[#303036] bg-[#19191E] text-[#777777]"
                                      }`}
                                    >
                                      {done
                                        ? "✓"
                                        : index +
                                          1}
                                    </div>

                                    <span
                                      className={`mt-1.5 text-[8px] leading-tight ${
                                        current
                                          ? "font-bold text-[#D6A84F]"
                                          : done
                                          ? "text-white"
                                          : "text-[#777777]"
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
                    )}

                    {/* Current Status Highlight */}
                    {order.status !==
                      "İptal Edildi" && (
                      <div className="flex items-center gap-3 rounded-xl border border-[#D6A84F]/20 bg-[#D6A84F]/5 p-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#D6A84F]/15">
                          <Truck
                            size={18}
                            className="text-[#D6A84F]"
                          />
                        </div>

                        <div className="min-w-0">
                          <span className="block text-[9px] uppercase tracking-wide text-[#999999]">
                            Güncel Durum
                          </span>

                          <span className="text-xs font-bold text-[#D6A84F]">
                            {order.status}
                          </span>
                        </div>

                        {order.estimatedDeliveryMinutes &&
                          order.status !==
                            "Teslim Edildi" && (
                            <div className="ml-auto shrink-0 text-right">
                              <span className="block text-[9px] text-[#999999]">
                                Tahmini
                              </span>

                              <span className="font-mono text-xs font-bold text-white">
                                {
                                  order.estimatedDeliveryMinutes
                                }{" "}
                                dk
                              </span>
                            </div>
                          )}
                      </div>
                    )}

                    {/* Courier */}
                    {order.courierName ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#303036] bg-[#19191E] p-3">
                        <div className="flex items-center gap-3">
                          <div className="relative flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
                            <Truck size={18} />

                            {isActive && (
                              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-[#19191E] bg-emerald-400" />
                            )}
                          </div>

                          <div>
                            <span className="block text-[10px] uppercase tracking-wide text-[#999999]">
                              Atanan Kurye
                            </span>

                            <h4 className="text-xs font-bold">
                              {
                                order.courierName
                              }
                            </h4>

                            {order.courierPhone && (
                              <p className="font-mono text-[11px] text-emerald-400">
                                {
                                  order.courierPhone
                                }
                              </p>
                            )}
                          </div>
                        </div>

                        {order.courierPhone && (
                          <a
                            href={`tel:${order.courierPhone}`}
                            onClick={(event) =>
                              event.stopPropagation()
                            }
                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-400 transition hover:bg-emerald-500 hover:text-white active:scale-95"
                            title="Kuryeyi Ara"
                          >
                            <Phone size={16} />
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-xl border border-[#303036] bg-[#19191E] p-3 text-xs text-[#999999]">
                        <Clock
                          size={16}
                          className="shrink-0 text-amber-400"
                        />

                        <span>
                          Kurye atanması
                          bekleniyor.
                        </span>
                      </div>
                    )}

                    {/* Live Tracking */}
                    {order.courierId &&
                      order.status !==
                        "İptal Edildi" &&
                      order.status !==
                        "Teslim Edildi" && (
                        <OrderTrackingCard
                          order={order}
                        />
                      )}

                    {/* Delivery Proof */}
                    {(order.status ===
                      "Teslim Edildi" ||
                      order.deliveryProof ||
                      order.signature) && (
                      <DeliveryProofCard
                        order={order}
                      />
                    )}

                    {/* Order Note */}
                    {order.note && (
                      <div className="rounded-xl border border-[#303036] bg-[#19191E] p-3">
                        <span className="mb-1 block text-[10px] font-semibold text-[#999999]">
                          Sipariş Notu
                        </span>

                        <p className="text-xs italic leading-relaxed text-slate-300">
                          {order.note}
                        </p>
                      </div>
                    )}

                    {/* Cancel */}
                    {order.status ===
                      "Kurye Bekleniyor" && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCancelOrder(
                            order.id
                          )
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-xs font-bold text-red-400 transition hover:bg-red-500 hover:text-white active:scale-[0.99]"
                      >
                        <XCircle size={15} />
                        Siparişi İptal Et
                      </button>
                    )}

                    {/* Completed */}
                    {order.status ===
                      "Teslim Edildi" && (
                      <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-400">
                        <CheckCircle2
                          size={16}
                        />
                        Sipariş başarıyla
                        teslim edildi.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};