import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Eye,
  MapPin,
  Package,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  X,
  Zap,
} from "lucide-react";

import type {
  CourierAvailability,
  Order,
  OrderStatus,
  PricingConfig,
  UserProfile,
} from "../types";

import { storage } from "../services/storage";
import { DeliveryProofCard } from "./DeliveryProofCard";

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

export const AdminPanel: React.FC<Props> = ({
  orders,
  pricing,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] =
    useState<AdminTab>("dashboard");

  const [searchTerm, setSearchTerm] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<"Tümü" | OrderStatus>("Tümü");

  const [selectedOrder, setSelectedOrder] =
    useState<Order | null>(null);

  const [editPrice, setEditPrice] =
    useState("");

  const [selectedCourier, setSelectedCourier] =
    useState("");

  const [selectedStatus, setSelectedStatus] =
    useState<OrderStatus>("Kurye Bekleniyor");

  const [saving, setSaving] =
    useState(false);

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

    loadUsers();

    let unsubscribe:
      | (() => void)
      | undefined;

    try {
      unsubscribe = storage.subscribe(
        loadUsers
      );
    } catch (error) {
      console.warn(
        "Admin storage listener kurulamadı:",
        error
      );
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

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
          Number(order.price || 0),
        0
      );

  const availableCouriers =
    couriers.filter(
      (courier) =>
        courier.courierStatus ===
        "Müsait"
    ).length;

  const urgentOrders =
    safeOrders.filter(
      (order) =>
        (order.urgency === "Acil" ||
          order.urgency === "Çok Acil") &&
        order.status !==
          "Teslim Edildi" &&
        order.status !==
          "İptal Edildi"
    );

  const filteredOrders = useMemo(() => {
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
          String(order.customerName)
            .toLowerCase()
            .includes(term) ||
          String(order.customerPhone)
            .toLowerCase()
            .includes(term) ||
          String(order.courierName || "")
            .toLowerCase()
            .includes(term) ||
          String(order.pickupAddress)
            .toLowerCase()
            .includes(term) ||
          String(order.deliveryAddress)
            .toLowerCase()
            .includes(term);

        const matchesStatus =
          statusFilter === "Tümü" ||
          order.status === statusFilter;

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
    try {
      setCouriers(
        storage.getCouriers()
      );

      setCustomers(
        storage.getCustomers()
      );

      onRefreshData?.();
    } catch (error) {
      console.error(
        "Admin yenileme hatası:",
        error
      );
    }
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

  const saveOrderChanges = () => {
    if (!selectedOrder) {
      return;
    }

    setSaving(true);

    try {
      let updatedOrder =
        storage.getOrderById(
          selectedOrder.id
        );

      if (!updatedOrder) {
        alert(
          "Sipariş artık bulunamadı."
        );
        return;
      }

      if (
        selectedCourier &&
        selectedCourier !==
          updatedOrder.courierId
      ) {
        updatedOrder =
          storage.assignCourier(
            updatedOrder.id,
            selectedCourier
          ) ||
          updatedOrder;
      }

      if (
        selectedStatus !==
          updatedOrder.status &&
        selectedStatus
      ) {
        updatedOrder =
          storage.updateOrderStatus(
            updatedOrder.id,
            selectedStatus
          ) ||
          updatedOrder;
      }

      const numericPrice =
        Number(
          editPrice
            .replace(",", ".")
        );

      if (
        Number.isFinite(
          numericPrice
        ) &&
        numericPrice >= 0 &&
        numericPrice !==
          Number(updatedOrder.price)
      ) {
        updatedOrder =
          storage.updateOrderPrice(
            updatedOrder.id,
            Math.round(
              numericPrice
            )
          ) ||
          updatedOrder;
      }

      setSelectedOrder(
        updatedOrder
      );

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

  const savePricing = () => {
    const nextPricing: PricingConfig = {
      ...pricing,
      perKmPrice:
        Math.max(
          0,
          Number(perKmPrice) || 0
        ),
      minPrice:
        Math.max(
          0,
          Number(minPrice) || 0
        ),
      urgentMultiplier:
        Math.max(
          1,
          Number(
            urgentMultiplier
          ) || 1
        ),
      vipMultiplier:
        Math.max(
          1,
          Number(
            vipMultiplier
          ) || 1
        ),
      updatedAt:
        new Date().toISOString(),
    };

    try {
      if (
        typeof storage.updatePricing ===
        "function"
      ) {
        storage.updatePricing(
          nextPricing
        );
      } else if (
        typeof storage.setPricing ===
        "function"
      ) {
        storage.setPricing(
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
              <div className="rounded-xl bg-[#D6A84F]/15 border border-[#D6A84F]/30 p-2.5">
                <ShieldCheck
                  size={22}
                  className="text-[#D6A84F]"
                />
              </div>

              <div>
                <h1 className="text-xl font-bold">
                  Trustline Express
                </h1>

                <p className="text-xs text-[#999999]">
                  Yönetim Paneli • V1
                </p>
              </div>
            </div>

            <button
              onClick={refresh}
              className="flex items-center justify-center gap-2 rounded-xl border border-[#303036] bg-[#19191E] px-4 py-2 text-sm hover:border-[#D6A84F]/50 transition"
            >
              <RefreshCw size={16} />
              Yenile
            </button>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() =>
                    setActiveTab(tab.id)
                  }
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? "bg-[#D6A84F] text-[#0B0B0D]"
                      : "bg-[#19191E] text-[#999999] hover:text-white border border-[#303036]"
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {urgentOrders.length > 0 && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle
                    className="mt-0.5 shrink-0 text-red-400"
                    size={20}
                  />

                  <div>
                    <h3 className="font-semibold text-red-300">
                      Acil siparişler var
                    </h3>

                    <p className="mt-1 text-sm text-red-200/80">
                      {urgentOrders.length} adet acil veya çok acil sipariş aktif.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                title="Toplam Sipariş"
                value={totalOrders}
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
                value={`${availableCouriers}/${couriers.length}`}
                icon={
                  <Truck size={20} />
                }
              />

              <StatCard
                title="Teslim Edilen"
                value={completedOrders}
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
                value={waitingOrders}
              />

              <MiniStat
                title="Atandı"
                value={assignedOrders}
              />

              <MiniStat
                title="Paket Alındı"
                value={pickedUpOrders}
              />

              <MiniStat
                title="Teslimatta"
                value={deliveringOrders}
              />

              <MiniStat
                title="İptal"
                value={cancelledOrders}
              />
            </div>

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
                    Firebase bağlantısı aktif
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
                    En son oluşturulan gönderiler
                  </p>
                </div>

                <button
                  onClick={() =>
                    setActiveTab("orders")
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
                  .map((order) => (
                    <OrderRow
                      key={order.id}
                      order={order}
                      onClick={() =>
                        openOrder(order)
                      }
                    />
                  ))}

                {safeOrders.length ===
                  0 && (
                  <EmptyState text="Henüz sipariş bulunmuyor." />
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "orders" && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#666666]"
                />

                <input
                  value={searchTerm}
                  onChange={(event) =>
                    setSearchTerm(
                      event.target.value
                    )
                  }
                  placeholder="Sipariş, müşteri, kurye veya adres ara..."
                  className="w-full rounded-xl border border-[#303036] bg-[#19191E] py-3 pl-10 pr-4 text-sm outline-none focus:border-[#D6A84F]"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target.value as
                      | "Tümü"
                      | OrderStatus
                  )
                }
                className="rounded-xl border border-[#303036] bg-[#19191E] px-4 py-3 text-sm outline-none"
              >
                <option>Tümü</option>

                {ORDER_STATUSES.map(
                  (status) => (
                    <option
                      key={status}
                      value={status}
                    >
                      {status}
                    </option>
                  )
                )}
              </select>
            </div>

            <div className="grid gap-3">
              {filteredOrders.map(
                (order) => (
                  <button
                    key={order.id}
                    onClick={() =>
                      openOrder(order)
                    }
                    className="w-full cursor-pointer rounded-2xl border border-[#303036] bg-[#19191E] p-5 text-left transition hover:border-[#D6A84F]/50"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">
                            #{order.id}
                          </span>

                          <StatusBadge
                            status={
                              order.status
                            }
                          />

                          {order.urgency !==
                            "Normal" && (
                            <span className="rounded-full bg-red-500/10 border border-red-500/30 px-2 py-0.5 text-[10px] font-bold text-red-400">
                              {order.urgency}
                            </span>
                          )}
                        </div>

                        <p className="mt-2 text-sm text-slate-300">
                          {order.customerName ||
                            "Müşteri"}
                        </p>

                        <div className="mt-2 space-y-1 text-xs text-[#777777]">
                          <p>
                            <MapPin
                              size={13}
                              className="mr-1 inline"
                            />
                            {order.pickupAddress}
                          </p>

                          <p>
                            <MapPin
                              size={13}
                              className="mr-1 inline"
                            />
                            {order.deliveryAddress}
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
                          {order.distanceKm ||
                            0}{" "}
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

        {activeTab === "couriers" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">
                Kuryeler
              </h2>

              <p className="text-sm text-[#999999]">
                {couriers.length} gerçek kurye hesabı
              </p>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-200">
              <div className="flex gap-3">
                <AlertCircle
                  size={18}
                  className="shrink-0"
                />

                <p>
                  V1'de admin paneli Firebase
                  Authentication hesabı oluşturmaz.
                  Kurye hesabı gerçek Auth hesabı olarak
                  oluşturulduktan sonra burada yönetilir.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {couriers.map(
                (courier) => (
                  <div
                    key={courier.id}
                    className="rounded-2xl border border-[#303036] bg-[#19191E] p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="rounded-full bg-[#D6A84F]/10 p-3">
                          <Truck
                            size={20}
                            className="text-[#D6A84F]"
                          />
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">
                            {courier.name}
                          </h3>

                          <p className="text-xs text-[#777777] truncate">
                            {courier.email}
                          </p>

                          <p className="text-xs text-[#777777]">
                            {courier.phone}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`mt-2 h-3 w-3 shrink-0 rounded-full ${
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

                    <div className="mt-5">
                      <label className="mb-2 block text-xs text-[#777777]">
                        Kurye Durumu
                      </label>

                      <select
                        value={
                          courier.courierStatus ||
                          "Çevrimdışı"
                        }
                        onChange={(event) =>
                          changeCourierStatus(
                            courier.id,
                            event.target.value as CourierAvailability
                          )
                        }
                        className="w-full rounded-xl border border-[#303036] bg-[#0B0B0D] px-3 py-2 text-sm"
                      >
                        {COURIER_STATUSES.map(
                          (status) => (
                            <option
                              key={status}
                              value={status}
                            >
                              {status}
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
                          {courier.totalDeliveries ||
                            0}
                        </p>
                      </div>

                      <div className="rounded-xl bg-[#0B0B0D] p-3">
                        <p className="text-[10px] text-[#777777]">
                          Puan
                        </p>

                        <p className="mt-1 font-bold text-[#D6A84F]">
                          {courier.rating
                            ? courier.rating.toFixed(
                                1
                              )
                            : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              )}

              {couriers.length ===
                0 && (
                <EmptyState text="Firestore'da henüz kurye profili bulunmuyor." />
              )}
            </div>
          </div>
        )}

        {activeTab === "customers" && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">
                Müşteriler
              </h2>

              <p className="text-sm text-[#999999]">
                {customers.length} gerçek müşteri hesabı
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
                        (sum, order) =>
                          sum +
                          Number(
                            order.price ||
                              0
                          ),
                        0
                      );

                  return (
                    <div
                      key={customer.id}
                      className="rounded-2xl border border-[#303036] bg-[#19191E] p-5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-blue-500/10 p-3">
                          <Users
                            size={20}
                            className="text-blue-400"
                          />
                        </div>

                        <div className="min-w-0">
                          <h3 className="font-semibold truncate">
                            {customer.name}
                          </h3>

                          <p className="text-xs text-[#777777] truncate">
                            {customer.email}
                          </p>

                          <p className="text-xs text-[#777777]">
                            {customer.phone}
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

        {activeTab === "pricing" && (
          <div className="mx-auto max-w-2xl space-y-5">
            <div>
              <h2 className="text-xl font-bold">
                Fiyatlandırma
              </h2>

              <p className="text-sm text-[#999999]">
                Yeni siparişlerin fiyat hesaplamasını yönet.
              </p>
            </div>

            <div className="space-y-5 rounded-2xl border border-[#303036] bg-[#19191E] p-5">
              <NumberField
                label="KM Başına Fiyat"
                value={perKmPrice}
                onChange={setPerKmPrice}
              />

              <NumberField
                label="Minimum Fiyat"
                value={minPrice}
                onChange={setMinPrice}
              />

              <NumberField
                label="Acil Çarpanı"
                value={urgentMultiplier}
                step={0.05}
                onChange={
                  setUrgentMultiplier
                }
              />

              <NumberField
                label="VIP Çarpanı"
                value={vipMultiplier}
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
                  {perKmPrice} TL
                  <span className="text-xs text-[#777777]">
                    {" "}
                    • minimum{" "}
                    {minPrice} TL
                  </span>
                </p>
              </div>

              <button
                onClick={savePricing}
                className="w-full rounded-xl bg-[#D6A84F] py-3 font-bold text-[#0B0B0D] hover:bg-[#c49740] transition"
              >
                Fiyatları Firebase'e Kaydet
              </button>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="mx-auto max-w-2xl space-y-5">
            <div>
              <h2 className="text-xl font-bold">
                Sistem
              </h2>

              <p className="text-sm text-[#999999]">
                Trustline Express V1 sistem durumu.
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
                description="Canlı kurye konum paylaşımı"
                status="V1"
              />
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
              <div className="flex gap-3">
                <AlertCircle
                  size={20}
                  className="shrink-0 text-amber-400"
                />

                <div>
                  <h3 className="font-semibold text-amber-300">
                    Demo modu kapalı
                  </h3>

                  <p className="mt-1 text-sm text-amber-100/70">
                    V1 sürümünde demo kullanıcı değiştirme,
                    demo veri sıfırlama ve sahte kurye hesabı
                    oluşturma kullanılmaz.
                  </p>
                </div>
              </div>
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
                  #{selectedOrder.id}
                </h2>
              </div>

              <button
                onClick={closeOrder}
                className="rounded-xl border border-[#303036] bg-[#19191E] p-2 text-[#999999] hover:text-white"
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
                    value={selectedCourier}
                    onChange={(event) =>
                      setSelectedCourier(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-[#303036] bg-[#19191E] px-3 py-3 text-sm"
                  >
                    <option value="">
                      Kurye seçilmedi
                    </option>

                    {couriers.map(
                      (courier) => (
                        <option
                          key={courier.id}
                          value={courier.id}
                        >
                          {courier.name} •{" "}
                          {courier.courierStatus ||
                            "Çevrimdışı"}
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
                    value={selectedStatus}
                    onChange={(event) =>
                      setSelectedStatus(
                        event.target.value as OrderStatus
                      )
                    }
                    className="w-full rounded-xl border border-[#303036] bg-[#19191E] px-3 py-3 text-sm"
                  >
                    {ORDER_STATUSES.map(
                      (status) => (
                        <option
                          key={status}
                          value={status}
                        >
                          {status}
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

                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    value={editPrice}
                    onChange={(event) =>
                      setEditPrice(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-[#303036] bg-[#19191E] px-4 py-3 pr-14 text-sm outline-none focus:border-[#D6A84F]"
                  />

                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#777777]">
                    TL
                  </span>
                </div>
              </div>

              {selectedOrder.deliveryProof && (
                <DeliveryProofCard
                  order={selectedOrder}
                />
              )}

              {selectedOrder.status ===
                "Teslim Edildi" &&
                !selectedOrder.deliveryProof &&
                !selectedOrder.signature && (
                  <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                    Teslim edildi olarak işaretlenmiş
                    ancak teslim kanıtı bulunmuyor.
                  </div>
                )}

              <button
                disabled={saving}
                onClick={saveOrderChanges}
                className="w-full rounded-xl bg-[#D6A84F] py-3 font-bold text-[#0B0B0D] transition hover:bg-[#c49740] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Kaydediliyor..."
                  : "Siparişi Güncelle"}
              </button>
            </div>
          </div>
        </div>
      )}
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
    status === "Teslim Edildi"
      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
      : status ===
        "İptal Edildi"
      ? "bg-red-500/10 text-red-400 border-red-500/20"
      : status === "Teslimatta"
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
    onClick={onClick}
    className="flex w-full items-center justify-between gap-4 p-4 text-left hover:bg-[#222229] transition"
  >
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold text-sm">
          #{order.id}
        </span>

        <StatusBadge
          status={order.status}
        />
      </div>

      <p className="mt-1 truncate text-xs text-[#999999]">
        {order.customerName ||
          "Müşteri"}{" "}
        • {order.pickupAddress}
      </p>
    </div>

    <div className="shrink-0 text-right">
      <p className="text-sm font-bold text-[#D6A84F]">
        {order.price} TL
      </p>

      <p className="text-[10px] text-[#777777]">
        {order.distanceKm} km
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
      onChange={(event) =>
        onChange(
          Number(
            event.target.value
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

    <span className="shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] font-bold text-emerald-400">
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

    <p className="mt-1 text-xs text-white break-words">
      {value || "—"}
    </p>
  </div>
);