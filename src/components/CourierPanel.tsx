import React, { useState, useEffect, useRef } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  MapPin,
  Navigation,
  Package,
  Phone,
  Power,
  Radio,
  Shield,
  Truck,
  User,
  Zap,
} from 'lucide-react';
import { CourierAvailability, CourierLocation, Order, OrderStatus, UserProfile } from '../types';
import { storage } from '../services/storage';
import { DeliveryProofModal } from './DeliveryProofModal';
import { DeliveryProofCard } from './DeliveryProofCard';

interface Props {
  currentCourier: UserProfile;
  orders: Order[];
}

export const CourierPanel: React.FC<Props> = ({ currentCourier, orders }) => {
  const [activeTab, setActiveTab] = useState<'active' | 'history' | 'profile'>('active');
  const [courierStatus, setCourierStatus] = useState<CourierAvailability>(
    currentCourier.courierStatus || 'Müsait'
  );

  // Delivery Proof modal state
  const [proofOrder, setProofOrder] = useState<Order | null>(null);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  // Location Sharing State
  const [isSharingLocation, setIsSharingLocation] = useState<boolean>(() => {
    const loc = storage.getCourierLocation(currentCourier.id);
    return loc ? loc.isSharing : false;
  });
  const [courierLoc, setCourierLoc] = useState<CourierLocation | undefined>(() => {
    return storage.getCourierLocation(currentCourier.id);
  });
  const [geoError, setGeoError] = useState<string | null>(null);
  const [isRequestingGeo, setIsRequestingGeo] = useState<boolean>(false);
  const watchIdRef = useRef<number | null>(null);

  // Sync courier location from storage listener
  useEffect(() => {
    const unsub = storage.subscribe(() => {
      const loc = storage.getCourierLocation(currentCourier.id);
      setCourierLoc(loc);
      if (loc) {
        setIsSharingLocation(loc.isSharing);
      }
    });
    return () => unsub();
  }, [currentCourier.id]);

  // Cleanup geolocation watch on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Filter orders assigned to this courier
  const myOrders = orders.filter((o) => o.courierId === currentCourier.id);

  const activeOrders = myOrders.filter(
    (o) => !['Teslim Edildi', 'İptal Edildi'].includes(o.status)
  );

  const completedOrders = myOrders.filter((o) => o.status === 'Teslim Edildi');

  // Total earnings (standard courier commission %70 or total price)
  const totalEarnings = completedOrders.reduce((sum, o) => sum + Math.round(o.price * 0.7), 0);

  const handleStatusChange = (status: CourierAvailability) => {
    setCourierStatus(status);
    storage.updateCourierStatus(currentCourier.id, status);
  };

  const handleUpdateOrderStatus = (orderId: string, nextStatus: OrderStatus) => {
    if (nextStatus === 'Teslim Edildi') {
      const target = orders.find((o) => o.id === orderId);
      if (target) {
        setProofOrder(target);
        return;
      }
    }
    storage.updateOrderStatus(orderId, nextStatus);
  };

  // Toggle Geolocation Sharing
  const handleToggleLocationSharing = () => {
    if (isSharingLocation) {
      // Turn off
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      storage.stopCourierLocationSharing(currentCourier.id);
      setIsSharingLocation(false);
      setCourierLoc((prev) => (prev ? { ...prev, isSharing: false } : undefined));
      setGeoError(null);
    } else {
      // User explicitly initiated location sharing
      if (!('geolocation' in navigator)) {
        setGeoError('Cihazınız veya tarayıcınız Geolocation (GPS) servisini desteklemiyor.');
        return;
      }

      setIsRequestingGeo(true);
      setGeoError(null);

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsRequestingGeo(false);
          const { latitude, longitude } = pos.coords;
          const updated = storage.updateCourierLocation(
            currentCourier.id,
            latitude,
            longitude,
            true
          );
          setIsSharingLocation(true);
          setCourierLoc(updated);

          // Continuous watcher for moving courier
          const id = navigator.geolocation.watchPosition(
            (watchPos) => {
              const u = storage.updateCourierLocation(
                currentCourier.id,
                watchPos.coords.latitude,
                watchPos.coords.longitude,
                true
              );
              setCourierLoc(u);
            },
            (err) => {
              console.warn('Geolocation izleme uyarısı:', err.message);
            },
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 25000 }
          );
          watchIdRef.current = id;
        },
        (err) => {
          setIsRequestingGeo(false);
          setIsSharingLocation(false);
          if (err.code === err.PERMISSION_DENIED) {
            setGeoError(
              'Konum erişim izni reddedildi. Canlı takip için lütfen tarayıcı veya telefon ayarlarınızdan konum iznini onaylayın.'
            );
          } else if (err.code === err.TIMEOUT) {
            setGeoError('GPS sinyali zaman aşımına uğradı. Lütfen açık alanda tekrar deneyin.');
          } else {
            setGeoError('Konum alınamadı: ' + err.message);
          }
        },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    }
  };

  const getNextAction = (currentStatus: OrderStatus) => {
    switch (currentStatus) {
      case 'Kurye Atandı':
        return {
          nextStatus: 'Kurye Kabul Etti' as OrderStatus,
          label: 'Kabul Et',
          color: 'bg-[#D6A84F] hover:bg-[#c49740] text-[#0B0B0D] shadow-lg shadow-[#D6A84F]/20',
        };
      case 'Kurye Kabul Etti':
        return {
          nextStatus: 'Paket Alındı' as OrderStatus,
          label: 'Paket Alındı',
          color: 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20',
        };
      case 'Paket Alındı':
        return {
          nextStatus: 'Teslimatta' as OrderStatus,
          label: 'Teslimatta',
          color: 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20',
        };
      case 'Teslimatta':
        return {
          nextStatus: 'Teslim Edildi' as OrderStatus,
          label: 'Teslim Edildi',
          color: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20',
        };
      default:
        return null;
    }
  };

  const orderFlowSteps: OrderStatus[] = [
    'Kurye Bekleniyor',
    'Kurye Atandı',
    'Kurye Kabul Etti',
    'Paket Alındı',
    'Teslimatta',
    'Teslim Edildi',
  ];

  return (
    <div className="space-y-5 pb-20">
      {/* Top Courier Stats & Status Switcher Card */}
      <div className="bg-[#19191E] border border-[#303036] rounded-3xl p-5 shadow-2xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-lg">
              {currentCourier.avatar ? (
                <img
                  src={currentCourier.avatar}
                  alt={currentCourier.name}
                  className="w-full h-full rounded-2xl object-cover"
                />
              ) : (
                <Truck className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white">
                  {currentCourier.name}
                </h2>
                <span className="text-[10px] font-mono bg-[#0B0B0D] px-2 py-0.5 rounded border border-[#303036] text-[#D6A84F]">
                  {currentCourier.plate || '34 TL 001'}
                </span>
              </div>
              <p className="text-xs text-[#999999] mt-0.5">
                {currentCourier.vehicle || 'Honda Forza 250'} • Puan: ⭐ {currentCourier.rating || '5.0'}
              </p>
            </div>
          </div>

          {/* Courier Availability Toggle */}
          <div className="flex items-center gap-1.5 bg-[#0B0B0D] p-1.5 rounded-2xl border border-[#303036] self-start sm:self-auto">
            {(['Müsait', 'Meşgul', 'Çevrimdışı'] as CourierAvailability[]).map((status) => {
              const isSelected = courierStatus === status;
              return (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? status === 'Müsait'
                        ? 'bg-emerald-500 text-white font-bold shadow-md shadow-emerald-500/20'
                        : status === 'Meşgul'
                        ? 'bg-amber-500 text-[#0B0B0D] font-bold'
                        : 'bg-red-500/20 text-red-400 border border-red-500/40'
                      : 'text-[#999999] hover:text-white'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${
                      status === 'Müsait'
                        ? 'bg-emerald-300 animate-pulse'
                        : status === 'Meşgul'
                        ? 'bg-amber-300'
                        : 'bg-gray-400'
                    }`}
                  />
                  <span>{status}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mini KPI metrics */}
        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-[#303036]">
          <div className="bg-[#222229] p-3 rounded-2xl border border-[#303036]/60 text-center">
            <span className="text-[10px] text-[#999999] block">Aktif Görev</span>
            <span className="text-lg font-bold text-white font-mono">{activeOrders.length}</span>
          </div>
          <div className="bg-[#222229] p-3 rounded-2xl border border-[#303036]/60 text-center">
            <span className="text-[10px] text-[#999999] block">Tamamlanan</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">
              {completedOrders.length}
            </span>
          </div>
          <div className="bg-[#222229] p-3 rounded-2xl border border-[#303036]/60 text-center">
            <span className="text-[10px] text-[#999999] block">Tahmini Hakediş</span>
            <span className="text-lg font-bold text-[#D6A84F] font-mono">{totalEarnings} TL</span>
          </div>
        </div>
      </div>

      {/* 4. KURYE KONUM ALTYAPISI & BÜYÜK MOBİL BUTON */}
      <div className="bg-[#19191E] border border-[#303036] rounded-3xl p-4 sm:p-5 shadow-xl">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isSharingLocation ? 'bg-emerald-500/20 text-emerald-400' : 'bg-[#222229] text-[#999999]'
            }`}>
              <Radio className={`w-4 h-4 ${isSharingLocation ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white">Canlı GPS Konum Altyapısı</h3>
              <p className="text-[11px] text-[#999999]">
                {isSharingLocation
                  ? 'Konumunuz aktif sipariş müşterisi ve sistem ile paylaşılıyor.'
                  : 'Müşterilerin sipariş takibi yapabilmesi için konum paylaşımını başlatın.'}
              </p>
            </div>
          </div>
          <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider shrink-0 ${
            isSharingLocation
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              : 'bg-[#222229] text-[#999999] border border-[#303036]'
          }`}>
            {isSharingLocation ? 'Yayında' : 'Kapalı'}
          </span>
        </div>

        {/* Big Mobile Touch Action Button for Location Sharing */}
        <button
          type="button"
          onClick={handleToggleLocationSharing}
          disabled={isRequestingGeo}
          className={`w-full min-h-[52px] py-3.5 px-5 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] cursor-pointer ${
            isSharingLocation
              ? 'bg-emerald-500/15 border-2 border-emerald-500 hover:bg-emerald-500/25 text-emerald-300 shadow-xl shadow-emerald-500/10'
              : 'bg-[#D6A84F] hover:bg-[#c49740] text-[#0B0B0D] shadow-xl shadow-[#D6A84F]/20'
          }`}
        >
          {isSharingLocation ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span>Canlı Konum Paylaşılıyor (Durdurmak İçin Dokunun)</span>
            </>
          ) : (
            <>
              <Navigation className="w-5 h-5 text-[#0B0B0D]" />
              <span>{isRequestingGeo ? 'GPS İzni İsteniyor...' : 'Konumumu Paylaş'}</span>
            </>
          )}
        </button>

        {courierLoc && isSharingLocation && (
          <div className="mt-3 p-3 bg-[#0B0B0D] border border-[#303036] rounded-xl flex items-center justify-between text-[11px] font-mono">
            <span className="text-emerald-400">
              📍 {courierLoc.latitude.toFixed(4)}, {courierLoc.longitude.toFixed(4)}
            </span>
            <span className="text-[#999999]">
              Güncellendi:{' '}
              {new Date(courierLoc.updatedAt).toLocaleTimeString('tr-TR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </span>
          </div>
        )}

        {geoError && (
          <div className="mt-3 p-3 bg-red-500/15 border border-red-500/30 rounded-xl flex items-start gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
            <span>{geoError}</span>
          </div>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex gap-2 border-b border-[#303036] pb-2">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeTab === 'active'
              ? 'bg-[#D6A84F] text-[#0B0B0D]'
              : 'bg-[#19191E] text-[#999999] hover:text-white border border-[#303036]'
          }`}
        >
          Aktif Siparişler ({activeOrders.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-colors ${
            activeTab === 'history'
              ? 'bg-[#D6A84F] text-[#0B0B0D]'
              : 'bg-[#19191E] text-[#999999] hover:text-white border border-[#303036]'
          }`}
        >
          Geçmiş Siparişler ({completedOrders.length})
        </button>
      </div>

      {/* Active Deliveries Tab */}
      {activeTab === 'active' && (
        <div className="space-y-4">
          {activeOrders.length === 0 ? (
            <div className="text-center py-16 bg-[#19191E] border border-[#303036] rounded-3xl p-6">
              <Truck className="w-12 h-12 text-[#999999]/30 mx-auto mb-3" />
              <h3 className="font-bold text-white text-base">Üzerinizde Aktif Sipariş Yok</h3>
              <p className="text-xs text-[#999999] mt-1 max-w-sm mx-auto">
                Yönetici tarafından size yeni bir sipariş atandığında burada otomatik olarak listelenecektir.
                Lütfen durumunuzu <b>"Müsait"</b> olarak tutunuz.
              </p>
            </div>
          ) : (
            activeOrders.map((order) => {
              const action = getNextAction(order.status);
              const currentStepIdx = orderFlowSteps.indexOf(order.status);

              return (
                <div
                  key={order.id}
                  className="bg-[#19191E] border-2 border-[#D6A84F]/50 rounded-3xl p-5 space-y-4 shadow-xl shadow-[#D6A84F]/5"
                >
                  {/* Top Bar (Order ID, Courier Type, Price) */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-[#D6A84F] bg-[#0B0B0D] px-2.5 py-1 rounded-lg border border-[#303036]">
                        #{order.id}
                      </span>
                      <span className="text-xs font-bold text-white bg-[#222229] px-2.5 py-1 rounded-lg">
                        {order.courierType}
                      </span>
                    </div>
                    <span className="text-base font-extrabold text-[#D6A84F] font-mono">
                      {order.price} TL
                    </span>
                  </div>

                  {/* 3. SİPARİŞ AKIŞI GÖRSEL PROGRESS BARI */}
                  <div className="bg-[#0B0B0D] p-3 rounded-2xl border border-[#303036]">
                    <span className="text-[10px] text-[#999999] uppercase tracking-wider font-bold block mb-2">
                      Sipariş Aşaması
                    </span>
                    <div className="grid grid-cols-6 gap-1 text-center">
                      {orderFlowSteps.map((step, idx) => {
                        const isDone = currentStepIdx >= idx;
                        const isCurrent = currentStepIdx === idx;
                        return (
                          <div key={step} className="flex flex-col items-center">
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold mb-1 transition-all ${
                                isCurrent
                                  ? 'bg-[#D6A84F] text-[#0B0B0D] ring-4 ring-[#D6A84F]/20 font-black'
                                  : isDone
                                  ? 'bg-emerald-500 text-white'
                                  : 'bg-[#19191E] text-[#999999] border border-[#303036]'
                              }`}
                            >
                              {isDone ? '✓' : idx + 1}
                            </div>
                            <span
                              className={`text-[8px] leading-tight truncate w-full ${
                                isCurrent
                                  ? 'text-[#D6A84F] font-bold'
                                  : isDone
                                  ? 'text-white'
                                  : 'text-[#999999]'
                              }`}
                            >
                              {step.replace('Kurye ', '').replace('Paket ', '')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. KURYE SİPARİŞ DETAYLARI: Müşteri Adı ve Telefonu */}
                  <div className="bg-[#222229] border border-[#303036] rounded-2xl p-3.5 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center text-xs font-bold">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="text-[10px] text-[#999999] block">Müşteri</span>
                        <h4 className="text-xs font-bold text-white">{order.customerName}</h4>
                      </div>
                    </div>
                    {order.customerPhone && (
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 text-xs font-bold transition-colors shadow-sm"
                      >
                        <Phone className="w-4 h-4" />
                        <span className="font-mono">{order.customerPhone}</span>
                      </a>
                    )}
                  </div>

                  {/* 2. KURYE SİPARİŞ DETAYLARI: Alınacak Adres & Teslim Adresi */}
                  <div className="space-y-3 bg-[#0B0B0D] border border-[#303036] p-4 rounded-2xl">
                    <div className="flex items-start gap-2.5">
                      <MapPin className="w-4 h-4 text-[#D6A84F] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-[#999999] font-bold uppercase block">
                          Alınacak Adres
                        </span>
                        <p className="text-xs text-white font-medium mt-0.5">
                          {order.pickupAddress}
                        </p>
                      </div>
                    </div>

                    <div className="border-l-2 border-dashed border-[#303036] ml-2 h-4 my-1" />

                    <div className="flex items-start gap-2.5">
                      <Navigation className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-[10px] text-[#999999] font-bold uppercase block">
                          Teslim Adresi
                        </span>
                        <p className="text-xs text-white font-medium mt-0.5">
                          {order.deliveryAddress}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 2. KURYE SİPARİŞ DETAYLARI: Paket Türü & Mesafe & Fiyat */}
                  <div className="flex items-center justify-between text-xs text-[#999999] px-1">
                    <span>
                      Paket Türü: <b className="text-white">{order.packageType}</b>
                    </span>
                    <span>
                      Mesafe: <b className="text-white font-mono">{order.distanceKm} KM</b>
                    </span>
                    <span>
                      Fiyat: <b className="text-[#D6A84F] font-mono">{order.price} TL</b>
                    </span>
                  </div>

                  {/* 2. KURYE SİPARİŞ DETAYLARI: Not (varsa) */}
                  {order.note && (
                    <div className="text-xs bg-[#222229] p-3 rounded-2xl border border-[#303036] text-amber-200">
                      <b className="text-white">Müşteri Notu:</b> {order.note}
                    </div>
                  )}

                  {/* 7. MOBİL UYUMLU BÜYÜK BUTONLAR: “Kabul Et”, “Paket Alındı”, “Teslimatta”, “Teslim Edildi” */}
                  {action && (
                    <button
                      type="button"
                      onClick={() => handleUpdateOrderStatus(order.id, action.nextStatus)}
                      className={`w-full min-h-[52px] py-4 px-6 rounded-2xl font-black text-base cursor-pointer flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] ${action.color}`}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      <span>{action.label}</span>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* History Deliveries Tab */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {completedOrders.length === 0 ? (
            <div className="text-center py-16 bg-[#19191E] border border-[#303036] rounded-3xl p-6 text-[#999999]">
              Henüz tamamlanan teslimatınız bulunmamaktadır.
            </div>
          ) : (
            completedOrders.map((order) => {
              const isExpanded = expandedHistoryId === order.id;
              return (
                <div
                  key={order.id}
                  className="bg-[#19191E] border border-[#303036] rounded-2xl p-4 space-y-3 text-xs"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono font-bold text-white">#{order.id}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">
                          Teslim Edildi
                        </span>
                      </div>
                      <p className="text-slate-300 truncate max-w-xs sm:max-w-md">
                        {order.pickupAddress.split(',')[0]} → {order.deliveryAddress.split(',')[0]}
                      </p>
                      <span className="text-[10px] text-[#999999]">
                        {new Date(order.deliveredAt || order.updatedAt).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-extrabold text-[#D6A84F] font-mono block">
                        {order.price} TL
                      </span>
                      <span className="text-[10px] text-emerald-400 block mb-1">
                        +{Math.round(order.price * 0.7)} TL Hakediş
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedHistoryId(isExpanded ? null : order.id)}
                        className="text-[11px] font-bold text-[#D6A84F] hover:underline cursor-pointer"
                      >
                        {isExpanded ? 'Kanıtı Gizle' : 'Kanıtı İncele'}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Delivery Proof */}
                  {isExpanded && (
                    <div className="pt-2 border-t border-[#303036] animate-fadeIn">
                      <DeliveryProofCard order={order} />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* DELIVERY PROOF MODAL */}
      {proofOrder && (
        <DeliveryProofModal
          order={proofOrder}
          isOpen={Boolean(proofOrder)}
          onClose={() => setProofOrder(null)}
          onSuccess={(updatedOrder) => {
            setProofOrder(null);
          }}
        />
      )}
    </div>
  );
};

