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

  useEffect(() => {
    let mounted = true;

    if (!order.courierId) {
      setCourierLocation(undefined);
      return;
    }

    const loadLocation = async () => {
      try {
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

  return (
    <div className="space-y-3 rounded-2xl border border-[#303036] bg-[#19191E] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Navigation
            size={16}
            className="text-[#D6A84F]"
          />

          <h4 className="text-xs font-bold uppercase tracking-wider">
            Kurye Takibi
          </h4>
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

      <RouteMap
        pickupCoords={pickupCoords}
        deliveryCoords={deliveryCoords}
        routePoints={routePoints}
        courierCoords={
          isSharing && courierLocation
            ? {
                lat: courierLocation.latitude,
                lng: courierLocation.longitude,
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

      {isSharing && courierLocation ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <Radio
              size={15}
              className="animate-pulse text-emerald-400"
            />

            <span>
              Kurye konumu anlık olarak
              iletiliyor.
            </span>
          </div>

          <span className="shrink-0 font-mono text-[10px] text-[#999999]">
            {new Date(
              courierLocation.updatedAt
            ).toLocaleTimeString(
              "tr-TR",
              {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }
            )}
          </span>
        </div>
      ) : (
        <div className="space-y-1 rounded-xl border border-[#303036] bg-[#222229] p-3 text-[11px] text-[#999999]">
          <p className="flex items-center gap-1.5 font-medium text-amber-300">
            <Info size={14} />
            Kurye henüz canlı konum
            paylaşımını başlatmadı.
          </p>

          <p className="text-[10px]">
            Kurye GPS paylaşımını
            başlattığında konumu burada
            görüntülenecektir.
          </p>
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
          "İptal Edildi",
          "Müşteri tarafından iptal edildi."
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
      <div className="flex flex-col justify-between gap-3 rounded-2xl border border-[#303036] bg-[#19191E] p-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-['Space_Grotesk'] text-lg font-bold">
            Siparişlerim ({safeOrders.length})
          </h2>

          <p className="text-xs text-[#999999]">
            Kurye gönderilerinizin anlık
            durumunu takip edin.
          </p>
        </div>

        <button
          onClick={onOpenNewOrder}
          className="flex items-center justify-center gap-2 self-start rounded-xl bg-[#D6A84F] px-4 py-2.5 text-xs font-bold text-[#0B0B0D] transition hover:bg-[#c49740] sm:self-auto"
        >
          <Truck size={16} />
          Yeni Kurye Çağır
        </button>
      </div>

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
            className="w-full rounded-xl border border-[#303036] bg-[#19191E] py-2.5 pl-9 pr-3 text-xs text-white outline-none transition focus:border-[#D6A84F]"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            {
              key: "all" as const,
              label: "Tümü",
            },
            {
              key: "active" as const,
              label: "Aktif",
            },
            {
              key: "completed" as const,
              label: "Tamamlanan",
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() =>
                setFilter(tab.key)
              }
              className={`whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                filter === tab.key
                  ? "border-[#D6A84F]/40 bg-[#D6A84F]/15 text-[#D6A84F]"
                  : "border-[#303036] bg-[#19191E] text-[#999999] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="rounded-2xl border border-[#303036] bg-[#19191E] p-10 text-center">
          <Package
            size={44}
            className="mx-auto text-[#999999]/40"
          />

          <h3 className="mt-3 font-bold">
            Sipariş Bulunamadı
          </h3>

          <p className="mx-auto mt-1 max-w-sm text-xs text-[#999999]">
            {searchTerm ||
            filter !== "all"
              ? "Arama veya filtre kriterlerinize uygun sipariş bulunamadı."
              : "Henüz bir kurye talebiniz bulunmuyor."}
          </p>

          {!searchTerm &&
            filter === "all" && (
              <button
                onClick={onOpenNewOrder}
                className="mt-4 rounded-xl bg-[#D6A84F] px-4 py-2 text-xs font-bold text-[#0B0B0D]"
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
              STATUS_STEPS.indexOf(
                order.status
              );

            return (
              <div
                key={order.id}
                className="overflow-hidden rounded-2xl border border-[#303036] bg-[#19191E] transition hover:border-[#D6A84F]/40"
              >
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
                        {new Date(
                          order.createdAt
                        ).toLocaleDateString(
                          "tr-TR",
                          {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute:
                              "2-digit",
                          }
                        )}
                      </span>
                    </div>

                    {getStatusBadge(
                      order.status
                    )}
                  </div>

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
                </button>

                {expanded && (
                  <div className="space-y-4 border-t border-[#303036] bg-[#222229] p-4">
                    {order.status !==
                      "İptal Edildi" && (
                      <div>
                        <span className="mb-3 block text-[10px] font-bold uppercase tracking-wider text-[#999999]">
                          Teslimat Süreci
                        </span>

                        <div className="grid grid-cols-6 gap-1">
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
                                  className="flex min-w-0 flex-col items-center text-center"
                                >
                                  <div
                                    className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold ${
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
                                    className={`mt-1 text-[8px] leading-tight ${
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
                    )}

                    {order.courierName ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#303036] bg-[#19191E] p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
                            <Truck size={18} />
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
                            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-400 transition hover:bg-emerald-500 hover:text-white"
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

                    {order.courierId &&
                      order.status !==
                        "İptal Edildi" &&
                      order.status !==
                        "Teslim Edildi" && (
                        <OrderTrackingCard
                          order={order}
                        />
                      )}

                    {(order.status ===
                      "Teslim Edildi" ||
                      order.deliveryProof ||
                      order.signature) && (
                      <DeliveryProofCard
                        order={order}
                      />
                    )}

                    {order.note && (
                      <div className="rounded-xl border border-[#303036] bg-[#19191E] p-3">
                        <span className="mb-1 block text-[10px] font-semibold text-[#999999]">
                          Sipariş Notu
                        </span>

                        <p className="text-xs italic text-slate-300">
                          {order.note}
                        </p>
                      </div>
                    )}

                    {order.status ===
                      "Kurye Bekleniyor" && (
                      <button
                        type="button"
                        onClick={() =>
                          handleCancelOrder(
                            order.id
                          )
                        }
                        className="w-full rounded-xl border border-red-500/30 bg-red-500/10 py-2.5 text-xs font-bold text-red-400 transition hover:bg-red-500 hover:text-white"
                      >
                        Siparişi İptal Et
                      </button>
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