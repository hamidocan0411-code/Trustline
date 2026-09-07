import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  Edit3,
  Eye,
  MapPin,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Truck,
  UserCheck,
  Users,
  X,
  Zap,
} from 'lucide-react';

import {
  CourierAvailability,
  Order,
  OrderStatus,
  PricingConfig,
  UserProfile,
} from '../types';

import { storage } from '../services/storage';
import { DeliveryProofCard } from './DeliveryProofCard';

interface Props {
  orders: Order[];
  pricing: PricingConfig;
  onRefreshData?: () => void;
}

export const AdminPanel: React.FC<Props> = ({
  orders,
  pricing,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'orders' | 'couriers' | 'customers' | 'pricing' | 'settings'
  >('dashboard');

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('Tümü');

  const [editPriceValue, setEditPriceValue] = useState<number>(0);
  const [selectedCourierToAssign, setSelectedCourierToAssign] =
    useState<string>('');

  const [selectedStatusToChange, setSelectedStatusToChange] =
    useState<OrderStatus>('Kurye Bekleniyor');

  const [showAddCourier, setShowAddCourier] = useState(false);

  const [newCourierName, setNewCourierName] = useState('');
  const [newCourierPhone, setNewCourierPhone] = useState('');

  const [perKmPrice, setPerKmPrice] = useState(pricing?.perKmPrice ?? 50);
  const [minPrice, setMinPrice] = useState(pricing?.minPrice ?? 250);
  const [urgentMultiplier, setUrgentMultiplier] = useState(
    pricing?.urgentMultiplier ?? 1.3
  );
  const [vipMultiplier, setVipMultiplier] = useState(
    pricing?.vipMultiplier ?? 1.6
  );

  /*
   * STORAGE'DAN GELEN VERİLERİ HER ZAMAN GÜVENLİ ARRAY OLARAK KULLAN.
   * Admin ekranının siyah ekrana düşmesini engeller.
   */
  const safeOrders = Array.isArray(orders) ? orders : [];

  const getSafeCouriers = (): UserProfile[] => {
    try {
      const result = storage.getCouriers?.();
      return Array.isArray(result) ? result : [];
    } catch {
      return [];
    }
  };

  const getSafeCustomers = (): UserProfile[] => {
    try {
      const result = storage.getCustomers?.();
      return Array.isArray(result) ? result : [];
    } catch {
      return [];
    }
  };

  const couriers = getSafeCouriers();
  const customers = getSafeCustomers();

  const totalOrders = safeOrders.length;

  const completedOrders = safeOrders.filter(
    (o) => o.status === 'Teslim Edildi'
  ).length;

  const pendingOrders = safeOrders.filter(
    (o) =>
      o.status === 'Kurye Bekleniyor' ||
      o.status === 'Paket Alındı'
  ).length;

  const assignedOrders = safeOrders.filter(
    (o) => o.status === 'Kurye Atandı'
  ).length;

  const deliveringOrders = safeOrders.filter(
    (o) => o.status === 'Teslimatta'
  ).length;

  const cancelledOrders = safeOrders.filter(
    (o) => o.status === 'İptal Edildi'
  ).length;

  const totalRevenue = safeOrders
    .filter((o) => o.status !== 'İptal Edildi')
    .reduce((sum, o) => sum + Number(o.price || 0), 0);

  const availableCouriers = couriers.filter(
    (c) => c.courierStatus === 'Müsait'
  ).length;

  const urgentOrders = safeOrders.filter(
    (o) =>
      (o.urgency === 'Acil' || o.urgency === 'Çok Acil') &&
      o.status !== 'Teslim Edildi' &&
      o.status !== 'İptal Edildi'
  );

  const filteredOrders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return safeOrders.filter((order) => {
      const matchesSearch =
        !term ||
        String(order.id || '').toLowerCase().includes(term) ||
        String(order.customerName || '').toLowerCase().includes(term) ||
        String(order.customerPhone || '').toLowerCase().includes(term) ||
        String(order.pickupAddress || '').toLowerCase().includes(term) ||
        String(order.deliveryAddress || '').toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === 'Tümü' || order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [safeOrders, searchTerm, statusFilter]);

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  const safeRefresh = () => {
    try {
      onRefreshData?.();
    } catch {
      // Panel çökmemesi için sessizce devam et
    }
  };

  const updateOrderStatusSafe = (
    orderId: string,
    status: OrderStatus
  ) => {
    try {
      if (storage.updateOrderStatus) {
        storage.updateOrderStatus(orderId, status);
      }
      safeRefresh();
      setSelectedOrder(null);
    } catch (error) {
      console.error('Sipariş durum güncelleme hatası:', error);
    }
  };

  const assignCourierSafe = (
    orderId: string,
    courierId: string
  ) => {
    try {
      if (storage.assignCourier) {
        storage.assignCourier(orderId, courierId);
      }
      safeRefresh();
    } catch (error) {
      console.error('Kurye atama hatası:', error);
    }
  };

  const updatePriceSafe = (
    orderId: string,
    price: number
  ) => {
    try {
      if (storage.updateOrderPrice) {
        storage.updateOrderPrice(orderId, price);
      }
      safeRefresh();
    } catch (error) {
      console.error('Fiyat güncelleme hatası:', error);
    }
  };

  const savePricing = () => {
    try {
      const newPricing: PricingConfig = {
        ...pricing,
        perKmPrice: Number(perKmPrice),
        minPrice: Number(minPrice),
        urgentMultiplier: Number(urgentMultiplier),
        vipMultiplier: Number(vipMultiplier),
        updatedAt: new Date().toISOString(),
      };

      if (storage.updatePricing) {
        storage.updatePricing(newPricing);
      } else if (storage.setPricing) {
        storage.setPricing(newPricing);
      }

      safeRefresh();
      alert('Fiyatlandırma başarıyla güncellendi.');
    } catch (error) {
      console.error('Fiyatlandırma hatası:', error);
      alert('Fiyatlandırma güncellenemedi.');
    }
  };

  const updateCourierStatusSafe = (
    courierId: string,
    status: CourierAvailability
  ) => {
    try {
      if (storage.updateCourierStatus) {
        storage.updateCourierStatus(courierId, status);
      }
      safeRefresh();
    } catch (error) {
      console.error('Kurye durum hatası:', error);
    }
  };

  const addCourierSafe = () => {
    if (!newCourierName.trim() || !newCourierPhone.trim()) {
      alert('Kurye adı ve telefon numarası gerekli.');
      return;
    }

    try {
      if (storage.addCourier) {
        storage.addCourier({
          name: newCourierName.trim(),
          phone: newCourierPhone.trim(),
        });
      }

      setNewCourierName('');
      setNewCourierPhone('');
      setShowAddCourier(false);
      safeRefresh();
    } catch (error) {
      console.error('Kurye ekleme hatası:', error);
      alert('Kurye eklenemedi.');
    }
  };

  const resetDemoSafe = () => {
    const approved = confirm(
      'Demo verilerini sıfırlamak istediğinize emin misiniz?'
    );

    if (!approved) return;

    try {
      if (storage.resetDemoData) {
        storage.resetDemoData();
      }

      safeRefresh();
      alert('Demo verileri sıfırlandı.');
    } catch (error) {
      console.error('Sıfırlama hatası:', error);
      alert('Demo verileri sıfırlanamadı.');
    }
  };

  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: BarChart3,
    },
    {
      id: 'orders',
      label: 'Siparişler',
      icon: Package,
    },
    {
      id: 'couriers',
      label: 'Kuryeler',
      icon: Truck,
    },
    {
      id: 'customers',
      label: 'Müşteriler',
      icon: Users,
    },
    {
      id: 'pricing',
      label: 'Fiyatlandırma',
      icon: DollarSign,
    },
    {
      id: 'settings',
      label: 'Ayarlar',
      icon: Settings,
    },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* HEADER */}
      <div className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-600 p-2">
                  <ShieldCheck size={22} />
                </div>

                <div>
                  <h1 className="text-xl font-bold">
                    Trustline Express
                  </h1>
                  <p className="text-xs text-slate-400">
                    Yönetim Paneli
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={safeRefresh}
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm hover:bg-slate-800"
            >
              <RefreshCw size={16} />
              Yenile
            </button>
          </div>

          {/* TABS */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon size={16} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
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
                      {urgentOrders.length} adet acil/çok acil
                      sipariş bekliyor.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* KPI */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <StatCard
                title="Toplam Sipariş"
                value={totalOrders}
                icon={<Package size={20} />}
              />

              <StatCard
                title="Toplam Ciro"
                value={formatMoney(totalRevenue)}
                icon={<DollarSign size={20} />}
              />

              <StatCard
                title="Müsait Kurye"
                value={`${availableCouriers}/${couriers.length}`}
                icon={<Truck size={20} />}
              />

              <StatCard
                title="Teslim Edilen"
                value={completedOrders}
                icon={<CheckCircle2 size={20} />}
              />
            </div>

            {/* STATUS */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
              <MiniStat
                title="Bekliyor"
                value={pendingOrders}
              />

              <MiniStat
                title="Atandı"
                value={assignedOrders}
              />

              <MiniStat
                title="Teslimatta"
                value={deliveringOrders}
              />

              <MiniStat
                title="Tamamlandı"
                value={completedOrders}
              />

              <MiniStat
                title="İptal"
                value={cancelledOrders}
              />
            </div>

            {/* SYSTEM */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
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
                    Sistem aktif ve çalışıyor
                  </p>
                </div>
              </div>
            </div>

            {/* RECENT ORDERS */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-800 p-5">
                <div>
                  <h2 className="font-semibold">
                    Son Siparişler
                  </h2>
                  <p className="text-sm text-slate-400">
                    Son oluşturulan siparişler
                  </p>
                </div>

                <button
                  onClick={() => setActiveTab('orders')}
                  className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
                >
                  Tümünü Gör
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="divide-y divide-slate-800">
                {safeOrders.slice(0, 8).map((order) => (
                  <OrderRow
                    key={order.id}
                    order={order}
                    onClick={() => {
                      setSelectedOrder(order);
                      setEditPriceValue(Number(order.price || 0));
                      setSelectedStatusToChange(
                        order.status
                      );
                    }}
                  />
                ))}

                {safeOrders.length === 0 && (
                  <EmptyState text="Henüz sipariş bulunmuyor." />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search
                  size={18}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                />

                <input
                  value={searchTerm}
                  onChange={(e) =>
                    setSearchTerm(e.target.value)
                  }
                  placeholder="Sipariş, müşteri veya adres ara..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value)
                }
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm outline-none"
              >
                <option>Tümü</option>
                <option>Kurye Bekleniyor</option>
                <option>Kurye Atandı</option>
                <option>Paket Alındı</option>
                <option>Teslimatta</option>
                <option>Teslim Edildi</option>
                <option>İptal Edildi</option>
              </select>
            </div>

            <div className="grid gap-4">
              {filteredOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => {
                    setSelectedOrder(order);
                    setEditPriceValue(Number(order.price || 0));
                    setSelectedStatusToChange(order.status);
                  }}
                  className="cursor-pointer rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-blue-500/50"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">
                          #{order.id}
                        </span>

                        <StatusBadge status={order.status} />
                      </div>

                      <p className="mt-2 text-sm text-slate-300">
                        {order.customerName || 'Müşteri'}
                      </p>

                      <div className="mt-2 space-y-1 text-xs text-slate-500">
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

                    <div className="text-left md:text-right">
                      <p className="text-lg font-bold">
                        {formatMoney(Number(order.price || 0))}
                      </p>

                      <p className="text-xs text-slate-500">
                        {order.distanceKm || 0} km
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {filteredOrders.length === 0 && (
                <EmptyState text="Arama kriterlerine uygun sipariş bulunamadı." />
              )}
            </div>
          </div>
        )}

        {/* COURIERS */}
        {activeTab === 'couriers' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Kuryeler
                </h2>

                <p className="text-sm text-slate-400">
                  {couriers.length} kurye kayıtlı
                </p>
              </div>

              <button
                onClick={() => setShowAddCourier(true)}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
              >
                <Plus size={17} />
                Kurye Ekle
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {couriers.map((courier) => (
                <div
                  key={courier.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-slate-800 p-3">
                        <Truck size={20} />
                      </div>

                      <div>
                        <h3 className="font-semibold">
                          {courier.name}
                        </h3>

                        <p className="text-xs text-slate-500">
                          {courier.phone}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`h-3 w-3 rounded-full ${
                        courier.courierStatus === 'Müsait'
                          ? 'bg-emerald-400'
                          : 'bg-slate-500'
                      }`}
                    />
                  </div>

                  <div className="mt-5">
                    <label className="mb-2 block text-xs text-slate-500">
                      Kurye Durumu
                    </label>

                    <select
                      value={
                        courier.courierStatus || 'Müsait Değil'
                      }
                      onChange={(e) =>
                        updateCourierStatusSafe(
                          courier.id,
                          e.target.value as CourierAvailability
                        )
                      }
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm"
                    >
                      <option value="Müsait">
                        Müsait
                      </option>
                      <option value="Müsait Değil">
                        Müsait Değil
                      </option>
                      <option value="Meşgul">
                        Meşgul
                      </option>
                    </select>
                  </div>
                </div>
              ))}

              {couriers.length === 0 && (
                <EmptyState text="Henüz kurye bulunmuyor." />
              )}
            </div>
          </div>
        )}

        {/* CUSTOMERS */}
        {activeTab === 'customers' && (
          <div className="space-y-5">
            <div>
              <h2 className="text-xl font-bold">
                Müşteriler
              </h2>

              <p className="text-sm text-slate-400">
                {customers.length} müşteri kayıtlı
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {customers.map((customer) => {
                const customerOrders = safeOrders.filter(
                  (o) => o.customerId === customer.id
                );

                const customerRevenue = customerOrders.reduce(
                  (sum, o) =>
                    sum + Number(o.price || 0),
                  0
                );

                return (
                  <div
                    key={customer.id}
                    className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
                  >
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-blue-500/10 p-3">
                        <Users
                          size={20}
                          className="text-blue-400"
                        />
                      </div>

                      <div>
                        <h3 className="font-semibold">
                          {customer.name}
                        </h3>

                        <p className="text-xs text-slate-500">
                          {customer.phone}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-slate-950 p-3">
                        <p className="text-xs text-slate-500">
                          Sipariş
                        </p>

                        <p className="mt-1 font-bold">
                          {customerOrders.length}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-950 p-3">
                        <p className="text-xs text-slate-500">
                          Harcama
                        </p>

                        <p className="mt-1 text-sm font-bold">
                          {formatMoney(customerRevenue)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}

              {customers.length === 0 && (
                <EmptyState text="Henüz müşteri bulunmuyor." />
              )}
            </div>
          </div>
        )}

        {/* PRICING */}
        {activeTab === 'pricing' && (
          <div className="mx-auto max-w-2xl space-y-5">
            <div>
              <h2 className="text-xl font-bold">
                Fiyatlandırma
              </h2>

              <p className="text-sm text-slate-400">
                Kurye fiyatlarını buradan yönetebilirsiniz.
              </p>
            </div>

            <div className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5">
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
                onChange={setUrgentMultiplier}
              />

              <NumberField
                label="VIP Çarpanı"
                value={vipMultiplier}
                step={0.05}
                onChange={setVipMultiplier}
              />

              <button
                onClick={savePricing}
                className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-500"
              >
                Fiyatları Kaydet
              </button>
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === 'settings' && (
          <div className="mx-auto max-w-2xl space-y-5">
            <div>
              <h2 className="text-xl font-bold">
                Sistem Ayarları
              </h2>

              <p className="text-sm text-slate-400">
                Trustline Express uygulama ayarları
              </p>
            </div>

            <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-5">
              <SettingRow
                icon={<ShieldCheck size={20} />}
                title="Firebase"
                description="Veri altyapısı"
                status="Hazır"
              />

              <SettingRow
                icon={<Zap size={20} />}
                title="Yapay Zeka"
                description="Gemini entegrasyonu"
                status="Aktif"
              />

              <SettingRow
                icon={<Activity size={20} />}
                title="Sistem"
                description="Uygulama durumu"
                status="Aktif"
              />
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
              <h3 className="font-semibold text-red-300">
                Demo Verileri
              </h3>

              <p className="mt-1 text-sm text-slate-400">
                Sipariş, kurye ve müşteri demo verilerini
                başlangıç durumuna döndürür.
              </p>

              <button
                onClick={resetDemoSafe}
                className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/20"
              >
                <RefreshCw size={16} />
                Demo Verilerini Sıfırla
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ORDER MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-800 bg-slate-950">
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-800 bg-slate-950 p-5">
              <div>
                <h2 className="font-bold">
                  Sipariş #{selectedOrder.id}
                </h2>

                <p className="text-xs text-slate-500">
                  Sipariş yönetimi
                </p>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="rounded-xl p-2 hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <InfoBox
                  title="Müşteri"
                  value={
                    selectedOrder.customerName ||
                    'Belirtilmemiş'
                  }
                />

                <InfoBox
                  title="Telefon"
                  value={
                    selectedOrder.customerPhone ||
                    'Belirtilmemiş'
                  }
                />

                <InfoBox
                  title="Alış Adresi"
                  value={
                    selectedOrder.pickupAddress ||
                    'Belirtilmemiş'
                  }
                />

                <InfoBox
                  title="Teslimat Adresi"
                  value={
                    selectedOrder.deliveryAddress ||
                    'Belirtilmemiş'
                  }
                />
              </div>

              {selectedOrder.status === 'Teslim Edildi' && (
                <DeliveryProofCard
                  order={selectedOrder}
                />
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <label className="mb-2 block text-xs text-slate-500">
                    Sipariş Durumu
                  </label>

                  <select
                    value={selectedStatusToChange}
                    onChange={(e) =>
                      setSelectedStatusToChange(
                        e.target.value as OrderStatus
                      )
                    }
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm"
                  >
                    <option>Kurye Bekleniyor</option>
                    <option>Kurye Atandı</option>
                    <option>Paket Alındı</option>
                    <option>Teslimatta</option>
                    <option>Teslim Edildi</option>
                    <option>İptal Edildi</option>
                  </select>

                  <button
                    onClick={() =>
                      updateOrderStatusSafe(
                        selectedOrder.id,
                        selectedStatusToChange
                      )
                    }
                    className="mt-3 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold hover:bg-blue-500"
                  >
                    Durumu Güncelle
                  </button>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <label className="mb-2 block text-xs text-slate-500">
                    Kurye Ata
                  </label>

                  <select
                    value={selectedCourierToAssign}
                    onChange={(e) =>
                      setSelectedCourierToAssign(
                        e.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 text-sm"
                  >
                    <option value="">
                      Kurye seçin
                    </option>

                    {couriers.map((courier) => (
                      <option
                        key={courier.id}
                        value={courier.id}
                      >
                        {courier.name}
                      </option>
                    ))}
                  </select>

                  <button
                    disabled={!selectedCourierToAssign}
                    onClick={() => {
                      assignCourierSafe(
                        selectedOrder.id,
                        selectedCourierToAssign
                      );

                      setSelectedOrder(null);
                    }}
                    className="mt-3 w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Kurye Ata
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                <label className="mb-2 block text-xs text-slate-500">
                  Sipariş Fiyatı
                </label>

                <div className="flex gap-3">
                  <input
                    type="number"
                    value={editPriceValue}
                    onChange={(e) =>
                      setEditPriceValue(
                        Number(e.target.value)
                      )
                    }
                    className="min-w-0 flex-1 rounded-xl border border-slate-800 bg-slate-950 px-3 py-3 outline-none focus:border-blue-500"
                  />

                  <button
                    onClick={() => {
                      updatePriceSafe(
                        selectedOrder.id,
                        editPriceValue
                      );

                      setSelectedOrder(null);
                    }}
                    className="rounded-xl bg-slate-800 px-5 text-sm font-semibold hover:bg-slate-700"
                  >
                    Güncelle
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 rounded-xl border border-slate-800 py-3 font-medium hover:bg-slate-900"
                >
                  Kapat
                </button>

                {selectedOrder.status !== 'İptal Edildi' &&
                  selectedOrder.status !== 'Teslim Edildi' && (
                    <button
                      onClick={() =>
                        updateOrderStatusSafe(
                          selectedOrder.id,
                          'İptal Edildi'
                        )
                      }
                      className="flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold hover:bg-red-500"
                    >
                      <Trash2 size={17} />
                      İptal Et
                    </button>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD COURIER MODAL */}
      {showAddCourier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">
                Yeni Kurye
              </h2>

              <button
                onClick={() => setShowAddCourier(false)}
                className="rounded-xl p-2 hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <input
                value={newCourierName}
                onChange={(e) =>
                  setNewCourierName(e.target.value)
                }
                placeholder="Kurye adı"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 outline-none focus:border-blue-500"
              />

              <input
                value={newCourierPhone}
                onChange={(e) =>
                  setNewCourierPhone(e.target.value)
                }
                placeholder="Telefon"
                className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 outline-none focus:border-blue-500"
              />

              <button
                onClick={addCourierSafe}
                className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-500"
              >
                Kurye Ekle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* =========================
   ALT COMPONENTLER
========================= */

const StatCard = ({
  title,
  value,
  icon,
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
    <div className="flex items-center justify-between">
      <div className="rounded-xl bg-blue-500/10 p-2 text-blue-400">
        {icon}
      </div>

      <BarChart3 size={16} className="text-slate-700" />
    </div>

    <p className="mt-4 text-xs text-slate-500">
      {title}
    </p>

    <p className="mt-1 text-xl font-bold">
      {value}
    </p>
  </div>
);

const MiniStat = ({
  title,
  value,
}: {
  title: string;
  value: number;
}) => (
  <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
    <p className="text-xs text-slate-500">{title}</p>
    <p className="mt-1 text-xl font-bold">{value}</p>
  </div>
);

const StatusBadge = ({
  status,
}: {
  status: string;
}) => {
  const classes =
    status === 'Teslim Edildi'
      ? 'bg-emerald-500/10 text-emerald-400'
      : status === 'İptal Edildi'
      ? 'bg-red-500/10 text-red-400'
      : status === 'Teslimatta'
      ? 'bg-blue-500/10 text-blue-400'
      : 'bg-amber-500/10 text-amber-400';

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${classes}`}
    >
      {status}
    </span>
  );
};

const OrderRow = ({
  order,
  onClick,
}: {
  order: Order;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex w-full items-center justify-between gap-4 p-5 text-left hover:bg-slate-800/40"
  >
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">
          #{order.id}
        </span>

        <StatusBadge status={order.status} />
      </div>

      <p className="mt-1 truncate text-sm text-slate-300">
        {order.customerName || 'Müşteri'}
      </p>
    </div>

    <div className="shrink-0 text-right">
      <p className="font-semibold">
        {new Intl.NumberFormat('tr-TR', {
          style: 'currency',
          currency: 'TRY',
          maximumFractionDigits: 0,
        }).format(Number(order.price || 0))}
      </p>

      <p className="mt-1 flex items-center justify-end gap-1 text-xs text-slate-500">
        <Clock size={12} />
        {order.distanceKm || 0} km
      </p>
    </div>
  </button>
);

const EmptyState = ({
  text,
}: {
  text: string;
}) => (
  <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/50 p-10 text-center">
    <ShoppingBag
      size={30}
      className="mx-auto text-slate-700"
    />

    <p className="mt-3 text-sm text-slate-500">
      {text}
    </p>
  </div>
);

const InfoBox = ({
  title,
  value,
}: {
  title: string;
  value: string;
}) => (
  <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
    <p className="text-xs text-slate-500">
      {title}
    </p>

    <p className="mt-1 break-words text-sm font-medium text-slate-200">
      {value}
    </p>
  </div>
);

const NumberField = ({
  label,
  value,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  step?: number;
  onChange: (value: number) => void;
}) => (
  <div>
    <label className="mb-2 block text-sm text-slate-400">
      {label}
    </label>

    <input
      type="number"
      value={value}
      step={step}
      onChange={(e) =>
        onChange(Number(e.target.value))
      }
      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-3 outline-none focus:border-blue-500"
    />
  </div>
);

const SettingRow = ({
  icon,
  title,
  description,
  status,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  status: string;
}) => (
  <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-4">
    <div className="flex items-center gap-3">
      <div className="rounded-xl bg-slate-800 p-2">
        {icon}
      </div>

      <div>
        <p className="font-medium">{title}</p>
        <p className="text-xs text-slate-500">
          {description}
        </p>
      </div>
    </div>

    <span className="flex items-center gap-1 text-xs text-emerald-400">
      <CheckCircle2 size={14} />
      {status}
    </span>
  </div>
);