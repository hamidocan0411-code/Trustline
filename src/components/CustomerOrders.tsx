import React, { useEffect, useMemo, useState } from "react";
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
  GeoCoordinate,
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

const COMPLETED_STATUSES: OrderStatus[] = [
  "Teslim Edildi",
];

const STATUS_STEPS: OrderStatus[] = [
  "Kurye Bekleniyor",
  "Kurye Atandı",
  "Kurye Kabul Etti",
  "Paket Alındı",
  "Teslimatta",
  "Teslim Edildi",
];

const OrderTrackingCard: React.FC<{ order: Order }> = ({
  order,
}) => {
  const [courierLoc, setCourierLoc] =
    useState<CourierLocation | null>(null);

  const [pickupCoords, setPickupCoords] =
    useState<GeoCoordinate | null>(null);

  const [deliveryCoords, setDeliveryCoords] =
    useState<GeoCoordinate | null>(null);

  const [routePoints, setRoutePoints] =
    useState<[number, number][]>([]);

  useEffect(() => {
    let mounted = true;

    if (!order.courierId) {
      setCourierLoc(null);
      return () => {
        mounted = false;
      };
    }

    const loadLocation = async () => {
      try {
        const location =
          await storage.getCourierLocation(
            order.courierId as string
          );

        if (mounted) {
          setCourierLoc(location || null);
        }
      } catch (error) {
        console.warn(
          "Kurye konumu alınamadı:",
          error
        );

        if (mounted) {
          setCourierLoc(null);
        }
      }
    };

    loadLocation();

    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = storage.subscribe(() => {
        loadLocation();
      });
    } catch (error) {
      console.warn(
        "Sipariş canlı dinleyicisi kurulamadı:",
        error
      );
    }

    return () => {
      mounted = false;

      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [order.courierId]);

  useEffect(() => {
    let mounted = true;

    const calculateRoute = async () => {
      try {
        const result =
          await mapService.calculateDistance(
            order.pickupAddress,
            order.deliveryAddress
          );

        if (!mounted) {
          return;
        }

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
      } catch (error) {
        console.warn(
          "Rota hesaplanamadı:",
          error
        );
      }
    };

    calculateRoute();

    return () => {
      mounted = false;
    };
  }, [
    order.pickupAddress,
    order.deliveryAddress,
  ]);

  const isSharing =
    !!courierLoc?.isSharing;

  return (
    <div className="bg-[#19191E] border border-[#303036] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#D6A84F]" />

          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Kurye Takibi & Canlı Rota
          </h4>
        </div>

        <span
          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
            isSharing
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-400"
              : "bg-[#222229] border border-[#303036] text-[#999999]"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isSharing
                ? "bg-emerald-400 animate-ping"
                : "bg-gray-500"
            }`}
          />

          {isSharing
            ? "Canlı GPS Aktif"
            : "GPS Bekleniyor"}
        </span>
      </div>

      <RouteMap
        pickupCoords={pickupCoords}
        deliveryCoords={deliveryCoords}
        routePoints={routePoints}
        courierCoords={
          isSharing && courierLoc
            ? {
                lat: courierLoc.latitude,
                lng: courierLoc.longitude,
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

      {isSharing && courierLoc ? (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs flex items-center justify-between gap-3 text-emerald-300">
          <div className="flex items-center gap-2 min-w-0">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />

            <span>
              Kuryeniz hareket halinde ve
              konumu anlık iletiliyor.
            </span>
          </div>

          <span className="text-[10px] font-mono text-[#999999] shrink-0">
            {new Date(
              courierLoc.updatedAt
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
        <div className="p-2.5 bg-[#222229] border border-[#303036] rounded-xl text-[11px] text-[#999999] space-y-1">
          <p className="flex items-center gap-1.5 text-amber-300/90 font-medium">
            <Info className="w-3.5 h-3.5 shrink-0" />

            Kurye henüz canlı konum
            paylaşımını başlatmadı.
          </p>

          <p className="text-[10px] text-[#999999]/80">
            Kurye cihazından konum izni
            verip paylaşımı başlattığında
            burada anlık olarak
            görünecektir.
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

  const [statusFilter, setStatusFilter] =
    useState<
      "all" | "active" | "completed"
    >("all");

  const [
    expandedOrderId,
    setExpandedOrderId,
  ] = useState<string | null>(
    selectedOrderId || null
  );

  useEffect(() => {
    if (selectedOrderId) {
      setExpandedOrderId(
        selectedOrderId
      );
    }
  }, [selectedOrderId]);

  const filteredOrders = useMemo(() => {
    const query =
      searchTerm.trim().toLowerCase();

    return [...orders]
      .filter((order) => {
        const matchesSearch =
          !query ||
          order.id
            .toLowerCase()
            .includes(query) ||
          order.pickupAddress
            .toLowerCase()
            .includes(query) ||
          order.deliveryAddress
            .toLowerCase()
            .includes(query) ||
          order.courierName
            ?.toLowerCase()
            .includes(query);

        if (!matchesSearch) {
          return false;
        }

        if (
          statusFilter === "active"
        ) {
          return ACTIVE_STATUSES.includes(
            order.status
          );
        }

        if (
          statusFilter === "completed"
        ) {
          return COMPLETED_STATUSES.includes(
            order.status
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
    orders,
    searchTerm,
    statusFilter,
  ]);

  const getStatusBadge = (
    status: OrderStatus
  ) => {
    switch (status) {
      case "Kurye Bekleniyor":
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center gap-1">
            <Clock className="w-3 h-3 animate-spin" />
            Kurye Bekleniyor
          </span>
        );

      case "Kurye Atandı":
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center gap-1">
            <User className="w-3 h-3" />
            Kurye Atandı
          </span>
        );

      case "Kurye Kabul Etti":
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Kurye Kabul Etti
          </span>
        );

      case "Paket Alındı":
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center gap-1">
            <Package className="w-3 h-3" />
            Paket Alındı
          </span>
        );

      case "Teslimatta":
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#D6A84F]/20 border border-[#D6A84F]/40 text-[#D6A84F] flex items-center gap-1">
            <Truck className="w-3 h-3 animate-pulse" />
            Teslimatta
          </span>
        );

      case "Teslim Edildi":
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Teslim Edildi
          </span>
        );

      case "İptal Edildi":
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
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
      await storage.updateOrderStatus(
        orderId,
        "İptal Edildi",
        "Müşteri tarafından iptal edildi."
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#19191E] border border-[#303036] p-4 rounded-2xl">
        <div>
          <h2 className="text-lg font-bold text-white font-['Space_Grotesk']">
            Siparişlerim ({orders.length})
          </h2>

          <p className="text-xs text-[#999999]">
            Tüm kurye gönderilerinizin
            anlık durum takibi
          </p>
        </div>

        <button
          onClick={onOpenNewOrder}
          className="bg-[#D6A84F] hover:bg-[#c49740] text-[#0B0B0D] font-bold text-xs px-4 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md shadow-[#D6A84F]/10 cursor-pointer self-start sm:self-auto"
        >
          <Truck className="w-4 h-4" />
          <span>Yeni Kurye Çağır</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#999999] absolute left-3.5 top-1/2 -translate-y-1/2" />

          <input
            type="text"
            placeholder="Sipariş No, adres veya kurye ara..."
            value={searchTerm}
            onChange={(event) =>
              setSearchTerm(
                event.target.value
              )
            }
            className="w-full bg-[#19191E] border border-[#303036] focus:border-[#D6A84F] text-xs text-white placeholder:text-[#999999] rounded-xl pl-9 pr-3 py-2.5 focus:outline-hidden transition-colors"
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
              label: "Aktif Siparişler",
            },
            {
              key: "completed" as const,
              label: "Tamamlananlar",
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() =>
                setStatusFilter(
                  tab.key
                )
              }
              className={`px-3 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors border ${
                statusFilter === tab.key
                  ? "bg-[#D6A84F]/15 text-[#D6A84F] border-[#D6A84F]/40"
                  : "bg-[#19191E] text-[#999999] border-[#303036] hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-[#19191E] border border-[#303036] rounded-2xl p-6">
          <Package className="w-12 h-12 text-[#999999]/40 mx-auto mb-3" />

          <h3 className="font-bold text-white text-base">
            Sipariş Bulunamadı
          </h3>

          <p className="text-xs text-[#999999] mt-1 max-w-sm mx-auto">
            {searchTerm ||
            statusFilter !== "all"
              ? "Arama kriterlerinize uygun sipariş bulunamadı."
              : "Henüz bir kurye talebiniz bulunmuyor. Hemen bir kurye çağırabilirsiniz."}
          </p>

          <button
            onClick={onOpenNewOrder}
            className="mt-4 inline-flex items-center gap-2 bg-[#D6A84F] text-[#0B0B0D] px-4 py-2 rounded-xl text-xs font-bold"
          >
            İlk Siparişi Oluştur
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const isExpanded =
              expandedOrderId ===
              order.id;

            const currentStepIdx =
              STATUS_STEPS.indexOf(
                order.status
              );

            return (
              <div
                key={order.id}
                className="bg-[#19191E] border border-[#303036] rounded-2xl overflow-hidden hover:border-[#D6A84F]/40 transition-all shadow-md"
              >
                <div
                  onClick={() =>
                    setExpandedOrderId(
                      isExpanded
                        ? null
                        : order.id
                    )
                  }
                  className="p-4 cursor-pointer flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-xs text-[#D6A84F] bg-[#0B0B0D] px-2.5 py-1 rounded-lg border border-[#303036] shrink-0">
                        #{order.id}
                      </span>

                      <span className="text-xs text-[#999999] truncate">
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

                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-[#D6A84F] shrink-0 mt-0.5" />

                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-[#999999] block">
                          Alım:
                        </span>

                        <p className="text-white font-medium truncate">
                          {order.pickupAddress}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Navigation className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />

                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-[#999999] block">
                          Teslimat:
                        </span>

                        <p className="text-white font-medium truncate">
                          {order.deliveryAddress}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#303036]/60 text-xs gap-2">
                    <div className="flex items-center gap-2 text-[#999999] overflow-hidden">
                      <span className="bg-[#222229] px-2 py-0.5 rounded text-[11px] whitespace-nowrap">
                        {order.packageType}
                      </span>

                      <span className="bg-[#222229] px-2 py-0.5 rounded text-[11px] text-[#D6A84F] whitespace-nowrap">
                        {order.courierType}
                      </span>

                      <span className="font-mono whitespace-nowrap">
                        {order.distanceKm} KM
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono font-extrabold text-sm text-white">
                        {order.price} TL
                      </span>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 bg-[#222229] border-t border-[#303036] space-y-4 animate-fadeIn">
                    {order.status !==
                      "İptal Edildi" && (
                      <div>
                        <span className="text-[11px] font-bold text-[#999999] uppercase tracking-wider block mb-2">
                          Teslimat Süreci
                        </span>

                        <div className="grid grid-cols-6 gap-1 text-center">
                          {STATUS_STEPS.map(
                            (
                              step,
                              idx
                            ) => {
                              const isDone =
                                currentStepIdx >=
                                idx;

                              const isCurrent =
                                currentStepIdx ===
                                idx;

                              return (
                                <div
                                  key={step}
                                  className="flex flex-col items-center"
                                >
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 transition-all ${
                                      isCurrent
                                        ? "bg-[#D6A84F] text-[#0B0B0D] ring-4 ring-[#D6A84F]/20 font-black"
                                        : isDone
                                        ? "bg-emerald-500 text-white"
                                        : "bg-[#19191E] text-[#999999] border border-[#303036]"
                                    }`}
                                  >
                                    {isDone
                                      ? "✓"
                                      : idx +
                                        1}
                                  </div>

                                  <span
                                    className={`text-[8px] leading-tight ${
                                      isCurrent
                                        ? "text-[#D6A84F] font-bold"
                                        : isDone
                                        ? "text-white"
                                        : "text-[#999999]"
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
                      <div className="bg-[#19191E] border border-[#303036] rounded-xl p-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                            <Truck className="w-5 h-5" />
                          </div>

                          <div className="min-w-0">
                            <span className="text-[10px] text-[#999999] uppercase tracking-wide block">
                              Atanan Kurye
                            </span>

                            <h4 className="text-xs font-bold text-white truncate">
                              {order.courierName}
                            </h4>

                            {order.courierPhone && (
                              <p className="text-[11px] text-emerald-400 font-mono">
                                {order.courierPhone}
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
                            className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 transition-colors shrink-0"
                            title="Kuryeyi Ara"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-[#999999] bg-[#19191E] p-3 rounded-xl border border-[#303036] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-400 shrink-0" />

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
                      <div className="text-xs bg-[#19191E] p-3 rounded-xl border border-[#303036]">
                        <span className="text-[10px] text-[#999999] block font-semibold mb-0.5">
                          Sipariş Notu:
                        </span>

                        <p className="text-slate-300 italic">
                          {order.note}
                        </p>
                      </div>
                    )}

                    {order.status ===
                      "Kurye Bekleniyor" && (
                      <div className="pt-2">
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleCancelOrder(
                              order.id
                            );
                          }}
                          className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white text-xs font-bold transition-all border border-red-500/30 cursor-pointer"
                        >
                          Siparişi İptal Et
                        </button>
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