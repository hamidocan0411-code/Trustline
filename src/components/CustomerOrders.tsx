import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Compass,
  Filter,
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
} from 'lucide-react';
import { CourierLocation, Order, OrderStatus } from '../types';
import { storage } from '../services/storage';
import { GeoCoordinate, mapService } from '../services/mapService';
import { RouteMap } from './RouteMap';
import { DeliveryProofCard } from './DeliveryProofCard';

interface Props {
  orders: Order[];
  onOpenNewOrder: () => void;
  selectedOrderId?: string | null;
}

// 5. CANLI TAKİP: Müşteri aktif siparişinde kurye takibi bileşeni
const OrderTrackingCard: React.FC<{ order: Order }> = ({ order }) => {
  const [courierLoc, setCourierLoc] = useState<CourierLocation | undefined>(() =>
    order.courierId ? storage.getCourierLocation(order.courierId) : undefined
  );
  const [pickupCoords, setPickupCoords] = useState<GeoCoordinate | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<GeoCoordinate | null>(null);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);

  useEffect(() => {
    let isMounted = true;
    mapService.calculateDistance(order.pickupAddress, order.deliveryAddress).then((res) => {
      if (isMounted) {
        if (res.pickupCoords) setPickupCoords(res.pickupCoords);
        if (res.deliveryCoords) setDeliveryCoords(res.deliveryCoords);
        if (res.routePoints && res.routePoints.length > 0) setRoutePoints(res.routePoints);
      }
    });

    const unsub = storage.subscribe(() => {
      if (order.courierId) {
        setCourierLoc(storage.getCourierLocation(order.courierId));
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [order.pickupAddress, order.deliveryAddress, order.courierId]);

  const isSharing = courierLoc && courierLoc.isSharing;

  return (
    <div className="bg-[#19191E] border border-[#303036] rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-[#D6A84F]" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Kurye Takibi & Canlı Rota
          </h4>
        </div>
        <span
          className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
            isSharing
              ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
              : 'bg-[#222229] border border-[#303036] text-[#999999]'
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isSharing ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'
            }`}
          />
          {isSharing ? 'Canlı GPS Aktif' : 'GPS Bekleniyor'}
        </span>
      </div>

      {/* Map display */}
      <RouteMap
        pickupCoords={pickupCoords}
        deliveryCoords={deliveryCoords}
        routePoints={routePoints}
        courierCoords={
          isSharing && courierLoc
            ? {
                lat: courierLoc.latitude,
                lng: courierLoc.longitude,
                name: order.courierName || 'Kurye',
              }
            : null
        }
        distanceKm={order.distanceKm}
        approximateDistanceText={`${order.distanceKm} km`}
        isAutoCalculated={true}
      />

      {/* Explanation for tracking state */}
      {isSharing && courierLoc ? (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs flex items-center justify-between text-emerald-300">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse shrink-0" />
            <span>Kuryeniz hareket halinde ve konumu anlık iletiliyor.</span>
          </div>
          <span className="text-[10px] font-mono text-[#999999] shrink-0">
            {new Date(courierLoc.updatedAt).toLocaleTimeString('tr-TR', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            })}
          </span>
        </div>
      ) : (
        <div className="p-2.5 bg-[#222229] border border-[#303036] rounded-xl text-[11px] text-[#999999] space-y-1">
          <p className="flex items-center gap-1.5 text-amber-300/90 font-medium">
            <Info className="w-3.5 h-3.5 shrink-0" />
            Kurye henüz canlı konum paylaşımını başlatmadı.
          </p>
          <p className="text-[10px] text-[#999999]/80">
            Kurye cihazından konum izni verip paylaşımı başlattığında burada anlık harita üzerinde görünecektir (Sahte konum gösterilmemektedir).
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
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(selectedOrderId || null);

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      o.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.pickupAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.deliveryAddress.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'active') {
      return matchesSearch && !['Teslim Edildi', 'İptal Edildi'].includes(o.status);
    }
    if (statusFilter === 'completed') {
      return matchesSearch && ['Teslim Edildi'].includes(o.status);
    }
    return matchesSearch && o.status === statusFilter;
  });

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'Kurye Bekleniyor':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center gap-1">
            <Clock className="w-3 h-3 animate-spin" />
            Kurye Bekleniyor
          </span>
        );
      case 'Kurye Atandı':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center gap-1">
            <User className="w-3 h-3" />
            Kurye Atandı
          </span>
        );
      case 'Kurye Kabul Etti':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Kurye Kabul Etti
          </span>
        );
      case 'Paket Alındı':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 flex items-center gap-1">
            <Package className="w-3 h-3" />
            Paket Alındı
          </span>
        );
      case 'Teslimatta':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-[#D6A84F]/20 border border-[#D6A84F]/40 text-[#D6A84F] flex items-center gap-1">
            <Truck className="w-3 h-3 animate-pulse" />
            Teslimatta
          </span>
        );
      case 'Teslim Edildi':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Teslim Edildi
          </span>
        );
      case 'İptal Edildi':
        return (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            İptal Edildi
          </span>
        );
    }
  };

  const statusSteps: OrderStatus[] = [
    'Kurye Bekleniyor',
    'Kurye Atandı',
    'Kurye Kabul Etti',
    'Paket Alındı',
    'Teslimatta',
    'Teslim Edildi',
  ];

  const handleCancelOrder = (orderId: string) => {
    if (confirm('Bu siparişi iptal etmek istediğinize emin misiniz?')) {
      storage.updateOrderStatus(orderId, 'İptal Edildi', 'Müşteri tarafından iptal edildi.');
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header & New Order Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#19191E] border border-[#303036] p-4 rounded-2xl">
        <div>
          <h2 className="text-lg font-bold text-white font-['Space_Grotesk']">
            Siparişlerim ({orders.length})
          </h2>
          <p className="text-xs text-[#999999]">
            Tüm kurye gönderilerinizin anlık durum takibi
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

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#999999] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Sipariş No, adres veya ilçe ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#19191E] border border-[#303036] focus:border-[#D6A84F] text-xs text-white placeholder:text-[#999999] rounded-xl pl-9 pr-3 py-2.5 focus:outline-hidden transition-colors"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {[
            { key: 'all', label: 'Tümü' },
            { key: 'active', label: 'Aktif Siparişler' },
            { key: 'completed', label: 'Tamamlananlar' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-colors border ${
                statusFilter === tab.key
                  ? 'bg-[#D6A84F]/15 text-[#D6A84F] border-[#D6A84F]/40'
                  : 'bg-[#19191E] text-[#999999] border-[#303036] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-[#19191E] border border-[#303036] rounded-2xl p-6">
          <Package className="w-12 h-12 text-[#999999]/40 mx-auto mb-3" />
          <h3 className="font-bold text-white text-base">Sipariş Bulunamadı</h3>
          <p className="text-xs text-[#999999] mt-1 max-w-sm mx-auto">
            {searchTerm || statusFilter !== 'all'
              ? 'Arama kriterlerinize uygun sipariş bulunamadı.'
              : 'Henüz bir kurye talebiniz bulunmuyor. Hemen bir kurye çağırabilirsiniz.'}
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
            const isExpanded = expandedOrderId === order.id;
            const currentStepIdx = statusSteps.indexOf(order.status);

            return (
              <div
                key={order.id}
                className="bg-[#19191E] border border-[#303036] rounded-2xl overflow-hidden hover:border-[#D6A84F]/40 transition-all shadow-md"
              >
                {/* Main Card Summary */}
                <div
                  onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                  className="p-4 cursor-pointer flex flex-col gap-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-[#D6A84F] bg-[#0B0B0D] px-2.5 py-1 rounded-lg border border-[#303036]">
                        #{order.id}
                      </span>
                      <span className="text-xs text-[#999999]">
                        {new Date(order.createdAt).toLocaleDateString('tr-TR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    {getStatusBadge(order.status)}
                  </div>

                  {/* Route Overview */}
                  <div className="space-y-2 text-xs">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-[#D6A84F] shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-[#999999] block">Alım:</span>
                        <p className="text-white font-medium truncate">{order.pickupAddress}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Navigation className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] text-[#999999] block">Teslimat:</span>
                        <p className="text-white font-medium truncate">{order.deliveryAddress}</p>
                      </div>
                    </div>
                  </div>

                  {/* Footer Meta */}
                  <div className="flex items-center justify-between pt-3 border-t border-[#303036]/60 text-xs">
                    <div className="flex items-center gap-2 text-[#999999]">
                      <span className="bg-[#222229] px-2 py-0.5 rounded text-[11px]">
                        {order.packageType}
                      </span>
                      <span className="bg-[#222229] px-2 py-0.5 rounded text-[11px] text-[#D6A84F]">
                        {order.courierType}
                      </span>
                      <span className="font-mono">{order.distanceKm} KM</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-extrabold text-sm text-white">
                        {order.price} TL
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details & Timeline */}
                {isExpanded && (
                  <div className="p-4 bg-[#222229] border-t border-[#303036] space-y-4 animate-fadeIn">
                    {/* Status Stepper (if not cancelled) */}
                    {order.status !== 'İptal Edildi' && (
                      <div>
                        <span className="text-[11px] font-bold text-[#999999] uppercase tracking-wider block mb-2">
                          Teslimat Süreci
                        </span>
                        <div className="grid grid-cols-5 gap-1 text-center">
                          {statusSteps.map((step, idx) => {
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
                                <span className={`text-[9px] leading-tight ${isCurrent ? 'text-[#D6A84F] font-bold' : isDone ? 'text-white' : 'text-[#999999]'}`}>
                                  {step.replace('Kurye ', '').replace('Paket ', '')}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Assigned Courier Details if available */}
                    {order.courierName ? (
                      <div className="bg-[#19191E] border border-[#303036] rounded-xl p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                            <Truck className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="text-[10px] text-[#999999] uppercase tracking-wide block">
                              Atanan Kurye
                            </span>
                            <h4 className="text-xs font-bold text-white">{order.courierName}</h4>
                            <p className="text-[11px] text-emerald-400 font-mono">{order.courierPhone}</p>
                          </div>
                        </div>
                        {order.courierPhone && (
                          <a
                            href={`tel:${order.courierPhone}`}
                            className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white border border-emerald-500/30 transition-colors"
                            title="Kuryeyi Ara"
                          >
                            <Phone className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-[#999999] bg-[#19191E] p-3 rounded-xl border border-[#303036] flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>Kurye atanması bekleniyor. Ortalama 5 dakika içinde sistem tarafından eşleştirilir.</span>
                      </div>
                    )}

                    {/* 5. CANLI TAKİP: Kurye Takibi & Harita Alanı */}
                    {order.courierId && order.status !== 'İptal Edildi' && order.status !== 'Teslim Edildi' && (
                      <OrderTrackingCard order={order} />
                    )}

                    {/* 6. TESLİMAT KANITI: Teslim Edilen Siparişlerde Doğrulama Kartı */}
                    {(order.status === 'Teslim Edildi' || order.deliveryProof || order.signature) && (
                      <DeliveryProofCard order={order} />
                    )}

                    {/* Note if any */}
                    {order.note && (
                      <div className="text-xs bg-[#19191E] p-3 rounded-xl border border-[#303036]">
                        <span className="text-[10px] text-[#999999] block font-semibold mb-0.5">
                          Sipariş Notu:
                        </span>
                        <p className="text-slate-300 italic">{order.note}</p>
                      </div>
                    )}

                    {/* Cancel action if allowed */}
                    {order.status === 'Kurye Bekleniyor' && (
                      <div className="pt-2">
                        <button
                          onClick={() => handleCancelOrder(order.id)}
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
