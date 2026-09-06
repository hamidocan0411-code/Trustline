import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock,
  DollarSign,
  Edit2,
  Filter,
  Layers,
  MapPin,
  Navigation,
  Package,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Trash2,
  Truck,
  UserCheck,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { CourierAvailability, Order, OrderStatus, PricingConfig, UserProfile } from '../types';
import { storage } from '../services/storage';
import { DeliveryProofCard } from './DeliveryProofCard';

interface Props {
  orders: Order[];
  pricing: PricingConfig;
  onRefreshData?: () => void;
}

export const AdminPanel: React.FC<Props> = ({ orders, pricing }) => {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'orders' | 'couriers' | 'customers' | 'pricing' | 'settings'
  >('dashboard');

  // Selected Order for Admin Action Modal
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editPriceValue, setEditPriceValue] = useState<number>(0);
  const [selectedCourierToAssign, setSelectedCourierToAssign] = useState<string>('');
  const [selectedStatusToChange, setSelectedStatusToChange] = useState<OrderStatus>('Kurye Bekleniyor');

  // New Courier Modal
  const [showAddCourierModal, setShowAddCourierModal] = useState(false);
  const [newCourierName, setNewCourierName] = useState('');
  const [newCourierPhone, setNewCourierPhone] = useState('');
  const [newCourierEmail, setNewCourierEmail] = useState('');
  const [newCourierVehicle, setNewCourierVehicle] = useState('Honda Forza 250 (Motosiklet)');
  const [newCourierPlate, setNewCourierPlate] = useState('');

  // Pricing Form
  const [pricingForm, setPricingForm] = useState<PricingConfig>(pricing);
  const [pricingSaveSuccess, setPricingSaveSuccess] = useState(false);

  // Search & Filter
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  const couriers = storage.getCouriers();
  const customers = storage.getCustomers();

  // DASHBOARD KPI STATS
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((o) => o.status === 'Kurye Bekleniyor').length;
  const assignedOrders = orders.filter((o) => o.status === 'Kurye Atandı').length;
  const deliveringOrders = orders.filter((o) => ['Paket Alındı', 'Teslimatta'].includes(o.status)).length;
  const completedOrders = orders.filter((o) => o.status === 'Teslim Edildi').length;
  const cancelledOrders = orders.filter((o) => o.status === 'İptal Edildi').length;
  const totalRevenue = orders
    .filter((o) => o.status !== 'İptal Edildi')
    .reduce((sum, o) => sum + o.price, 0);

  // Filtered Orders
  const filteredOrders = orders.filter((o) => {
    const matches =
      o.id.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.customerName.toLowerCase().includes(orderSearch.toLowerCase()) ||
      (o.courierName && o.courierName.toLowerCase().includes(orderSearch.toLowerCase())) ||
      o.pickupAddress.toLowerCase().includes(orderSearch.toLowerCase()) ||
      o.deliveryAddress.toLowerCase().includes(orderSearch.toLowerCase());

    if (orderStatusFilter === 'all') return matches;
    return matches && o.status === orderStatusFilter;
  });

  const handleOpenOrderModal = (order: Order) => {
    setSelectedOrder(order);
    setEditPriceValue(order.price);
    setSelectedCourierToAssign(order.courierId || '');
    setSelectedStatusToChange(order.status);
  };

  const handleSaveOrderChanges = () => {
    if (!selectedOrder) return;

    // Update courier assignment if changed
    if (selectedCourierToAssign && selectedCourierToAssign !== selectedOrder.courierId) {
      storage.assignCourier(selectedOrder.id, selectedCourierToAssign);
    }

    // Update status if changed
    if (selectedStatusToChange !== selectedOrder.status) {
      storage.updateOrderStatus(selectedOrder.id, selectedStatusToChange);
    }

    // Update price if changed
    if (editPriceValue !== selectedOrder.price && editPriceValue > 0) {
      storage.updateOrderPrice(selectedOrder.id, editPriceValue);
    }

    setSelectedOrder(null);
  };

  const handleAddNewCourier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourierName.trim() || !newCourierPhone.trim()) return;

    storage.addCourier({
      name: newCourierName.trim(),
      email: newCourierEmail.trim() || `${newCourierName.toLowerCase().replace(/\s+/g, '')}@trustline.express`,
      phone: newCourierPhone.trim(),
      vehicle: newCourierVehicle,
      plate: newCourierPlate.trim() || `34 TL ${Math.floor(100 + Math.random() * 900)}`,
      courierStatus: 'Müsait',
    });

    setNewCourierName('');
    setNewCourierPhone('');
    setNewCourierEmail('');
    setNewCourierPlate('');
    setShowAddCourierModal(false);
  };

  const handleSavePricing = (e: React.FormEvent) => {
    e.preventDefault();
    storage.updatePricing(pricingForm);
    setPricingSaveSuccess(true);
    setTimeout(() => setPricingSaveSuccess(false), 3000);
  };

  const handleResetData = () => {
    if (confirm('Tüm sipariş ve kullanıcı verilerini başlangıç durumuna (seed) döndürmek istediğinize emin misiniz?')) {
      storage.resetDemoData();
      alert('Tüm veriler başarıyla sıfırlandı.');
    }
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Navigation Sub-Tabs Bar */}
      <div className="bg-[#19191E] border border-[#303036] rounded-2xl p-1.5 flex gap-1 overflow-x-auto shadow-md">
        {[
          { key: 'dashboard', label: 'Dashboard', icon: Layers },
          { key: 'orders', label: `Siparişler (${totalOrders})`, icon: Package },
          { key: 'couriers', label: `Kuryeler (${couriers.length})`, icon: Truck },
          { key: 'customers', label: `Müşteriler (${customers.length})`, icon: Users },
          { key: 'pricing', label: 'Fiyatlandırma', icon: DollarSign },
          { key: 'settings', label: 'Ayarlar', icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActiveTab(item.key as any)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'bg-[#D6A84F] text-[#0B0B0D] shadow-md shadow-[#D6A84F]/20'
                  : 'text-[#999999] hover:text-white hover:bg-[#222229]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div className="space-y-5 animate-fadeIn">
          {/* Main KPI Grid - Elegant Dark Theme */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            <div className="bg-[#19191E] border border-[#303036] p-4 rounded-2xl">
              <p className="text-[10px] text-[#999999] uppercase font-bold mb-1 tracking-wider">Toplam Ciro</p>
              <div className="text-xl sm:text-2xl font-bold text-[#D6A84F] font-mono">
                {totalRevenue.toLocaleString('tr-TR')} TL
              </div>
              <p className="text-[10px] text-emerald-400 font-medium mt-1">+14% Bu Ay</p>
            </div>

            <div className="bg-[#19191E] border border-[#303036] p-4 rounded-2xl">
              <p className="text-[10px] text-[#999999] uppercase font-bold mb-1 tracking-wider">Toplam Sipariş</p>
              <div className="text-xl sm:text-2xl font-bold text-white font-mono">
                {totalOrders}
              </div>
              <p className="text-[10px] text-emerald-400 font-medium mt-1">+12% Bugün</p>
            </div>

            <div className="bg-[#19191E] border border-[#303036] p-4 rounded-2xl">
              <p className="text-[10px] text-[#999999] uppercase font-bold mb-1 tracking-wider">Aktif Kuryeler</p>
              <div className="text-xl sm:text-2xl font-bold text-[#D6A84F] font-mono">
                {couriers.filter((c) => c.courierStatus === 'Müsait').length} / {couriers.length}
              </div>
              <p className="text-[10px] text-[#999999] mt-1">
                {couriers.filter((c) => c.courierStatus === 'Müsait').length} Müsait
              </p>
            </div>

            <div className="bg-[#19191E] border border-amber-500/30 bg-amber-500/5 p-4 rounded-2xl">
              <p className="text-[10px] text-amber-400 uppercase font-bold mb-1 tracking-wider">Kurye Bekleyen</p>
              <div className="text-xl sm:text-2xl font-bold text-amber-400 font-mono">
                {pendingOrders}
              </div>
              <p className="text-[10px] text-amber-400/80 mt-1">Acil atama bekliyor</p>
            </div>

            <div className="bg-[#19191E] border border-blue-500/30 bg-blue-500/5 p-4 rounded-2xl">
              <p className="text-[10px] text-blue-400 uppercase font-bold mb-1 tracking-wider">Kurye Atanan</p>
              <div className="text-xl sm:text-2xl font-bold text-blue-400 font-mono">
                {assignedOrders}
              </div>
              <p className="text-[10px] text-blue-400/80 mt-1">Paket alımı aşamasında</p>
            </div>

            <div className="bg-[#19191E] border border-purple-500/30 bg-purple-500/5 p-4 rounded-2xl">
              <p className="text-[10px] text-purple-400 uppercase font-bold mb-1 tracking-wider">Teslimatta / Yolda</p>
              <div className="text-xl sm:text-2xl font-bold text-purple-400 font-mono">
                {deliveringOrders}
              </div>
              <p className="text-[10px] text-purple-400/80 mt-1">Yoldaki aktif paketler</p>
            </div>

            <div className="bg-[#19191E] border border-emerald-500/30 bg-emerald-500/5 p-4 rounded-2xl">
              <p className="text-[10px] text-emerald-400 uppercase font-bold mb-1 tracking-wider">Teslim Edilen</p>
              <div className="text-xl sm:text-2xl font-bold text-emerald-400 font-mono">
                {completedOrders}
              </div>
              <p className="text-[10px] text-emerald-400/80 mt-1">Başarıyla sonuçlanan</p>
            </div>

            <div className="bg-[#19191E] border border-[#303036] p-4 rounded-2xl">
              <p className="text-[10px] text-[#999999] uppercase font-bold mb-1 tracking-wider">Müşteri Memnuniyeti</p>
              <div className="text-xl sm:text-2xl font-bold text-[#D6A84F] font-mono">
                %98.4
              </div>
              <p className="text-[10px] text-[#999999] mt-1">4.9 / 5.0 Yıldız</p>
            </div>
          </div>

          {/* System Status Banner - Elegant Dark Theme */}
          <div className="p-3.5 bg-[#222229] border border-[#303036] rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-white">
                Sistem Durumu: Aktif & Operasyonel
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#999999]">
              <span>Günlük Ciro: <b className="text-white font-mono">₺14,250</b></span>
              <span>Memnuniyet: <b className="text-[#D6A84F] font-mono">%98.4</b></span>
            </div>
          </div>

          {/* Urgent Attention / Pending Orders Banner */}
          {pendingOrders > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-amber-400 shrink-0 animate-spin" />
                <div>
                  <h4 className="text-xs font-bold text-white">
                    {pendingOrders} adet sipariş için kurye ataması bekleniyor!
                  </h4>
                  <p className="text-[11px] text-[#999999]">
                    Siparişler sekmesine geçerek uygun kuryelere tek tıkla atama yapabilirsiniz.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setOrderStatusFilter('Kurye Bekleniyor');
                  setActiveTab('orders');
                }}
                className="bg-amber-400 hover:bg-amber-300 text-[#0B0B0D] font-bold text-xs px-3 py-1.5 rounded-xl shrink-0 cursor-pointer"
              >
                Atamaya Git
              </button>
            </div>
          )}

          {/* Quick Active Orders Preview - Elegant Dark */}
          <div className="bg-[#19191E] border border-[#303036] rounded-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b border-[#303036] flex justify-between items-center">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">Son Siparişler</h3>
              <button
                onClick={() => setActiveTab('orders')}
                className="text-[10px] text-[#D6A84F] font-bold tracking-wider hover:underline uppercase cursor-pointer"
              >
                TÜMÜNÜ GÖR
              </button>
            </div>
            <div className="divide-y divide-[#303036]">
              {orders.slice(0, 5).map((order) => (
                <div
                  key={order.id}
                  onClick={() => handleOpenOrderModal(order)}
                  className="p-4 hover:bg-[#222229]/40 flex items-center justify-between gap-2 text-xs cursor-pointer transition-colors"
                >
                  <div className="space-y-1 truncate">
                    <div className="flex items-center gap-2">
                      <span className="bg-[#D6A84F]/10 text-[#D6A84F] text-[9px] font-bold px-2 py-0.5 rounded border border-[#D6A84F]/20 font-mono">
                        #{order.id}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-400">
                        {order.status}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-white truncate">
                      {order.pickupAddress.split(',')[0]} → {order.deliveryAddress.split(',')[0]}
                    </p>
                    <p className="text-[10px] text-[#999999] truncate">
                      Müşteri: {order.customerName} {order.courierName ? `| Kurye: ${order.courierName}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono font-bold text-sm text-[#D6A84F]">{order.price} TL</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#999999]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ORDERS MANAGEMENT TAB */}
      {activeTab === 'orders' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Filter and Search Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#999999] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Sipariş no, müşteri adı, kurye adı veya adres ara..."
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="w-full bg-[#19191E] border border-[#303036] focus:border-[#D6A84F] text-xs text-white placeholder:text-[#999999] rounded-xl pl-9 pr-3 py-2.5 focus:outline-hidden"
              />
            </div>
            <select
              value={orderStatusFilter}
              onChange={(e) => setOrderStatusFilter(e.target.value)}
              className="bg-[#19191E] border border-[#303036] focus:border-[#D6A84F] text-xs text-white rounded-xl px-3 py-2.5 focus:outline-hidden cursor-pointer"
            >
              <option value="all">Tüm Durumlar ({orders.length})</option>
              <option value="Kurye Bekleniyor">Kurye Bekleniyor</option>
              <option value="Kurye Atandı">Kurye Atandı</option>
              <option value="Kurye Kabul Etti">Kurye Kabul Etti</option>
              <option value="Paket Alındı">Paket Alındı</option>
              <option value="Teslimatta">Teslimatta</option>
              <option value="Teslim Edildi">Teslim Edildi</option>
              <option value="İptal Edildi">İptal Edildi</option>
            </select>
          </div>

          {/* Orders Table / Cards */}
          <div className="space-y-2.5">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-16 bg-[#19191E] border border-[#303036] rounded-2xl text-xs text-[#999999]">
                Kriterlere uygun sipariş bulunamadı.
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div
                  key={order.id}
                  className="bg-[#19191E] border border-[#303036] hover:border-[#D6A84F]/40 p-4 rounded-2xl transition-all shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold text-[#D6A84F] bg-[#0B0B0D] px-2 py-0.5 rounded border border-[#303036]">
                        #{order.id}
                      </span>
                      <span className="font-bold text-white">{order.customerName}</span>
                      <span className="text-[#999999]">({order.customerPhone})</span>
                      <span className="text-[11px] font-semibold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded">
                        {order.courierType}
                      </span>
                    </div>

                    <div className="text-[#999999] truncate">
                      <span className="text-white">Alım:</span> {order.pickupAddress}
                    </div>
                    <div className="text-[#999999] truncate">
                      <span className="text-white">Teslim:</span> {order.deliveryAddress}
                    </div>

                    <div className="flex items-center gap-3 pt-1 text-[11px] text-[#999999]">
                      <span>{order.packageType}</span>
                      <span>•</span>
                      <span className="font-mono">{order.distanceKm} KM</span>
                      <span>•</span>
                      <span>
                        Kurye:{' '}
                        {order.courierName ? (
                          <b className="text-emerald-400">{order.courierName}</b>
                        ) : (
                          <b className="text-amber-400">Atama Bekliyor</b>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Actions & Price */}
                  <div className="flex items-center justify-between md:flex-col md:items-end gap-2 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-[#303036]">
                    <div className="text-right">
                      <div className="text-base font-extrabold text-[#D6A84F] font-mono">
                        {order.price} TL
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0B0B0D] border border-[#303036] text-white">
                        {order.status}
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenOrderModal(order)}
                      className="bg-[#222229] hover:bg-[#D6A84F] hover:text-[#0B0B0D] text-white border border-[#303036] px-3 py-1.5 rounded-xl font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>Yönet & Ata</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* COURIERS MANAGEMENT TAB */}
      {activeTab === 'couriers' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between bg-[#19191E] border border-[#303036] p-4 rounded-2xl">
            <div>
              <h3 className="text-sm font-bold text-white">Kurye Filosu ({couriers.length})</h3>
              <p className="text-xs text-[#999999]">Kuryeleri görüntüleyin, durumlarını yönetin ve yeni kurye ekleyin</p>
            </div>
            <button
              onClick={() => setShowAddCourierModal(true)}
              className="bg-[#D6A84F] hover:bg-[#c49740] text-[#0B0B0D] font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-[#D6A84F]/10 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Yeni Kurye Ekle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {couriers.map((courier) => (
              <div
                key={courier.id}
                className="bg-[#19191E] border border-[#303036] p-4 rounded-2xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                      {courier.avatar ? (
                        <img src={courier.avatar} alt={courier.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <Truck className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white">{courier.name}</h4>
                      <p className="text-[11px] text-[#999999]">{courier.phone}</p>
                    </div>
                  </div>

                  {/* Status toggle directly from admin */}
                  <select
                    value={courier.courierStatus || 'Müsait'}
                    onChange={(e) => storage.updateCourierStatus(courier.id, e.target.value as CourierAvailability)}
                    className={`text-[11px] font-bold px-2 py-1 rounded-lg border cursor-pointer focus:outline-hidden ${
                      courier.courierStatus === 'Müsait'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : courier.courierStatus === 'Meşgul'
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                        : 'bg-gray-500/20 text-gray-400 border-gray-500/40'
                    }`}
                  >
                    <option value="Müsait">Müsait</option>
                    <option value="Meşgul">Meşgul</option>
                    <option value="Çevrimdışı">Çevrimdışı</option>
                  </select>
                </div>

                <div className="bg-[#222229] p-2.5 rounded-xl border border-[#303036]/60 text-xs space-y-1">
                  <div className="flex justify-between text-[#999999]">
                    <span>Araç / Model:</span>
                    <span className="text-white font-medium">{courier.vehicle || 'Motosiklet'}</span>
                  </div>
                  <div className="flex justify-between text-[#999999]">
                    <span>Plaka:</span>
                    <span className="font-mono text-[#D6A84F] font-bold">{courier.plate || '-'}</span>
                  </div>
                  <div className="flex justify-between text-[#999999]">
                    <span>E-posta:</span>
                    <span className="text-white truncate max-w-[180px]">{courier.email}</span>
                  </div>
                  <div className="flex justify-between text-[#999999]">
                    <span>Tamamlanan Teslimat:</span>
                    <span className="text-emerald-400 font-bold">
                      {orders.filter((o) => o.courierId === courier.id && o.status === 'Teslim Edildi').length} Görev
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CUSTOMERS MANAGEMENT TAB */}
      {activeTab === 'customers' && (
        <div className="space-y-4 animate-fadeIn">
          <div className="bg-[#19191E] border border-[#303036] p-4 rounded-2xl">
            <h3 className="text-sm font-bold text-white">Kayıtlı Müşteriler ({customers.length})</h3>
            <p className="text-xs text-[#999999]">Müşteri hesapları ve sipariş geçmişleri</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {customers.map((cust) => {
              const custOrders = orders.filter((o) => o.customerId === cust.id);
              return (
                <div
                  key={cust.id}
                  className="bg-[#19191E] border border-[#303036] p-4 rounded-2xl space-y-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold">
                      {cust.name.charAt(0)}
                    </div>
                    <div>
                      <h4 className="font-bold text-white text-sm">{cust.name}</h4>
                      <p className="text-[#999999] text-[11px]">{cust.email}</p>
                    </div>
                  </div>

                  <div className="bg-[#222229] p-3 rounded-xl border border-[#303036]/60 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-[#999999]">Telefon:</span>
                      <span className="font-mono text-white">{cust.phone}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#999999]">Toplam Sipariş:</span>
                      <span className="font-bold text-white">{custOrders.length} Adet</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#999999]">Toplam Harcama:</span>
                      <span className="font-bold text-[#D6A84F] font-mono">
                        {custOrders.reduce((sum, o) => sum + o.price, 0)} TL
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PRICING CONFIGURATION TAB */}
      {activeTab === 'pricing' && (
        <div className="bg-[#19191E] border border-[#303036] rounded-3xl p-6 space-y-5 animate-fadeIn shadow-2xl">
          <div>
            <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
              Fiyatlandırma Ayarları
            </h3>
            <p className="text-xs text-[#999999] mt-0.5">
              Buradan güncellenen tüm fiyat parametreleri tüm yeni kurye siparişlerinde ve Trustline AI hesaplamalarında anında uygulanır.
            </p>
          </div>

          {pricingSaveSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Fiyatlandırma ayarları başarıyla kaydedildi ve tüm sisteme uygulandı.</span>
            </div>
          )}

          <form onSubmit={handleSavePricing} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#222229] border border-[#303036] p-4 rounded-2xl">
                <label className="text-xs font-bold text-white block mb-1">
                  Kilometre Başı Ücret (TL)
                </label>
                <p className="text-[11px] text-[#999999] mb-2">Her 1 KM mesafe için taban hesaplama tutarı</p>
                <input
                  type="number"
                  min="10"
                  max="500"
                  value={pricingForm.perKmPrice}
                  onChange={(e) =>
                    setPricingForm({ ...pricingForm, perKmPrice: Number(e.target.value) || 50 })
                  }
                  className="w-full bg-[#0B0B0D] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-white focus:outline-hidden"
                />
              </div>

              <div className="bg-[#222229] border border-[#303036] p-4 rounded-2xl">
                <label className="text-xs font-bold text-white block mb-1">
                  Minimum Sipariş / Taban Açılış Fiyatı (TL)
                </label>
                <p className="text-[11px] text-[#999999] mb-2">Hesaplanan tutar bu değerin altında olamaz</p>
                <input
                  type="number"
                  min="50"
                  max="1000"
                  value={pricingForm.minPrice}
                  onChange={(e) =>
                    setPricingForm({ ...pricingForm, minPrice: Number(e.target.value) || 250 })
                  }
                  className="w-full bg-[#0B0B0D] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-white focus:outline-hidden"
                />
              </div>

              <div className="bg-[#222229] border border-[#303036] p-4 rounded-2xl">
                <label className="text-xs font-bold text-white block mb-1">
                  Acil Kurye Çarpanı (Örn: 1.30)
                </label>
                <p className="text-[11px] text-[#999999] mb-2">30-60 dk ekspres teslimatlarda uygulanan katsayı</p>
                <input
                  type="number"
                  step="0.05"
                  min="1.0"
                  max="3.0"
                  value={pricingForm.urgentMultiplier}
                  onChange={(e) =>
                    setPricingForm({ ...pricingForm, urgentMultiplier: Number(e.target.value) || 1.3 })
                  }
                  className="w-full bg-[#0B0B0D] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-white focus:outline-hidden"
                />
              </div>

              <div className="bg-[#222229] border border-[#303036] p-4 rounded-2xl">
                <label className="text-xs font-bold text-white block mb-1">
                  VIP Kurye Çarpanı (Örn: 1.60)
                </label>
                <p className="text-[11px] text-[#999999] mb-2">Özel tahsisli VIP teslimatlarda uygulanan katsayı</p>
                <input
                  type="number"
                  step="0.05"
                  min="1.0"
                  max="4.0"
                  value={pricingForm.vipMultiplier}
                  onChange={(e) =>
                    setPricingForm({ ...pricingForm, vipMultiplier: Number(e.target.value) || 1.6 })
                  }
                  className="w-full bg-[#0B0B0D] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3 py-2.5 text-sm font-mono font-bold text-white focus:outline-hidden"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-[#D6A84F] hover:bg-[#c49740] text-[#0B0B0D] font-extrabold text-sm shadow-xl shadow-[#D6A84F]/20 transition-all cursor-pointer"
            >
              Fiyatlandırma Değişikliklerini Kaydet
            </button>
          </form>
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div className="bg-[#19191E] border border-[#303036] rounded-3xl p-6 space-y-6 animate-fadeIn">
          <div>
            <h3 className="text-base font-bold text-white font-['Space_Grotesk']">
              Sistem Durumu & Ayarlar
            </h3>
            <p className="text-xs text-[#999999] mt-0.5">
              Altyapı entegrasyonları, veritabanı senkronizasyonu ve demo kontrolleri
            </p>
          </div>

          <div className="space-y-3">
            <div className="bg-[#222229] border border-[#303036] p-4 rounded-2xl flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Firebase Firestore & Auth Entegrasyonu</h4>
                <p className="text-[11px] text-[#999999]">
                  Kalıcı bulut veritabanı şeması ve güvenlik kuralları (firestore.rules) hazır.
                </p>
              </div>
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                Aktif / Hazır
              </span>
            </div>

            <div className="bg-[#222229] border border-[#303036] p-4 rounded-2xl flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Trustline AI (Gemini Flash) Servisi</h4>
                <p className="text-[11px] text-[#999999]">
                  Doğal dille kurye anlama ve siparişe dönüştürme uç noktası (/api/ai/chat) devrede.
                </p>
              </div>
              <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full">
                Aktif
              </span>
            </div>

            <div className="bg-[#222229] border border-[#303036] p-4 rounded-2xl flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Modüler Harita & Rotalama Altyapısı</h4>
                <p className="text-[11px] text-[#999999]">
                  Google Maps Platform entegrasyonuna hazır mimari.
                </p>
              </div>
              <span className="text-[11px] font-bold text-[#D6A84F] bg-[#D6A84F]/15 border border-[#D6A84F]/30 px-2.5 py-1 rounded-full">
                Modüler Hazır
              </span>
            </div>

            {/* TESLİMAT KANITI AYARI: Fotoğraf Zorunluluğu */}
            <div className="bg-[#222229] border border-[#303036] p-4 rounded-2xl flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#D6A84F]" />
                  <h4 className="text-xs font-bold text-white">Teslimat Fotoğrafı Zorunlu</h4>
                  {pricing.requireDeliveryPhoto ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                      Açık (Zorunlu)
                    </span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#303036] text-[#999999] font-bold">
                      Kapalı (İsteğe Bağlı)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[#999999]">
                  Açıldığında, kurye teslimat kanıtı ekranında teslimat fotoğrafı çekmeden teslimatı tamamlayamaz. Kapalıyken fotoğraf isteğe bağlı kalır.
                </p>
              </div>

              <button
                type="button"
                id="toggle-require-delivery-photo"
                onClick={() => {
                  storage.updatePricing({
                    ...pricing,
                    requireDeliveryPhoto: !pricing.requireDeliveryPhoto,
                  });
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  pricing.requireDeliveryPhoto ? 'bg-[#D6A84F]' : 'bg-[#303036]'
                }`}
                title={pricing.requireDeliveryPhoto ? 'Fotoğraf zorunluluğunu kapat' : 'Fotoğraf zorunluluğunu aç'}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#0B0B0D] shadow-lg ring-0 transition duration-200 ease-in-out ${
                    pricing.requireDeliveryPhoto ? 'translate-x-5 bg-white' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-[#303036]">
            <h4 className="text-xs font-bold text-red-400 mb-1">Demo Verilerini Sıfırlama</h4>
            <p className="text-[11px] text-[#999999] mb-3">
              Uygulamadaki tüm test siparişlerini ve kullanıcı değişikliklerini ilk fabrika ayarlarına döndürür.
            </p>
            <button
              onClick={handleResetData}
              className="px-4 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30 text-xs font-bold transition-colors cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tüm Demo Verileri Sıfırla (Reset)</span>
            </button>
          </div>
        </div>
      )}

      {/* ORDER ACTION MODAL (ASSIGN COURIER, CHANGE STATUS, CHANGE PRICE, CANCEL) */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn overflow-y-auto">
          <div
            className="w-full max-w-lg bg-[#19191E] border border-[#303036] rounded-3xl p-5 shadow-2xl space-y-4 my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#303036] pb-3">
              <div>
                <span className="text-xs font-mono font-bold text-[#D6A84F]">
                  #{selectedOrder.id}
                </span>
                <h3 className="font-bold text-white text-base">Sipariş Yönetimi</h3>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-1.5 rounded-lg text-[#999999] hover:text-white hover:bg-[#222229]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Route Summary */}
            <div className="bg-[#222229] p-3 rounded-2xl text-xs space-y-1">
              <p className="text-[#999999]">
                Müşteri: <b className="text-white">{selectedOrder.customerName}</b> ({selectedOrder.customerPhone})
              </p>
              <p className="text-[#999999] truncate">
                Alım: <span className="text-white">{selectedOrder.pickupAddress}</span>
              </p>
              <p className="text-[#999999] truncate">
                Teslim: <span className="text-white">{selectedOrder.deliveryAddress}</span>
              </p>
            </div>

            {/* TESLİMAT KANITI: Teslim edilmiş veya kanıt içeren siparişlerde */}
            {(selectedOrder.status === 'Teslim Edildi' || selectedOrder.deliveryProof || selectedOrder.signature) && (
              <DeliveryProofCard order={selectedOrder} />
            )}

            {/* 1. Assign Courier List */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-[#D6A84F]" />
                  <span>Kurye Atama & Müsait Kuryeler</span>
                </label>
                <span className="text-[11px] text-[#999999]">
                  {couriers.filter((c) => (c.courierStatus || 'Müsait') === 'Müsait').length} Müsait
                </span>
              </div>

              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {couriers.map((c) => {
                  const isSelected = selectedCourierToAssign === c.id;
                  const isCurrentlyAssigned = selectedOrder.courierId === c.id;
                  const status = c.courierStatus || 'Müsait';

                  return (
                    <div
                      key={c.id}
                      onClick={() => setSelectedCourierToAssign(c.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-[#D6A84F]/15 border-[#D6A84F] shadow-lg shadow-[#D6A84F]/10'
                          : isCurrentlyAssigned
                          ? 'bg-blue-500/10 border-blue-500/40'
                          : 'bg-[#0B0B0D] border-[#303036] hover:border-[#D6A84F]/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#222229] border border-[#303036] flex items-center justify-center shrink-0">
                          <Truck
                            className={`w-4 h-4 ${
                              status === 'Müsait' ? 'text-emerald-400' : 'text-[#999999]'
                            }`}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-white truncate">{c.name}</h4>
                            <span
                              className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                                status === 'Müsait'
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                  : status === 'Meşgul'
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                                  : 'bg-gray-500/20 text-gray-400 border border-gray-500/40'
                              }`}
                            >
                              {status}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#999999] truncate mt-0.5">
                            Tel: <span className="text-slate-300 font-mono">{c.phone}</span> • Araç:{' '}
                            <span className="text-white font-medium">{c.vehicle || 'Motosiklet'}</span> • Plaka:{' '}
                            <span className="font-mono text-[#D6A84F] font-bold">{c.plate || '-'}</span>
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCourierToAssign(c.id);
                          storage.assignCourier(selectedOrder.id, c.id);
                          setSelectedOrder(null);
                        }}
                        className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold bg-[#D6A84F] hover:bg-[#c49740] text-[#0B0B0D] transition-colors cursor-pointer flex items-center gap-1 shadow-md shadow-[#D6A84F]/20"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Kurye Ata</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Change Status */}
            <div>
              <label className="text-xs font-bold text-white block mb-1.5">
                Sipariş Durumunu Değiştir
              </label>
              <select
                value={selectedStatusToChange}
                onChange={(e) => setSelectedStatusToChange(e.target.value as OrderStatus)}
                className="w-full bg-[#0B0B0D] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden cursor-pointer"
              >
                <option value="Kurye Bekleniyor">Kurye Bekleniyor</option>
                <option value="Kurye Atandı">Kurye Atandı</option>
                <option value="Kurye Kabul Etti">Kurye Kabul Etti</option>
                <option value="Paket Alındı">Paket Alındı</option>
                <option value="Teslimatta">Teslimatta</option>
                <option value="Teslim Edildi">Teslim Edildi</option>
                <option value="İptal Edildi">İptal Edildi</option>
              </select>
            </div>

            {/* 3. Change Price */}
            <div>
              <label className="text-xs font-bold text-white block mb-1.5">
                Sipariş Fiyatını Güncelle (TL)
              </label>
              <input
                type="number"
                value={editPriceValue}
                onChange={(e) => setEditPriceValue(Number(e.target.value) || 0)}
                className="w-full bg-[#0B0B0D] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3 py-2 text-xs font-mono font-bold text-[#D6A84F] focus:outline-hidden"
              />
            </div>

            <div className="flex gap-2 pt-3 border-t border-[#303036]">
              <button
                type="button"
                onClick={() => {
                  storage.updateOrderStatus(selectedOrder.id, 'İptal Edildi', 'Admin tarafından iptal edildi.');
                  setSelectedOrder(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white text-xs font-bold transition-all border border-red-500/30 cursor-pointer"
              >
                Siparişi İptal Et
              </button>

              <button
                type="button"
                onClick={handleSaveOrderChanges}
                className="flex-1 py-2.5 rounded-xl bg-[#D6A84F] hover:bg-[#c49740] text-[#0B0B0D] font-extrabold text-xs transition-all shadow-md shadow-[#D6A84F]/20 cursor-pointer"
              >
                Değişiklikleri Uygula
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD NEW COURIER MODAL */}
      {showAddCourierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-md bg-[#19191E] border border-[#303036] rounded-3xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#303036] pb-3">
              <h3 className="font-bold text-white text-base">Yeni Kurye Ekle</h3>
              <button
                onClick={() => setShowAddCourierModal(false)}
                className="p-1.5 rounded-lg text-[#999999] hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddNewCourier} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Ad Soyad
                </label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Burak Şimşek"
                  value={newCourierName}
                  onChange={(e) => setNewCourierName(e.target.value)}
                  className="w-full bg-[#0B0B0D] border border-[#303036] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Telefon Numarası
                </label>
                <input
                  type="tel"
                  required
                  placeholder="0530 000 00 00"
                  value={newCourierPhone}
                  onChange={(e) => setNewCourierPhone(e.target.value)}
                  className="w-full bg-[#0B0B0D] border border-[#303036] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  E-posta
                </label>
                <input
                  type="email"
                  placeholder="kurye@trustline.express"
                  value={newCourierEmail}
                  onChange={(e) => setNewCourierEmail(e.target.value)}
                  className="w-full bg-[#0B0B0D] border border-[#303036] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Araç Modeli
                </label>
                <input
                  type="text"
                  placeholder="Honda Forza 250 / Yamaha XMAX"
                  value={newCourierVehicle}
                  onChange={(e) => setNewCourierVehicle(e.target.value)}
                  className="w-full bg-[#0B0B0D] border border-[#303036] rounded-xl px-3 py-2 text-xs text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Plaka
                </label>
                <input
                  type="text"
                  placeholder="34 TL 890"
                  value={newCourierPlate}
                  onChange={(e) => setNewCourierPlate(e.target.value)}
                  className="w-full bg-[#0B0B0D] border border-[#303036] rounded-xl px-3 py-2 text-xs text-white font-mono uppercase focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-3 rounded-xl bg-[#D6A84F] hover:bg-[#c49740] text-[#0B0B0D] font-extrabold text-xs shadow-md transition-all cursor-pointer"
              >
                Kuryeyi Kaydet
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
