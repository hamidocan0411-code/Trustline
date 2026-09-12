import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Car,
  ChevronRight,
  DollarSign,
  Headphones,
  MapPin,
  Package,
  Phone,
  RefreshCw,
  Search,
  Settings,
  Star,
  ShieldCheck,
  Truck,
  Trash2,
  Users,
  X,
  Zap,
} from "lucide-react";

import type {
  CourierAvailability,
  CourierLocation,
  Order,
  OrderStatus,
  PricingConfig,
  UserProfile,
} from "../types";

import { storage } from "../services/storage";
import {
  supportService,
  type SupportTicket,
} from "../services/support";

import { DeliveryProofCard } from "./DeliveryProofCard";
import { LiveSupport } from "./LiveSupport";
import { subscribeToAllCourierRatings } from "../services/courierRatings";

interface Props {
  orders: Order[];
  pricing: PricingConfig;
  onRefreshData?: () => void;
}

type AdminTab =
  | "dashboard"
  | "orders"
  | "couriers"
  | "customers"
  | "pricing"
  | "support"
  | "settings";

const ORDER_STATUSES: OrderStatus[] = [
  "Kurye Bekleniyor",
  "Kurye Atandı",
  "Kurye Kabul Etti",
  "Paket Alındı",
  "Teslimatta",
  "Teslim Edildi",
  "İptal Edildi",
];

const COURIER_STATUSES: CourierAvailability[] = [
  "Müsait",
  "Meşgul",
  "Çevrimdışı",
];

type CourierWithEmployment = UserProfile & {
  employmentStatus?: "active" | "inactive";
};

const isInactiveCourier = (courier: UserProfile) =>
  (courier as CourierWithEmployment).employmentStatus ===
  "inactive";

export const AdminPanel: React.FC<Props> = ({
  orders,
  pricing,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] =
    useState<AdminTab>("dashboard");

  const [searchTerm, setSearchTerm] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<"Tümü" | OrderStatus>("Tümü");

  const [selectedOrder, setSelectedOrder] =
    useState<Order | null>(null);

  const [editPrice, setEditPrice] =
    useState("");

  const [selectedCourier, setSelectedCourier] =
    useState("");

  const [selectedCourierProfile, setSelectedCourierProfile] =
    useState<UserProfile | null>(null);

  const [selectedCourierRatings, setSelectedCourierRatings] =
    useState<UserProfile | null>(null);

  const [selectedCustomerProfile, setSelectedCustomerProfile] =
    useState<UserProfile | null>(null);

  const [courierVehicle, setCourierVehicle] =
    useState("");

  const [courierPlate, setCourierPlate] =
    useState("");

  const [selectedStatus, setSelectedStatus] =
    useState<OrderStatus>("Kurye Bekleniyor");

  const [saving, setSaving] =
    useState(false);

  const [pricingSaving, setPricingSaving] =
    useState(false);

  const [profileSaving, setProfileSaving] =
    useState(false);

  const [deletingOrderId, setDeletingOrderId] =
    useState<string | null>(null);

  const [couriers, setCouriers] =
    useState<UserProfile[]>([]);

  const [customers, setCustomers] =
    useState<UserProfile[]>([]);

  const [perKmPrice, setPerKmPrice] =
    useState(pricing?.perKmPrice ?? 50);

  const [minPrice, setMinPrice] =
    useState(pricing?.minPrice ?? 250);

  const [urgentMultiplier, setUrgentMultiplier] =
    useState(pricing?.urgentMultiplier ?? 1.3);

  const [vipMultiplier, setVipMultiplier] =
    useState(pricing?.vipMultiplier ?? 1.6);

  const [courierLocations, setCourierLocations] =
    useState<Record<string, CourierLocation>>({});

  const [locationLoading, setLocationLoading] =
    useState(false);

  const [changingEmploymentId, setChangingEmploymentId] =
    useState<string | null>(null);

  const [supportTickets, setSupportTickets] =
    useState<SupportTicket[]>([]);

  const [courierRatingStats, setCourierRatingStats] =
    useState<Record<string, { average: number; count: number }>>({});

  const safeOrders = Array.isArray(orders)
    ? orders
    : [];

  useEffect(() => {
    setPerKmPrice(
      pricing?.perKmPrice ?? 50
    );

    setMinPrice(
      pricing?.minPrice ?? 250
    );

    setUrgentMultiplier(
      pricing?.urgentMultiplier ?? 1.3
    );

    setVipMultiplier(
      pricing?.vipMultiplier ?? 1.6
    );
  }, [pricing]);

  useEffect(() => {
    let active = true;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = subscribeToAllCourierRatings((nextRatings) => {
        if (!active) return;

        const stats: Record<string, { average: number; count: number }> = {};

        for (const rating of Array.isArray(nextRatings) ? nextRatings : []) {
          if (!rating?.courierId) continue;

          const score = Number(rating.score);
          if (!Number.isFinite(score)) continue;

          if (!stats[rating.courierId]) {
            stats[rating.courierId] = { average: 0, count: 0 };
          }

          stats[rating.courierId].average += score;
          stats[rating.courierId].count += 1;
        }

        Object.keys(stats).forEach((courierId) => {
          const item = stats[courierId];
          item.average = item.count > 0 ? item.average / item.count : 0;
        });

        setCourierRatingStats(stats);
      });
    } catch (error) {
      console.error("Admin kurye puanları listener hatası:", error);
      setCourierRatingStats({});
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const loadUsers = () => {
    try {
      setCouriers(
        storage.getCouriers()
      );

      setCustomers(
        storage.getCustomers()
      );
    } catch (error) {
      console.error(
        "Admin kullanıcıları alınamadı:",
        error
      );

      setCouriers([]);
      setCustomers([]);
    }
  };

  const loadCourierLocations = () => {
    try {
      setLocationLoading(true);

      const next: Record<
        string,
        CourierLocation
      > = {};

      const allCouriers =
        storage.getCouriers();

      if (Array.isArray(allCouriers)) {
        allCouriers.forEach((courier) => {
          if (
            !courier?.id ||
            isInactiveCourier(courier)
          ) {
            return;
          }

          try {
            const location =
              storage.getCourierLocation(
                courier.id
              );

            if (location) {
              next[courier.id] =
                location;
            }
          } catch (error) {
            console.warn(
              `Kurye konumu alınamadı: ${courier.id}`,
              error
            );
          }
        });
      }

      setCourierLocations(next);
    } catch (error) {
      console.error(
        "Kurye konumları alınamadı:",
        error
      );
    } finally {
      setLocationLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();

    let unsubscribe:
      | (() => void)
      | undefined;

    try {
      unsubscribe =
        storage.subscribe(
          loadUsers
        );
    } catch (error) {
      console.warn(
        "Admin storage listener kurulamadı:",
        error
      );
    }

    return () =>
      unsubscribe?.();
  }, []);

  useEffect(() => {
    loadCourierLocations();

    let unsubscribe:
      | (() => void)
      | undefined;

    try {
      unsubscribe =
        storage.subscribe(
          loadCourierLocations
        );
    } catch (error) {
      console.warn(
        "Canlı konum listener kurulamadı:",
        error
      );
    }

    const interval =
      window.setInterval(
        loadCourierLocations,
        10000
      );

    return () => {
      unsubscribe?.();
      window.clearInterval(
        interval
      );
    };
  }, [couriers.length]);

  /*
   * CANLI DESTEK - ADMIN PANEL GENELİ
   *
   * Buradaki listener sayesinde:
   * - Yeni destek talebi anında gelir.
   * - Bekleyen destek sayısı anında güncellenir.
   * - Admin hangi sekmede olursa olsun sayı görünür.
   */
  useEffect(() => {
    let unsubscribe:
      | (() => void)
      | undefined;

    try {
      unsubscribe =
        supportService.subscribeAllTickets(
          (nextTickets) => {
            setSupportTickets(
              Array.isArray(nextTickets)
                ? nextTickets
                : []
            );
          }
        );
    } catch (error) {
      console.error(
        "Admin canlı destek listener başlatılamadı:",
        error
      );

      setSupportTickets([]);
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  const waitingSupportTickets =
    supportTickets.filter(
      (ticket) =>
        ticket.status ===
        "bekliyor"
    );

  const activeSupportTickets =
    supportTickets.filter(
      (ticket) =>
        ticket.status ===
        "aktif"
    );

  const activeCouriers =
    couriers.filter(
      (courier) =>
        !isInactiveCourier(courier)
    );

  const inactiveCouriers =
    couriers.filter(
      isInactiveCourier
    );

  const liveCouriers =
    activeCouriers.filter(
      (courier) =>
        courierLocations[
          courier.id
        ]?.isSharing === true
    );

  const totalOrders =
    safeOrders.length;

  const completedOrders =
    safeOrders.filter(
      (order) =>
        order.status ===
        "Teslim Edildi"
    ).length;

  const cancelledOrders =
    safeOrders.filter(
      (order) =>
        order.status ===
        "İptal Edildi"
    ).length;

  const waitingOrders =
    safeOrders.filter(
      (order) =>
        order.status ===
        "Kurye Bekleniyor"
    ).length;

  const assignedOrders =
    safeOrders.filter(
      (order) =>
        order.status ===
          "Kurye Atandı" ||
        order.status ===
          "Kurye Kabul Etti"
    ).length;

  const pickedUpOrders =
    safeOrders.filter(
      (order) =>
        order.status ===
        "Paket Alındı"
    ).length;

  const deliveringOrders =
    safeOrders.filter(
      (order) =>
        order.status ===
        "Teslimatta"
    ).length;

  const totalRevenue =
    safeOrders
      .filter(
        (order) =>
          order.status !==
          "İptal Edildi"
      )
      .reduce(
        (sum, order) =>
          sum +
          Number(
            order.price || 0
          ),
        0
      );

  const availableCouriers =
    activeCouriers.filter(
      (courier) =>
        courier.courierStatus ===
        "Müsait"
    ).length;

  const urgentOrders =
    safeOrders.filter(
      (order) =>
        (
          order.urgency ===
            "Acil" ||
          order.urgency ===
            "Çok Acil"
        ) &&
        order.status !==
          "Teslim Edildi" &&
        order.status !==
          "İptal Edildi"
    );

  const filteredOrders =
    useMemo(() => {
      const term =
        searchTerm
          .trim()
          .toLowerCase();

      return [...safeOrders]
        .filter((order) => {
          const matchesSearch =
            !term ||
            String(order.id)
              .toLowerCase()
              .includes(term) ||
            String(
              order.customerName
            )
              .toLowerCase()
              .includes(term) ||
            String(
              order.customerPhone
            )
              .toLowerCase()
              .includes(term) ||
            String(
              order.courierName ||
                ""
            )
              .toLowerCase()
              .includes(term) ||
            String(
              order.pickupAddress
            )
              .toLowerCase()
              .includes(term) ||
            String(
              order.deliveryAddress
            )
              .toLowerCase()
              .includes(term);

          const matchesStatus =
            statusFilter ===
              "Tümü" ||
            order.status ===
              statusFilter;

          return (
            matchesSearch &&
            matchesStatus
          );
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
      statusFilter,
    ]);

  const formatMoney = (
    value: number
  ) =>
    new Intl.NumberFormat(
      "tr-TR",
      {
        style: "currency",
        currency: "TRY",
        maximumFractionDigits: 0,
      }
    ).format(value || 0);

  const refresh = () => {
    loadUsers();
    loadCourierLocations();
    onRefreshData?.();
  };

  const openOrder = (
    order: Order
  ) => {
    setSelectedOrder(order);

    setEditPrice(
      String(order.price || 0)
    );

    setSelectedCourier(
      order.courierId || ""
    );

    setSelectedStatus(
      order.status
    );
  };

  const closeOrder = () => {
    if (saving) return;

    setSelectedOrder(null);
    setSelectedCourier("");
    setEditPrice("");
  };

  /*
   * SIPARIŞ GÜNCELLEME
   *
   * Tüm Firestore işlemleri async olarak
   * await edilir.
   *
   * updateOrderPrice kullanılmaz.
   * Fiyat değişikliği mevcut updateOrder()
   * metodu üzerinden yapılır.
   */
  const saveOrderChanges =
    async () => {
      if (!selectedOrder)
        return;

      setSaving(true);

      try {
        let currentOrder =
          storage.getOrderById(
            selectedOrder.id
          );

        if (!currentOrder) {
          alert(
            "Sipariş artık bulunamadı."
          );
          return;
        }

        if (
          selectedCourier &&
          selectedCourier !==
            currentOrder.courierId
        ) {
          await storage.assignCourier(
            currentOrder.id,
            selectedCourier
          );

          currentOrder =
            storage.getOrderById(
              selectedOrder.id
            ) || currentOrder;
        }

        if (
          selectedStatus !==
          currentOrder.status
        ) {
          await storage.updateOrderStatus(
            currentOrder.id,
            selectedStatus
          );

          currentOrder =
            storage.getOrderById(
              selectedOrder.id
            ) || currentOrder;
        }

        const numericPrice =
          Number(
            editPrice.replace(
              ",",
              "."
            )
          );

        if (
          Number.isFinite(
            numericPrice
          ) &&
          numericPrice >= 0 &&
          numericPrice !==
            Number(
              currentOrder.price
            )
        ) {
          await storage.updateOrder(
            currentOrder.id,
            {
              price:
                Math.round(
                  numericPrice
                ),
            }
          );

          currentOrder =
            storage.getOrderById(
              selectedOrder.id
            ) || currentOrder;
        }

        const updatedOrder =
          storage.getOrderById(
            selectedOrder.id
          );

        if (updatedOrder) {
          setSelectedOrder(
            updatedOrder
          );

          setEditPrice(
            String(
              updatedOrder.price ||
                0
            )
          );

          setSelectedCourier(
            updatedOrder.courierId ||
              ""
          );

          setSelectedStatus(
            updatedOrder.status
          );
        }

        refresh();

        alert(
          "Sipariş başarıyla güncellendi."
        );
      } catch (error) {
        console.error(
          "Sipariş güncelleme hatası:",
          error
        );

        alert(
          "Sipariş güncellenemedi. Firestore yetkilerini kontrol edin."
        );
      } finally {
        setSaving(false);
      }
    };

  const changeCourierStatus = (
    courierId: string,
    status: CourierAvailability
  ) => {
    try {
      storage.updateCourierStatus(
        courierId,
        status
      );

      if (
        status ===
        "Çevrimdışı"
      ) {
        void storage
          .setCourierOffline(
            courierId
          )
          .catch(
            () => undefined
          );
      }

      refresh();
    } catch (error) {
      console.error(
        "Kurye durumu güncellenemedi:",
        error
      );

      alert(
        "Kurye durumu güncellenemedi."
      );
    }
  };

  const handleCourierLeave =
    async (
      courier: UserProfile
    ) => {
      if (
        !courier.id ||
        isInactiveCourier(
          courier
        )
      ) {
        return;
      }

      const name =
        courier.name ||
        courier.email ||
        "Bu kurye";

      if (
        !window.confirm(
          `${name} işten ayrıldı olarak işaretlensin mi?\n\nFirebase hesabı ve geçmiş siparişleri korunacaktır.`
        )
      ) {
        return;
      }

      setChangingEmploymentId(
        courier.id
      );

      try {
        await storage.setCourierOffline(
          courier.id
        );

        await storage.updateCourierEmploymentStatus(
          courier.id,
          "inactive"
        );

        loadUsers();
        loadCourierLocations();
        onRefreshData?.();

        alert(
          `${name} pasif duruma alındı.`
        );
      } catch (error) {
        console.error(
          "Kurye pasifleştirme hatası:",
          error
        );

        alert(
          "Kurye pasifleştirilemedi."
        );
      } finally {
        setChangingEmploymentId(
          null
        );
      }
    };

  const handleReactivateCourier =
    async (
      courier: UserProfile
    ) => {
      if (!courier.id)
        return;

      setChangingEmploymentId(
        courier.id
      );

      try {
        await storage.updateCourierEmploymentStatus(
          courier.id,
          "active"
        );

        loadUsers();
        onRefreshData?.();

        alert(
          `${
            courier.name ||
            courier.email ||
            "Kurye"
          } yeniden aktif edildi.`
        );
      } catch (error) {
        console.error(
          "Kurye aktifleştirme hatası:",
          error
        );

        alert(
          "Kurye aktifleştirilemedi."
        );
      } finally {
        setChangingEmploymentId(
          null
        );
      }
    };

  const savePricing = async () => {
    if (pricingSaving) {
      return;
    }

    const nextPricing: PricingConfig = {
      ...pricing,
      perKmPrice: Math.max(0, Number(perKmPrice) || 0),
      minPrice: Math.max(0, Number(minPrice) || 0),
      urgentMultiplier: Math.max(1, Number(urgentMultiplier) || 1),
      vipMultiplier: Math.max(1, Number(vipMultiplier) || 1),
      updatedAt: new Date().toISOString(),
    };

    try {
      setPricingSaving(true);

      if (
        typeof storage.updatePricing ===
        "function"
      ) {
        await storage.updatePricing(
          nextPricing
        );
      } else if (
        typeof storage.setPricing ===
        "function"
      ) {
        await storage.setPricing(
          nextPricing
        );
      } else {
        throw new Error(
          "Pricing API bulunamadı."
        );
      }

      onRefreshData?.();

      alert(
        "Fiyatlandırma başarıyla kaydedildi."
      );
    } catch (error) {
      console.error(
        "Fiyatlandırma hatası:",
        error
      );

      alert(
        "Fiyatlandırma kaydedilemedi."
      );
    } finally {
      setPricingSaving(false);
    }
  };

  const openCourierProfile = (courier: UserProfile) => {
    setSelectedCourierProfile(courier);
    setCourierVehicle(courier.vehicle || "");
    setCourierPlate(courier.plate || "");
  };

  const openCourierRatings = (courier: UserProfile) => {
    if (!courier?.id) {
      return;
    }

    setSelectedCourierRatings(courier);
  };

  const saveCourierVehicle = async () => {
    if (!selectedCourierProfile || profileSaving) {
      return;
    }

    try {
      setProfileSaving(true);
      await storage.updateUser(selectedCourierProfile.id, {
        vehicle: courierVehicle.trim(),
        plate: courierPlate.trim().toLocaleUpperCase("tr-TR"),
      });
      loadUsers();
      setSelectedCourierProfile(null);
    } catch (error) {
      console.error("Kurye araç bilgisi kaydedilemedi:", error);
      alert("Kurye araç bilgisi kaydedilemedi.");
    } finally {
      setProfileSaving(false);
    }
  };

  const deleteCancelledOrder = async () => {
    if (
      !selectedOrder ||
      selectedOrder.status !== "İptal Edildi" ||
      deletingOrderId
    ) {
      return;
    }

    const confirmed = window.confirm(
      `#${selectedOrder.id} numaralı iptal edilmiş sipariş kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingOrderId(selectedOrder.id);
      await storage.deleteOrder(selectedOrder.id);
      closeOrder();
    } catch (error) {
      console.error("İptal edilen sipariş silinemedi:", error);
      alert("İptal edilen sipariş silinemedi.");
    } finally {
      setDeletingOrderId(null);
    }
  };

  const tabs: {
    id: AdminTab;
    label: string;
    icon: React.ElementType;
  }[] = [
    {
      id: "dashboard",
      label: "Dashboard",
      icon: BarChart3,
    },
    {
      id: "orders",
      label: "Siparişler",
      icon: Package,
    },
    {
      id: "couriers",
      label: "Kuryeler",
      icon: Truck,
    },
    {
      id: "customers",
      label: "Müşteriler",
      icon: Users,
    },
    {
      id: "pricing",
      label: "Fiyatlandırma",
      icon: DollarSign,
    },
    {
      id: "support",
      label: "Canlı Destek",
      icon: Headphones,
    },
    {
      id: "settings",
      label: "Sistem",
      icon: Settings,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0B0B0D] text-white">
      <header className="sticky top-0 z-30 border-b border-[#303036] bg-[#0B0B0D]/95 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-[#D6A84F]/30 bg-[#D6A84F]/15 p-2.5">
                <ShieldCheck
                  size={22}
                  className="text-[#D6A84F]"
                />
              </div>

              <div>
                <h1 className="text-xl font-bold">
                  Operasyon Merkezi
                </h1>

                <p className="text-xs text-[#999999]">
                  Trustline Express • Canlı kontrol paneli
                </p>
              </div>
            </div>

            <button
              onClick={refresh}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#303036] bg-[#19191E] px-4 py-2 text-sm transition hover:border-[#D6A84F]/50"
            >
              <RefreshCw size={16} />
              Yenile
            </button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => {
              const Icon =
                tab.icon;

              const isSupport =
                tab.id ===
                "support";

              const supportCount =
                waitingSupportTickets.length;

              return (
                <button
                  key={tab.id}
                  onClick={() =>
                    setActiveTab(
                      tab.id
                    )
                  }
                  className={`relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                    activeTab ===
                    tab.id
                      ? "bg-[#D6A84F] text-[#0B0B0D]"
                      : "border border-[#303036] bg-[#19191E] text-[#999999] hover:text-white"
                  }`}
                >
                  <Icon size={16} />

                  {tab.label}

                  {isSupport &&
                    supportCount >
                      0 && (
                      <span
                        className={`ml-1 flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          activeTab ===
                          "support"
                            ? "bg-[#0B0B0D] text-[#D6A84F]"
                            : "bg-red-500 text-white"
                        }`}
                      >
                        {supportCount >
                        99
                          ? "99+"
                          : supportCount}
                      </span>
                    )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {waitingSupportTickets.length >
        0 && (
        <div className="mx-auto max-w-7xl px-4 pt-4">
          <button
            type="button"
            onClick={() =>
              setActiveTab(
                "support"
              )
            }
            className="flex w-full items-center justify-between gap-4 rounded-2xl border border-[#D6A84F]/30 bg-[#D6A84F]/5 px-4 py-3 text-left transition hover:border-[#D6A84F]/60 hover:bg-[#D6A84F]/10"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#D6A84F]/15">
                <Headphones
                  size={19}
                  className="text-[#D6A84F]"
                />
              </div>

              <div className="min-w-0">
                <p className="font-semibold text-white">
                  Yeni canlı destek talebi
                </p>

                <p className="mt-0.5 truncate text-xs text-[#999999]">
                  {waitingSupportTickets.length ===
                  1
                    ? "1 müşteri yönetici desteği bekliyor."
                    : `${waitingSupportTickets.length} müşteri yönetici desteği bekliyor.`}
                </p>
              </div>
            </div>

            <span className="flex shrink-0 items-center gap-2 rounded-xl bg-[#D6A84F] px-3 py-2 text-xs font-bold text-[#0B0B0D]">
              Destek Taleplerini Aç
              <ChevronRight
                size={15}
              />
            </span>
          </button>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-6">
        {activeTab ===
          "dashboard" && (
          <div className="space-y-6">
            {urgentOrders.length >
              0 && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                <div className="flex gap-3">
                  <AlertCircle
                    size={20}
                    className="text-red-400"
                  />

                  <div>
                    <h3 className="font-semibold text-red-300">
                      Acil siparişler var
                    </h3>

                    <p className="mt-1 text-sm text-red-200/80">
                      {
                        urgentOrders.length
                      }{" "}
                      adet acil veya
                      çok acil sipariş
                      aktif.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                title="Toplam Sipariş"
                value={
                  totalOrders
                }
                icon={
                  <Package size={20} />
                }
              />

              <StatCard
                title="Toplam Ciro"
                value={formatMoney(
                  totalRevenue
                )}
                icon={
                  <DollarSign size={20} />
                }
              />

              <StatCard
                title="Müsait Kurye"
                value={`${availableCouriers}/${activeCouriers.length}`}
                icon={
                  <Truck size={20} />
                }
              />

              <StatCard
                title="Teslim Edilen"
                value={
                  completedOrders
                }
                icon={
                  <CheckCircle2
                    size={20}
                  />
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <MiniStat
                title="Bekliyor"
                value={
                  waitingOrders
                }
              />

              <MiniStat
                title="Atandı"
                value={
                  assignedOrders
                }
              />

              <MiniStat
                title="Paket Alındı"
                value={
                  pickedUpOrders
                }
              />

              <MiniStat
                title="Teslimatta"
                value={
                  deliveringOrders
                }
              />

              <MiniStat
                title="İptal"
                value={
                  cancelledOrders
                }
              />
            </div>

            <section className="grid gap-3 md:grid-cols-3">
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("Kurye Bekleniyor");
                  setActiveTab("orders");
                }}
                className="group rounded-2xl border border-blue-500/20 bg-blue-500/[0.04] p-4 text-left transition hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-500/[0.08]"
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-blue-500/10 p-2 text-blue-300">
                    <Package size={18} />
                  </div>
                  <ChevronRight size={16} className="text-blue-300 transition group-hover:translate-x-1" />
                </div>
                <p className="mt-4 text-sm font-black text-white">Bekleyen siparişleri yönet</p>
                <p className="mt-1 text-xs text-[#8F8F99]">{waitingOrders} sipariş kurye ataması bekliyor.</p>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("couriers")}
                className="group rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-400/40 hover:bg-emerald-500/[0.08]"
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-300">
                    <Truck size={18} />
                  </div>
                  <ChevronRight size={16} className="text-emerald-300 transition group-hover:translate-x-1" />
                </div>
                <p className="mt-4 text-sm font-black text-white">Kurye filoyu yönet</p>
                <p className="mt-1 text-xs text-[#8F8F99]">{availableCouriers} kurye şu an müsait görünüyor.</p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setStatusFilter("İptal Edildi");
                  setActiveTab("orders");
                }}
                className="group rounded-2xl border border-red-500/20 bg-red-500/[0.04] p-4 text-left transition hover:-translate-y-0.5 hover:border-red-400/40 hover:bg-red-500/[0.08]"
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-red-500/10 p-2 text-red-300">
                    <Trash2 size={18} />
                  </div>
                  <ChevronRight size={16} className="text-red-300 transition group-hover:translate-x-1" />
                </div>
                <p className="mt-4 text-sm font-black text-white">İptal kayıtlarını temizle</p>
                <p className="mt-1 text-xs text-[#8F8F99]">{cancelledOrders} kayıt detaydan güvenle silinebilir.</p>
              </button>
            </section>

            <div className="rounded-2xl border border-[#303036] bg-[#19191E] p-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-500/10 p-2">
                  <Activity
                    size={20}
                    className="text-emerald-400"
                  />
                </div>

                <div>
                  <h2 className="font-semibold">
                    Sistem Durumu
                  </h2>

                  <p className="text-sm text-emerald-400">
                    Firebase bağlantısı
                    aktif
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[#303036] bg-[#19191E]">
              <div className="flex items-center justify-between border-b border-[#303036] p-5">
                <div>
                  <h2 className="font-semibold">
                    Son Siparişler
                  </h2>

                  <p className="text-sm text-[#999999]">
                    En son oluşturulan
                    gönderiler
                  </p>
                </div>

                <button
                  onClick={() =>
                    setActiveTab(
                      "orders"
                    )
                  }
                  className="flex items-center gap-1 text-sm text-[#D6A84F]"
                >
                  Tümünü Gör
                  <ChevronRight
                    size={16}
                  />
                </button>
              </div>

              <div className="divide-y divide-[#303036]">
                {safeOrders
                  .slice(0, 8)
                  .map(
                    (order) => (
                      <OrderRow
                        key={
                          order.id
                        }
                        order={
                          order
                        }
                        onClick={() =>
                          openOrder(
                            order
                          )
                        }
                      />
                    )
                  )}

                {safeOrders.length ===
                  0 && (
                  <EmptyState text="Henüz sipariş bulunmuyor." />
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab ===
          "orders" && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]"
                />

                <input
                  value={
                    searchTerm
                  }
                  onChange={(
                    event
                  ) =>
                    setSearchTerm(
                      event.target
                        .value
                    )
                  }
                  placeholder="Sipariş, müşteri, kurye veya adres ara..."
                  className="w-full rounded-xl border border-[#303036] bg-[#19191E] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#D6A84F]"
                />
              </div>

              <select
                value={
                  statusFilter
                }
                onChange={(
                  event
                ) =>
                  setStatusFilter(
                    event.target
                      .value as
                      | "Tümü"
                      | OrderStatus
                  )
                }
                className="rounded-xl border border-[#303036] bg-[#19191E] px-4 py-3 text-sm outline-none"
              >
                <option>
                  Tümü
                </option>

                {ORDER_STATUSES.map(
                  (status) => (
                    <option
                      key={
                        status
                      }
                      value={
                        status
                      }
                    >
                      {
                        status
                      }
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="grid gap-3">
              {filteredOrders.map(
                (order) => (
                  <button
                    key={
                      order.id
                    }
                    onClick={() =>
                      openOrder(
                        order
                      )
                    }
                    className="w-full rounded-2xl border border-[#303036] bg-[#19191E] p-5 text-left transition hover:border-[#D6A84F]/50"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">
                            #
                            {
                              order.id
                            }
                          </span>

                          <StatusBadge
                            status={
                              order.status
                            }
                          />
                        </div>

                        <p className="mt-2 text-sm text-slate-300">
                          {
                            order.customerName ||
                            "Müşteri"
                          }
                        </p>

                        <div className="mt-2 space-y-1 text-xs text-[#777777]">
                          <p>
                            <MapPin
                              size={
                                13
                              }
                              className="mr-1 inline"
                            />
                            {
                              order.pickupAddress
                            }
                          </p>

                          <p>
                            <MapPin
                              size={
                                13
                              }
                              className="mr-1 inline"
                            />
                            {
                              order.deliveryAddress
                            }
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-left md:text-right">
                        <p className="text-lg font-bold text-[#D6A84F]">
                          {formatMoney(
                            Number(
                              order.price ||
                                0
                            )
                          )}
                        </p>

                        <p className="text-xs text-[#777777]">
                          {
                            order.distanceKm ||
                            0
                          }{" "}
                          km
                        </p>
                      </div>
                    </div>
                  </button>
                )
              )}

              {filteredOrders.length ===
                0 && (
                <EmptyState text="Arama kriterlerine uygun sipariş bulunamadı." />
              )}
            </div>
          </div>
        )}

        {activeTab ===
          "couriers" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Kuryeler
                </h2>

                <p className="text-sm text-[#999999]">
                  {
                    activeCouriers.length
                  }{" "}
                  aktif •{" "}
                  {
                    inactiveCouriers.length
                  }{" "}
                  pasif
                </p>
              </div>

              <button
                onClick={
                  loadCourierLocations
                }
                disabled={
                  locationLoading
                }
                className="flex items-center justify-center gap-2 rounded-xl border border-[#303036] bg-[#19191E] px-4 py-2 text-sm disabled:opacity-50"
              >
                <RefreshCw
                  size={16}
                  className={
                    locationLoading
                      ? "animate-spin"
                      : ""
                  }
                />

                GPS Yenile
              </button>
            </div>

            <section className="rounded-2xl border border-emerald-500/20 bg-[#101514] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold">
                    Canlı Kurye Konumları
                  </h3>

                  <p className="text-xs text-[#777777]">
                    Aktif ve canlı GPS
                    paylaşan kuryeler
                  </p>
                </div>

                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-400">
                  {
                    liveCouriers.length
                  }{" "}
                  canlı
                </span>
              </div>

              {liveCouriers.length ===
              0 ? (
                <div className="rounded-xl border border-dashed border-[#303036] bg-[#0B0B0D] p-6 text-center text-sm text-[#777777]">
                  Şu anda canlı GPS
                  paylaşan aktif kurye
                  yok.
                </div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {liveCouriers.map(
                    (courier) => (
                      <LiveCourierLocationCard
                        key={
                          courier.id
                        }
                        courier={
                          courier
                        }
                        location={
                          courierLocations[
                            courier.id
                          ]
                        }
                      />
                    )
                  )}
                </div>
              )}
            </section>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeCouriers.map(
                (courier) => {
                  const location =
                    courierLocations[
                      courier.id
                    ];

                  const sharing =
                    location?.isSharing ===
                    true;

                  return (
                    <div
                      key={
                        courier.id
                      }
                      className="rounded-2xl border border-[#303036] bg-[#19191E] p-5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="rounded-full bg-[#D6A84F]/10 p-3">
                            <Truck
                              size={
                                20
                              }
                              className="text-[#D6A84F]"
                            />
                          </div>

                          <div className="min-w-0">
                            <h3 className="truncate font-semibold">
                              {
                                courier.name ||
                                "Kurye"
                              }
                            </h3>

                            <p className="truncate text-xs text-[#777777]">
                              {
                                courier.email
                              }
                            </p>

                            <p className="text-xs text-[#777777]">
                              {
                                courier.phone
                              }
                            </p>
                          </div>
                        </div>

                        <span
                          className={`h-3 w-3 shrink-0 rounded-full ${
                            courier.courierStatus ===
                            "Müsait"
                              ? "bg-emerald-400"
                              : courier.courierStatus ===
                                "Meşgul"
                              ? "bg-amber-400"
                              : "bg-slate-600"
                          }`}
                        />
                      </div>

                      {(() => {
                        const assignedOrder = safeOrders.find(
                          (order) =>
                            order.courierId === courier.id &&
                            order.status !== "Teslim Edildi" &&
                            order.status !== "İptal Edildi"
                        );

                        const assigned = Boolean(assignedOrder);
                        const deliveryActive =
                          assignedOrder?.status === "Teslimatta";
                        const packagePickedUp =
                          assignedOrder?.status === "Paket Alındı";
                        const waitingToPickup =
                          assignedOrder?.status === "Kurye Atandı" ||
                          assignedOrder?.status === "Kurye Kabul Etti";

                        const displayStatus = deliveryActive
                          ? "TESLİMATTA"
                          : packagePickedUp
                          ? "PAKET ALINDI"
                          : waitingToPickup
                          ? "GÖREV ATANDI"
                          : courier.courierStatus || "ÇEVRİMDIŞI";

                        const availabilityLabel = deliveryActive
                          ? "Teslimat yapıyor"
                          : packagePickedUp
                          ? "Paket alındı • teslimata hazırlanıyor"
                          : waitingToPickup
                          ? "Paket alacak görev üzerinde"
                          : courier.courierStatus === "Müsait"
                          ? "Paket almaya müsait"
                          : courier.courierStatus === "Meşgul"
                          ? "Meşgul"
                          : "Paket almaya uygun değil";

                        const availabilityClass = assigned
                          ? deliveryActive
                            ? "border-sky-500/20 bg-sky-500/5 text-sky-300"
                            : packagePickedUp
                            ? "border-violet-500/20 bg-violet-500/5 text-violet-300"
                            : "border-amber-500/20 bg-amber-500/5 text-amber-300"
                          : courier.courierStatus === "Müsait"
                          ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-300"
                          : courier.courierStatus === "Meşgul"
                          ? "border-amber-500/20 bg-amber-500/5 text-amber-300"
                          : "border-[#303036] bg-[#0B0B0D] text-[#999999]";

                        return (
                          <div className={`mb-4 rounded-xl border p-3 ${availabilityClass}`}>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-xs font-semibold text-[#999999]">
                                Kurye durumu
                              </span>
                              <span className="text-[10px] font-black uppercase tracking-wide">
                                {displayStatus}
                              </span>
                            </div>

                            <p className="mt-2 text-sm font-bold">{availabilityLabel}</p>

                            {assignedOrder && (
                              <div className="mt-2 rounded-lg bg-black/20 p-2.5 text-[11px] leading-5 text-[#BDBDBD]">
                                <div className="font-semibold text-white">
                                  Sipariş #{assignedOrder.id}
                                </div>
                                <div className="mt-0.5 truncate">
                                  {assignedOrder.status === "Teslimatta"
                                    ? assignedOrder.deliveryAddress
                                    : assignedOrder.pickupAddress}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      <div
                        className={`rounded-xl border p-3 ${
                          sharing
                            ? "border-emerald-500/20 bg-emerald-500/5"
                            : "border-[#303036] bg-[#0B0B0D]"
                        }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-[#777777]">
                            Canlı GPS
                          </span>

                          <span
                            className={`text-[10px] font-bold ${
                              sharing
                                ? "text-emerald-400"
                                : "text-[#777777]"
                            }`}
                          >
                            {sharing
                              ? "AKTİF"
                              : "KAPALI"}
                          </span>
                        </div>

                        {sharing &&
                          location && (
                            <p className="mt-2 text-[11px] text-[#999999]">
                              {location.latitude.toFixed(
                                6
                              )}
                              ,{" "}
                              {location.longitude.toFixed(
                                6
                              )}
                            </p>
                          )}
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-xs text-[#777777]">
                          Kurye Durumu
                        </label>

                        <select
                          value={
                            courier.courierStatus ||
                            "Çevrimdışı"
                          }
                          onChange={(
                            event
                          ) =>
                            changeCourierStatus(
                              courier.id,
                              event
                                .target
                                .value as CourierAvailability
                            )
                          }
                          className="w-full rounded-xl border border-[#303036] bg-[#0B0B0D] px-3 py-2 text-sm"
                        >
                          {COURIER_STATUSES.map(
                            (
                              status
                            ) => (
                              <option
                                key={
                                  status
                                }
                                value={
                                  status
                                }
                              >
                                {
                                  status
                                }
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-[#0B0B0D] p-3">
                          <p className="text-[10px] text-[#777777]">
                            Teslimat
                          </p>

                          <p className="mt-1 font-bold">
                            {
                              courier.totalDeliveries
                            }
                          </p>
                        </div>

                        <div className="rounded-xl bg-[#0B0B0D] p-3">
                          <p className="text-[10px] text-[#777777]">
                            Puan
                          </p>

                          <p className="mt-1 font-bold text-[#D6A84F]">
                            {courierRatingStats[courier.id]?.count
                              ? courierRatingStats[courier.id].average.toFixed(1)
                              : "—"}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => openCourierProfile(courier)}
                        className="mt-4 w-full rounded-xl border border-[#303036] bg-[#0B0B0D] p-3 text-left transition hover:border-[#D6A84F]/40 hover:bg-[#15151A]"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-[#777777]">
                              Araç & plaka
                            </p>
                            <p className="mt-1 truncate text-xs font-semibold text-[#D6A84F]">
                              {courier.plate || "Plaka eklenmedi"}
                            </p>
                            {courier.vehicle && (
                              <p className="mt-0.5 truncate text-[10px] text-[#777777]">
                                {courier.vehicle}
                              </p>
                            )}
                          </div>

                          <Car size={18} className="shrink-0 text-[#D6A84F]" />
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => openCourierProfile(courier)}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#D6A84F]/25 bg-[#D6A84F]/5 py-2.5 text-xs font-bold text-[#D6A84F] transition hover:bg-[#D6A84F]/10"
                      >
                        <Car size={14} />
                        Araç Bilgilerini Düzenle
                      </button>

                      <button
                        type="button"
                        onClick={() => openCourierRatings(courier)}
                        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#D6A84F]/25 bg-[#D6A84F]/5 py-2.5 text-xs font-bold text-[#D6A84F] transition hover:bg-[#D6A84F]/10"
                      >
                        <Star size={14} className="fill-current" />
                        ⭐ Puan Değerlendirmeleri
                        <span className="ml-1 rounded-full bg-[#D6A84F]/10 px-1.5 py-0.5 text-[10px]">
                          {courierRatingStats[courier.id]?.count ?? 0}
                        </span>
                      </button>

                      <button
                        disabled={
                          changingEmploymentId ===
                          courier.id
                        }
                        onClick={() =>
                          void handleCourierLeave(
                            courier
                          )
                        }
                        className="mt-4 w-full rounded-xl border border-red-500/20 bg-red-500/5 py-2 text-xs font-semibold text-red-300 disabled:opacity-50"
                      >
                        {changingEmploymentId ===
                        courier.id
                          ? "İşleniyor..."
                          : "İşten Ayrıldı"}
                      </button>
                    </div>
                  );
                }
              )}
            </div>

            {inactiveCouriers.length >
              0 && (
              <section className="rounded-2xl border border-[#303036] bg-[#19191E] p-5">
                <h3 className="font-semibold">
                  Pasif Kuryeler
                </h3>

                <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {inactiveCouriers.map(
                    (courier) => (
                      <div
                        key={
                          courier.id
                        }
                        className="rounded-xl border border-[#303036] bg-[#0B0B0D] p-4"
                      >
                        <p className="font-semibold">
                          {
                            courier.name ||
                            courier.email
                          }
                        </p>

                        <p className="mt-1 text-xs text-[#777777]">
                          {
                            courier.email
                          }
                        </p>

                        <button
                          disabled={
                            changingEmploymentId ===
                            courier.id
                          }
                          onClick={() =>
                            void handleReactivateCourier(
                              courier
                            )
                          }
                          className="mt-3 w-full rounded-xl bg-[#D6A84F] py-2 text-xs font-bold text-[#0B0B0D] disabled:opacity-50"
                        >
                          {changingEmploymentId ===
                          courier.id
                            ? "İşleniyor..."
                            : "Yeniden Aktifleştir"}
                        </button>
                      </div>
                    )
                  )}
                </div>
              </section>
            )}

            {activeCouriers.length ===
              0 && (
              <EmptyState text="Aktif kurye bulunmuyor." />
            )}
          </div>
        )}

        {activeTab ===
          "customers" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">
                Müşteriler
              </h2>

              <p className="text-sm text-[#999999]">
                {
                  customers.length
                }{" "}
                gerçek müşteri hesabı
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {customers.map(
                (customer) => {
                  const customerOrders =
                    safeOrders.filter(
                      (order) =>
                        order.customerId ===
                        customer.id
                    );

                  const customerRevenue =
                    customerOrders
                      .filter(
                        (order) =>
                          order.status !==
                          "İptal Edildi"
                      )
                      .reduce(
                        (
                          sum,
                          order
                        ) =>
                          sum +
                          Number(
                            order.price ||
                              0
                          ),
                        0
                      );

                  return (
                    <div
                      key={
                        customer.id
                      }
                      role="button"
                      tabIndex={0}
                      onClick={() =>
                        setSelectedCustomerProfile(customer)
                      }
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelectedCustomerProfile(customer);
                        }
                      }}
                      className="rounded-2xl border border-[#303036] bg-[#19191E] p-5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-blue-500/10 p-3">
                          <Users
                            size={
                              20
                            }
                            className="text-blue-400"
                          />
                        </div>

                        <div className="min-w-0">
                          <h3 className="truncate font-semibold">
                            {
                              customer.name
                            }
                          </h3>

                          <p className="truncate text-xs text-[#777777]">
                            {
                              customer.email
                            }
                          </p>

                          <p className="text-xs text-[#777777]">
                            {
                              customer.phone
                            }
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-[#0B0B0D] p-3">
                          <p className="text-xs text-[#777777]">
                            Sipariş
                          </p>

                          <p className="mt-1 font-bold">
                            {
                              customerOrders.length
                            }
                          </p>
                        </div>

                        <div className="rounded-xl bg-[#0B0B0D] p-3">
                          <p className="text-xs text-[#777777]">
                            Harcama
                          </p>

                          <p className="mt-1 text-sm font-bold text-[#D6A84F]">
                            {formatMoney(
                              customerRevenue
                            )}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedCustomerProfile(customer);
                        }}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-blue-500/25 bg-blue-500/5 py-2.5 text-xs font-bold text-blue-300 transition hover:bg-blue-500/10"
                      >
                        <Users size={14} />
                        Müşteri Profilini Aç
                      </button>
                    </div>
                  );
                }
              )}

              {customers.length ===
                0 && (
                <EmptyState text="Firestore'da henüz müşteri profili bulunmuyor." />
              )}
            </div>
          </div>
        )}

        {activeTab ===
          "pricing" && (
          <div className="mx-auto max-w-2xl space-y-5">
            <div>
              <h2 className="text-xl font-bold">
                Fiyatlandırma
              </h2>

              <p className="text-sm text-[#999999]">
                Yeni siparişlerin fiyat
                hesaplamasını yönet.
              </p>
            </div>

            <div className="space-y-5 rounded-2xl border border-[#303036] bg-[#19191E] p-5">
              <NumberField
                label="KM Başına Fiyat"
                value={
                  perKmPrice
                }
                onChange={
                  setPerKmPrice
                }
              />

              <NumberField
                label="Minimum Fiyat"
                value={minPrice}
                onChange={
                  setMinPrice
                }
              />

              <NumberField
                label="Acil Çarpanı"
                value={
                  urgentMultiplier
                }
                step={0.05}
                onChange={
                  setUrgentMultiplier
                }
              />

              <NumberField
                label="VIP Çarpanı"
                value={
                  vipMultiplier
                }
                step={0.05}
                onChange={
                  setVipMultiplier
                }
              />

              <div className="rounded-xl border border-[#303036] bg-[#0B0B0D] p-4">
                <p className="text-xs text-[#777777]">
                  Mevcut hesaplama
                </p>

                <p className="mt-1 text-lg font-bold text-[#D6A84F]">
                  KM ×{" "}
                  {
                    perKmPrice
                  }{" "}
                  TL{" "}
                  <span className="text-xs text-[#777777]">
                    • minimum{" "}
                    {
                      minPrice
                    }{" "}
                    TL
                  </span>
                </p>
              </div>

              <button
                disabled={pricingSaving}
                onClick={
                  savePricing
                }
                className="w-full rounded-xl bg-[#D6A84F] py-3 font-bold text-[#0B0B0D] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pricingSaving
                  ? "Firebase'e kaydediliyor..."
                  : "Fiyatları Firebase'e Kaydet"}
              </button>
            </div>
          </div>
        )}

        {activeTab ===
          "support" && (
          <div
            id="trustline-admin-support"
            className="scroll-mt-28"
          >
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-[#303036] bg-[#19191E] p-4">
                <p className="text-xs text-[#777777]">
                  Bekleyen
                </p>

                <p className="mt-1 text-2xl font-bold text-[#D6A84F]">
                  {
                    waitingSupportTickets.length
                  }
                </p>
              </div>

              <div className="rounded-2xl border border-[#303036] bg-[#19191E] p-4">
                <p className="text-xs text-[#777777]">
                  Aktif
                </p>

                <p className="mt-1 text-2xl font-bold text-emerald-400">
                  {
                    activeSupportTickets.length
                  }
                </p>
              </div>

              <div className="col-span-2 rounded-2xl border border-[#303036] bg-[#19191E] p-4 md:col-span-1">
                <p className="text-xs text-[#777777]">
                  Toplam kayıt
                </p>

                <p className="mt-1 text-2xl font-bold">
                  {
                    supportTickets.length
                  }
                </p>
              </div>
            </div>

            <LiveSupport isAdmin />
          </div>
        )}

        {activeTab ===
          "settings" && (
          <div className="mx-auto max-w-2xl space-y-5">
            <div>
              <h2 className="text-xl font-bold">
                Sistem
              </h2>

              <p className="text-sm text-[#999999]">
                Trustline Express V1
                sistem durumu.
              </p>
            </div>

            <div className="space-y-3 rounded-2xl border border-[#303036] bg-[#19191E] p-5">
              <SettingRow
                icon={
                  <ShieldCheck
                    size={20}
                  />
                }
                title="Firebase Authentication"
                description="Gerçek e-posta/şifre kullanıcı hesapları"
                status="Aktif"
              />

              <SettingRow
                icon={
                  <Activity
                    size={20}
                  />
                }
                title="Firestore"
                description="Sipariş, kullanıcı, fiyat ve konum verileri"
                status="Aktif"
              />

              <SettingRow
                icon={
                  <Zap size={20} />
                }
                title="Yapay Zeka"
                description="Trustline AI entegrasyonu"
                status="Aktif"
              />

              <SettingRow
                icon={
                  <Truck size={20} />
                }
                title="Kurye GPS"
                description={`${liveCouriers.length} kurye canlı konum paylaşıyor`}
                status="V1"
              />

              <SettingRow
                icon={
                  <Headphones
                    size={20}
                  />
                }
                title="Canlı Destek"
                description={`${waitingSupportTickets.length} bekleyen • ${activeSupportTickets.length} aktif destek`}
                status="Aktif"
              />
            </div>
          </div>
        )}
      </main>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-[#303036] bg-[#111116] p-5 sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-[#777777]">
                  Sipariş Yönetimi
                </p>

                <h2 className="mt-1 text-lg font-bold">
                  #
                  {
                    selectedOrder.id
                  }
                </h2>
              </div>

              <button
                onClick={
                  closeOrder
                }
                className="rounded-xl border border-[#303036] bg-[#19191E] p-2 text-[#999999]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-[#303036] bg-[#19191E] p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoItem
                    label="Müşteri"
                    value={
                      selectedOrder.customerName
                    }
                  />

                  <InfoItem
                    label="Telefon"
                    value={
                      selectedOrder.customerPhone ||
                      "—"
                    }
                  />

                  <InfoItem
                    label="Alım"
                    value={
                      selectedOrder.pickupAddress
                    }
                  />

                  <InfoItem
                    label="Teslimat"
                    value={
                      selectedOrder.deliveryAddress
                    }
                  />

                  <InfoItem
                    label="Mesafe"
                    value={`${selectedOrder.distanceKm} km`}
                  />

                  <InfoItem
                    label="Kurye Tipi"
                    value={
                      selectedOrder.courierType
                    }
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-xs text-[#777777]">
                    Kurye Ata
                  </label>

                  <select
                    value={
                      selectedCourier
                    }
                    onChange={(
                      event
                    ) =>
                      setSelectedCourier(
                        event.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-[#303036] bg-[#19191E] px-3 py-3 text-sm"
                  >
                    <option value="">
                      Kurye seçilmedi
                    </option>

                    {activeCouriers.map(
                      (courier) => (
                        <option
                          key={
                            courier.id
                          }
                          value={
                            courier.id
                          }
                        >
                          {
                            courier.name
                          }{" "}
                          •{" "}
                          {
                            courier.courierStatus ||
                            "Çevrimdışı"
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-xs text-[#777777]">
                    Sipariş Durumu
                  </label>

                  <select
                    value={
                      selectedStatus
                    }
                    onChange={(
                      event
                    ) =>
                      setSelectedStatus(
                        event.target
                          .value as OrderStatus
                      )
                    }
                    className="w-full rounded-xl border border-[#303036] bg-[#19191E] px-3 py-3 text-sm"
                  >
                    {ORDER_STATUSES.map(
                      (status) => (
                        <option
                          key={
                            status
                          }
                          value={
                            status
                          }
                        >
                          {
                            status
                          }
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs text-[#777777]">
                  Sipariş Fiyatı
                </label>

                <input
                  type="number"
                  min="0"
                  value={
                    editPrice
                  }
                  onChange={(
                    event
                  ) =>
                    setEditPrice(
                      event.target
                        .value
                    )
                  }
                  className="w-full rounded-xl border border-[#303036] bg-[#19191E] px-4 py-3 text-sm"
                />
              </div>

              {selectedOrder.deliveryProof && (
                <DeliveryProofCard
                  order={
                    selectedOrder
                  }
                />
              )}

              {selectedOrder.status ===
                "Teslim Edildi" &&
                !selectedOrder.deliveryProof &&
                !selectedOrder.signature && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                    Teslim edildi olarak
                    işaretlenmiş ancak
                    teslim kanıtı
                    bulunmuyor.
                  </div>
                )}

              <button
                disabled={saving}
                onClick={
                  saveOrderChanges
                }
                className="w-full rounded-xl bg-[#D6A84F] py-3 font-bold text-[#0B0B0D] disabled:opacity-50"
              >
                {saving
                  ? "Kaydediliyor..."
                  : "Siparişi Güncelle"}
              </button>

              {selectedOrder.status ===
                "İptal Edildi" && (
                <button
                  type="button"
                  disabled={
                    deletingOrderId ===
                    selectedOrder.id
                  }
                  onClick={
                    deleteCancelledOrder
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-bold text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  {deletingOrderId ===
                  selectedOrder.id
                    ? "Sipariş siliniyor..."
                    : "İptal Edilmiş Siparişi Sil"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedCourierProfile &&
        createPortal(
        <div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-lg rounded-t-3xl border border-[#303036] bg-[#111116] p-5 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#D6A84F]/10 p-3">
                  <Car size={21} className="text-[#D6A84F]" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#D6A84F]">
                    Araç bilgileri
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-white">
                    {selectedCourierProfile.name || "Kurye"}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCourierProfile(null)}
                className="rounded-xl border border-[#303036] bg-[#19191E] p-2 text-[#999999]"
                aria-label="Kapat"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <InfoItem label="E-posta" value={selectedCourierProfile.email || "—"} />
              <InfoItem label="Telefon" value={selectedCourierProfile.phone || "—"} />
            </div>

            <div className="mt-5 space-y-4 rounded-2xl border border-[#303036] bg-[#19191E] p-4">
              <div>
                <label className="mb-2 block text-xs font-semibold text-[#999999]">
                  Araç bilgisi
                </label>
                <input
                  value={courierVehicle}
                  onChange={(event) => setCourierVehicle(event.target.value)}
                  placeholder="Örn. Honda PCX 125"
                  className="w-full rounded-xl border border-[#303036] bg-[#0B0B0D] px-4 py-3 text-sm outline-none focus:border-[#D6A84F]"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-[#999999]">
                  Plaka
                </label>
                <input
                  value={courierPlate}
                  onChange={(event) => setCourierPlate(event.target.value)}
                  placeholder="34 ABC 123"
                  className="w-full rounded-xl border border-[#303036] bg-[#0B0B0D] px-4 py-3 text-sm uppercase outline-none focus:border-[#D6A84F]"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={profileSaving}
              onClick={saveCourierVehicle}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#D6A84F] py-3 font-bold text-[#0B0B0D] disabled:opacity-50"
            >
              <CheckCircle2 size={17} />
              {profileSaving ? "Kaydediliyor..." : "Araç Bilgilerini Kaydet"}
            </button>
          </div>
        </div>,
        document.body
      )}

      {selectedCourierRatings &&
        createPortal(
        <div className="fixed inset-0 z-[999] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-t-3xl border border-[#303036] bg-[#111116] p-5 shadow-2xl sm:rounded-3xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#D6A84F]/10 p-3">
                  <Star size={21} className="fill-[#D6A84F] text-[#D6A84F]" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#D6A84F]">
                    Puan Değerlendirmeleri
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-white">
                    {selectedCourierRatings.name || "Kurye"}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCourierRatings(null)}
                className="rounded-xl border border-[#303036] bg-[#19191E] p-2 text-[#999999]"
                aria-label="Kapat"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 rounded-2xl border border-[#303036] bg-[#19191E] p-4">
              <CourierRatingAdminDetails
                courierId={selectedCourierRatings.id}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {selectedCustomerProfile &&
        createPortal(
        <CustomerProfileModal
          customer={selectedCustomerProfile}
          orders={safeOrders.filter(
            (order) => order.customerId === selectedCustomerProfile.id
          )}
          onClose={() => setSelectedCustomerProfile(null)}
          onOpenOrder={openOrder}
        />,
        document.body
      )}
    </div>
  );
};

const CourierRatingAdminDetails: React.FC<{
  courierId: string;
}> = ({ courierId }) => {
  const [ratings, setRatings] = useState<
    Array<{
      id: string;
      orderId: string;
      courierId: string;
      customerId: string;
      customerName?: string;
      score: number;
      comment?: string;
      createdAt: string;
    }>
  >([]);

  useEffect(() => {
    if (!courierId) {
      setRatings([]);
      return;
    }

    let active = true;
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = subscribeToAllCourierRatings((nextRatings) => {
        if (!active) return;
        const safeRatings = Array.isArray(nextRatings)
          ? nextRatings.filter(
              (item) => item && item.courierId === courierId
            )
          : [];
        setRatings(safeRatings as typeof ratings);
      });
    } catch (error) {
      console.error("Kurye puanları alınamadı:", error);
      setRatings([]);
    }

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [courierId]);

  const average =
    ratings.length > 0
      ? ratings.reduce((sum, item) => sum + Number(item.score || 0), 0) /
        ratings.length
      : 0;

  const lowRating = ratings.length > 0 && average < 3;

  return (
    <div className="mt-5 space-y-4 rounded-2xl border border-[#303036] bg-[#19191E] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-white">
            Kurye değerlendirmeleri
          </p>
          <p className="mt-1 text-[11px] text-[#888888]">
            Müşteri puanları ve yazılı yorumlar canlı olarak görünür.
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-black text-[#D6A84F]">
            {average.toFixed(1)} / 5
          </div>
          <div className="text-[10px] text-[#888888]">
            {ratings.length} değerlendirme
          </div>
        </div>
      </div>

      {lowRating && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-300">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-bold">Düşük puan uyarısı</p>
            <p className="mt-1 text-[11px] leading-5 text-red-200/80">
              Bu kuryenin ortalama müşteri puanı 3.0 seviyesinin altında.
            </p>
          </div>
        </div>
      )}

      {ratings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#303036] p-4 text-center text-xs text-[#777777]">
          Henüz kayıtlı müşteri değerlendirmesi yok.
        </div>
      ) : (
        <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
          {ratings
            .slice()
            .sort(
              (a, b) =>
                new Date(b.createdAt || 0).getTime() -
                new Date(a.createdAt || 0).getTime()
            )
            .map((rating) => (
              <div
                key={rating.id}
                className="rounded-xl border border-[#303036] bg-[#0B0B0D] p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-white">
                      {rating.customerName || "Müşteri"}
                    </p>
                    <p className="mt-1 text-[10px] text-[#666666]">
                      Sipariş: {rating.orderId || "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm font-black text-[#D6A84F]">
                      {Number(rating.score || 0).toFixed(1)}
                    </span>
                    <span className="text-[#D6A84F]">★</span>
                  </div>
                </div>

                {rating.comment ? (
                  <p className="mt-3 rounded-lg bg-[#19191E] p-3 text-xs leading-5 text-[#D0D0D0]">
                    {rating.comment}
                  </p>
                ) : (
                  <p className="mt-3 text-[11px] text-[#666666]">
                    Yazılı yorum bırakılmadı.
                  </p>
                )}

                <p className="mt-2 text-[10px] text-[#666666]">
                  {rating.createdAt
                    ? new Date(rating.createdAt).toLocaleString("tr-TR")
                    : "Tarih yok"}
                </p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
};

const CustomerProfileModal: React.FC<{
  customer: UserProfile;
  orders: Order[];
  onClose: () => void;
  onOpenOrder: (order: Order) => void;
}> = ({
  customer,
  orders,
  onClose,
  onOpenOrder,
}) => {
  const completedOrders = orders.filter(
    (order) => order.status === "Teslim Edildi"
  ).length;

  const totalSpend = orders
    .filter((order) => order.status !== "İptal Edildi")
    .reduce(
      (sum, order) => sum + Number(order.price || 0),
      0
    );

  const formatCustomerMoney = (value: number) =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 0,
    }).format(value || 0);

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-[#303036] bg-[#111116] p-5 shadow-2xl sm:rounded-3xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
              <Users size={22} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-300">
                Müşteri profili
              </p>
              <h2 className="mt-1 truncate text-lg font-bold text-white">
                {customer.name || "Müşteri"}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#303036] bg-[#19191E] p-2 text-[#999999]"
            aria-label="Kapat"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <InfoItem label="E-posta" value={customer.email || "—"} />
          <InfoItem label="Telefon" value={customer.phone || "—"} />
          <InfoItem
            label="Kayıt tarihi"
            value={
              customer.createdAt
                ? new Date(customer.createdAt).toLocaleDateString("tr-TR")
                : "—"
            }
          />
          <InfoItem label="Müşteri ID" value={customer.id} />
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <ProfileMetric label="Toplam sipariş" value={String(orders.length)} />
          <ProfileMetric label="Teslim edilen" value={String(completedOrders)} />
          <ProfileMetric label="Toplam harcama" value={formatCustomerMoney(totalSpend)} accent />
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[#303036] bg-[#19191E]">
          <div className="border-b border-[#303036] px-4 py-3">
            <h3 className="text-sm font-bold text-white">Sipariş geçmişi</h3>
          </div>

          {orders.length === 0 ? (
            <p className="px-4 py-8 text-center text-xs text-[#777777]">
              Bu müşterinin henüz siparişi bulunmuyor.
            </p>
          ) : (
            <div className="divide-y divide-[#303036]">
              {orders.slice(0, 8).map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenOrder(order);
                  }}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-white">#{order.id}</p>
                    <p className="mt-1 truncate text-[10px] text-[#777777]">
                      {order.deliveryAddress}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <StatusBadge status={order.status} />
                    <p className="mt-1 text-xs font-bold text-[#D6A84F]">
                      {formatCustomerMoney(Number(order.price || 0))}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ProfileMetric: React.FC<{
  label: string;
  value: string;
  accent?: boolean;
}> = ({ label, value, accent = false }) => (
  <div className="rounded-xl border border-[#303036] bg-[#19191E] p-3">
    <p className="text-[9px] font-bold uppercase tracking-wide text-[#777777]">
      {label}
    </p>
    <p className={`mt-1 text-sm font-black ${accent ? "text-[#D6A84F]" : "text-white"}`}>
      {value}
    </p>
  </div>
);

const LiveCourierLocationCard: React.FC<{
  courier: UserProfile;
  location: CourierLocation;
}> = ({
  courier,
  location,
}) => {
  const updatedAt =
    location.updatedAt
      ? new Date(
          location.updatedAt
        )
      : null;

  const formattedDate =
    updatedAt &&
    !Number.isNaN(
      updatedAt.getTime()
    )
      ? updatedAt.toLocaleString(
          "tr-TR"
        )
      : "Bilinmiyor";

  const mapUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-[#0B0B0D] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {
              courier.name ||
              "Kurye"
            }
          </p>

          <p className="text-xs text-[#777777]">
            {
              courier.phone ||
              courier.email
            }
          </p>
        </div>

        <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400">
          CANLI
        </span>
      </div>

      <div className="mt-3 rounded-xl bg-[#19191E] p-3">
        <p className="text-xs text-[#777777]">
          Koordinat
        </p>

        <p className="mt-1 text-sm">
          {location.latitude.toFixed(
            6
          )}
          ,{" "}
          {location.longitude.toFixed(
            6
          )}
        </p>

        <p className="mt-1 text-[10px] text-[#666666]">
          Son güncelleme:{" "}
          {
            formattedDate
          }
        </p>
      </div>

      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[#303036] bg-[#19191E] py-2 text-xs font-semibold text-[#D6A84F]"
      >
        <MapPin size={15} />
        Haritada Aç
      </a>
    </div>
  );
};

const StatCard: React.FC<{
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
}> = ({
  title,
  value,
  icon,
}) => (
  <div className="rounded-2xl border border-[#303036] bg-[#19191E] p-4">
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#777777]">
        {title}
      </span>

      <div className="text-[#D6A84F]">
        {icon}
      </div>
    </div>

    <p className="mt-3 text-xl font-bold">
      {value}
    </p>
  </div>
);

const MiniStat: React.FC<{
  title: string;
  value: number;
}> = ({
  title,
  value,
}) => (
  <div className="rounded-2xl border border-[#303036] bg-[#19191E] p-4">
    <p className="text-xs text-[#777777]">
      {title}
    </p>

    <p className="mt-1 text-xl font-bold">
      {value}
    </p>
  </div>
);

const StatusBadge: React.FC<{
  status: OrderStatus;
}> = ({
  status,
}) => {
  const classes =
    status ===
    "Teslim Edildi"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : status ===
        "İptal Edildi"
      ? "bg-red-500/10 text-red-400 border-red-500/20"
      : status ===
        "Teslimatta"
      ? "bg-[#D6A84F]/10 text-[#D6A84F] border-[#D6A84F]/20"
      : "bg-blue-500/10 text-blue-400 border-blue-500/20";

  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${classes}`}
    >
      {status}
    </span>
  );
};

const OrderRow: React.FC<{
  order: Order;
  onClick: () => void;
}> = ({
  order,
  onClick,
}) => (
  <button
    onClick={
      onClick
    }
    className="flex w-full items-center justify-between gap-4 p-4 text-left transition hover:bg-[#222229]"
  >
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">
          #
          {
            order.id
          }
        </span>

        <StatusBadge
          status={
            order.status
          }
        />
      </div>

      <p className="mt-1 truncate text-xs text-[#999999]">
        {
          order.customerName ||
          "Müşteri"
        }{" "}
        •{" "}
        {
          order.pickupAddress
        }
      </p>
    </div>

    <div className="shrink-0 text-right">
      <p className="text-sm font-bold text-[#D6A84F]">
        {
          order.price
        }{" "}
        TL
      </p>

      <p className="text-[10px] text-[#777777]">
        {
          order.distanceKm
        }{" "}
        km
      </p>
    </div>
  </button>
);

const EmptyState: React.FC<{
  text: string;
}> = ({
  text,
}) => (
  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#303036] bg-[#19191E] p-10 text-center">
    <Package
      size={32}
      className="text-[#444444]"
    />

    <p className="mt-3 text-sm text-[#777777]">
      {text}
    </p>
  </div>
);

const NumberField: React.FC<{
  label: string;
  value: number;
  step?: number;
  onChange: (
    value: number
  ) => void;
}> = ({
  label,
  value,
  step = 1,
  onChange,
}) => (
  <div>
    <label className="mb-2 block text-xs text-[#777777]">
      {label}
    </label>

    <input
      type="number"
      min="0"
      step={step}
      value={value}
      onChange={(
        event
      ) =>
        onChange(
          Number(
            event.target
              .value
          )
        )
      }
      className="w-full rounded-xl border border-[#303036] bg-[#0B0B0D] px-4 py-3 text-sm outline-none focus:border-[#D6A84F]"
    />
  </div>
);

const SettingRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  status: string;
}> = ({
  icon,
  title,
  description,
  status,
}) => (
  <div className="flex items-center justify-between gap-4 rounded-xl border border-[#303036] bg-[#0B0B0D] p-4">
    <div className="flex items-center gap-3">
      <div className="text-[#D6A84F]">
        {icon}
      </div>

      <div>
        <p className="text-sm font-semibold">
          {title}
        </p>

        <p className="text-xs text-[#777777]">
          {description}
        </p>
      </div>
    </div>

    <span className="shrink-0 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
      {status}
    </span>
  </div>
);

const InfoItem: React.FC<{
  label: string;
  value: string;
}> = ({
  label,
  value,
}) => (
  <div>
    <p className="text-[10px] uppercase tracking-wide text-[#666666]">
      {label}
    </p>

    <p className="mt-1 break-words text-xs text-white">
      {value || "—"}
    </p>
  </div>
);
