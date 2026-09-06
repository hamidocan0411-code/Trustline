import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  ChevronRight,
  Clock,
  HelpCircle,
  Loader2,
  MapPin,
  Navigation,
  Package,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import { CourierType, Order, PackageType, PricingConfig, UrgencyLevel, UserProfile } from '../types';
import { calculateOrderPrice, estimateDistanceBetweenAddresses } from '../utils/pricing';
import { storage } from '../services/storage';
import { GeoCoordinate, mapService } from '../services/mapService';
import { RouteMap } from './RouteMap';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  pricing: PricingConfig;
  prefillData?: Partial<Order>;
  onOrderCreated: (newOrder: Order) => void;
}

export const NewOrderModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentUser,
  pricing,
  prefillData,
  onOrderCreated,
}) => {
  if (!isOpen) return null;

  const [pickupAddress, setPickupAddress] = useState(prefillData?.pickupAddress || '');
  const [deliveryAddress, setDeliveryAddress] = useState(prefillData?.deliveryAddress || '');
  const [packageType, setPackageType] = useState<PackageType>(prefillData?.packageType || 'Evrak');
  const [packageCount, setPackageCount] = useState<number>(prefillData?.packageCount || 1);
  const [courierType, setCourierType] = useState<CourierType>(prefillData?.courierType || 'Standart Kurye');
  const [urgency, setUrgency] = useState<UrgencyLevel>(prefillData?.urgency || 'Normal');
  const [distanceKm, setDistanceKm] = useState<number>(prefillData?.distanceKm || 10);
  const [note, setNote] = useState(prefillData?.note || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successOrder, setSuccessOrder] = useState<Order | null>(null);

  // Automatic Address & Distance System State
  const [pickupCoords, setPickupCoords] = useState<GeoCoordinate | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<GeoCoordinate | null>(null);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [approximateDistanceText, setApproximateDistanceText] = useState<string>('');
  const [isAutoCalculated, setIsAutoCalculated] = useState<boolean>(false);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState<boolean>(false);
  const [autoCalcError, setAutoCalcError] = useState<string>('');
  const [showMap, setShowMap] = useState<boolean>(true);

  const debounceTimerRef = useRef<any>(null);

  // Sync state whenever prefillData or modal open status changes
  useEffect(() => {
    if (prefillData) {
      if (prefillData.pickupAddress !== undefined) setPickupAddress(prefillData.pickupAddress);
      if (prefillData.deliveryAddress !== undefined) setDeliveryAddress(prefillData.deliveryAddress);
      if (prefillData.packageType !== undefined) setPackageType(prefillData.packageType);
      if (prefillData.packageCount !== undefined) setPackageCount(prefillData.packageCount);
      if (prefillData.courierType !== undefined) setCourierType(prefillData.courierType);
      if (prefillData.urgency !== undefined) setUrgency(prefillData.urgency);
      if (prefillData.distanceKm !== undefined) setDistanceKm(prefillData.distanceKm);
      if (prefillData.note !== undefined) setNote(prefillData.note);
    }
  }, [prefillData, isOpen]);

  // Automatic Address & Distance Geocoding (Debounced server-side call)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const pickup = pickupAddress.trim();
    const delivery = deliveryAddress.trim();

    if (pickup.length < 3 || delivery.length < 3) {
      setAutoCalcError('');
      setIsAutoCalculated(false);
      setApproximateDistanceText('');
      return;
    }

    setIsCalculatingDistance(true);
    setAutoCalcError('');

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const result = await mapService.calculateDistance(pickup, delivery);
        if (result.success && result.isAutoCalculated && result.distanceKm > 0) {
          setDistanceKm(result.distanceKm);
          setPickupCoords(result.pickupCoords || null);
          setDeliveryCoords(result.deliveryCoords || null);
          setRoutePoints(result.routePoints || []);
          setApproximateDistanceText(
            result.approximateDistanceText || `Yaklaşık mesafe: ${result.distanceKm} km`
          );
          setIsAutoCalculated(true);
          setAutoCalcError('');
        } else {
          setIsAutoCalculated(false);
          setAutoCalcError('Mesafe otomatik hesaplanamadı. KM değerini manuel girebilirsiniz.');
        }
      } catch (err) {
        setIsAutoCalculated(false);
        setAutoCalcError('Mesafe otomatik hesaplanamadı. KM değerini manuel girebilirsiniz.');
      } finally {
        setIsCalculatingDistance(false);
      }
    }, 450);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [pickupAddress, deliveryAddress]);

  // Adjust urgency if courier type changes
  useEffect(() => {
    if (courierType === 'Acil Kurye' && urgency === 'Normal') {
      setUrgency('Acil');
    } else if (courierType === 'VIP Kurye') {
      setUrgency('Çok Acil');
    }
  }, [courierType]);

  const { basePrice, finalPrice, multiplier, isMinimumApplied } = calculateOrderPrice(
    distanceKm,
    courierType,
    pricing
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!pickupAddress.trim()) {
      setErrorMsg('Lütfen paketin alınacağı adresi giriniz.');
      return;
    }
    if (!deliveryAddress.trim()) {
      setErrorMsg('Lütfen paketin teslim edileceği adresi giriniz.');
      return;
    }
    if (distanceKm <= 0) {
      setErrorMsg('Lütfen geçerli bir mesafe (KM) belirtiniz.');
      return;
    }

    setIsSubmitting(true);

    try {
      const newOrder = storage.createOrder({
        customerId: currentUser.id,
        customerName: currentUser.name,
        customerPhone: currentUser.phone,
        courierId: null,
        pickupAddress: pickupAddress.trim(),
        deliveryAddress: deliveryAddress.trim(),
        packageType,
        packageCount,
        courierType,
        urgency,
        distanceKm,
        price: finalPrice,
        status: 'Kurye Bekleniyor',
        note: note.trim(),
        estimatedDeliveryMinutes: courierType === 'Acil Kurye' ? 35 : courierType === 'VIP Kurye' ? 25 : 60,
      });

      setSuccessOrder(newOrder);
      setIsSubmitting(false);
      onOrderCreated(newOrder);
    } catch (err: any) {
      setErrorMsg('Sipariş kaydedilirken bir hata oluştu.');
      setIsSubmitting(false);
    }
  };

  const handleQuickAddress = (from: string, to: string) => {
    setPickupAddress(from);
    setDeliveryAddress(to);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div 
        className="w-full max-w-lg bg-[#19191E] border border-[#303036] rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#303036] flex items-center justify-between bg-[#0B0B0D]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#D6A84F]/20 border border-[#D6A84F]/40 flex items-center justify-center">
              <Truck className="w-4 h-4 text-[#D6A84F]" />
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-white font-['Space_Grotesk']">
                Kurye Çağır
              </h2>
              <p className="text-[11px] text-[#999999]">
                Güvenli, hızlı ve şeffaf fiyatlı kurye siparişi
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#999999] hover:text-white hover:bg-[#222229] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {successOrder ? (
            <div className="text-center py-6 space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-[#D6A84F]/20 border-2 border-[#D6A84F] flex items-center justify-center mx-auto text-[#D6A84F]">
                <Check className="w-8 h-8" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-[#D6A84F] uppercase tracking-wider">
                  SİPARİŞ ONAYLANDI
                </span>
                <h3 className="text-xl font-extrabold text-white mt-1">
                  Kuryeniz Aranıyor!
                </h3>
                <p className="text-xs text-[#999999] mt-2 max-w-sm mx-auto">
                  Siparişiniz sisteme kaydedildi. En yakın kurye yönlendirildiğinde bildirim alacaksınız.
                </p>
              </div>

              <div className="bg-[#222229] border border-[#303036] rounded-2xl p-4 text-left space-y-2 text-xs">
                <div className="flex justify-between pb-2 border-b border-[#303036]">
                  <span className="text-[#999999]">Sipariş No:</span>
                  <span className="font-mono font-bold text-white">#{successOrder.id}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#303036]">
                  <span className="text-[#999999]">Kurye Türü:</span>
                  <span className="font-semibold text-[#D6A84F]">{successOrder.courierType}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-[#303036]">
                  <span className="text-[#999999]">Mesafe:</span>
                  <span className="font-semibold text-white">{successOrder.distanceKm} KM</span>
                </div>
                <div className="flex justify-between pt-1">
                  <span className="text-white font-bold">Toplam Tutar:</span>
                  <span className="text-base font-extrabold text-[#D6A84F] font-mono">
                    {successOrder.price} TL
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-[#D6A84F] hover:bg-[#c49740] text-[#0B0B0D] font-bold text-sm shadow-lg shadow-[#D6A84F]/20 transition-all cursor-pointer"
              >
                Siparişlerime Git
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {prefillData && (prefillData.pickupAddress || prefillData.deliveryAddress) && (
                <div className="p-3 rounded-xl bg-[#D6A84F]/10 border border-[#D6A84F]/30 text-[#D6A84F] text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">✨</span>
                    <span className="font-semibold">Trustline AI Tarafından Hazırlandı</span>
                  </div>
                  <span className="text-[10px] text-[#999999] bg-[#0B0B0D] px-2 py-0.5 rounded border border-[#303036]">
                    Otomatik Aktarıldı
                  </span>
                </div>
              )}

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Quick Istanbul Sample Addresses */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-[#999999]">
                  Hızlı Rota Seçenekleri (Örnek):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleQuickAddress('Levent Mah. Şişli / İstanbul', 'Maslak Mah. Sarıyer / İstanbul')}
                    className="text-[10px] bg-[#222229] hover:bg-[#303036] text-slate-300 px-2 py-1 rounded-md border border-[#303036] transition-colors"
                  >
                    Levent → Maslak (6 KM)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddress('Moda Mah. Kadıköy / İstanbul', 'Ataşehir Varyap Plaza / İstanbul')}
                    className="text-[10px] bg-[#222229] hover:bg-[#303036] text-slate-300 px-2 py-1 rounded-md border border-[#303036] transition-colors"
                  >
                    Kadıköy → Ataşehir (9 KM)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickAddress('Avcılar Merkez / İstanbul', 'Beşiktaş Çarşı / İstanbul')}
                    className="text-[10px] bg-[#222229] hover:bg-[#303036] text-slate-300 px-2 py-1 rounded-md border border-[#303036] transition-colors"
                  >
                    Avcılar → Beşiktaş (34 KM)
                  </button>
                </div>
              </div>

              {/* Addresses - Elegant Dark Theme */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-[#D6A84F] uppercase font-bold tracking-widest flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-[#D6A84F]" />
                      <span>Alım Adresi</span>
                    </label>
                    {isCalculatingDistance && (
                      <span className="text-[10px] text-[#D6A84F] flex items-center gap-1 animate-pulse">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Mesafe Hesaplanıyor...</span>
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Levent Mah. Büyükdere Cad. No:199, Şişli"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    className="w-full bg-[#222229] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#999999]/60 focus:outline-hidden transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-[#10B981] uppercase font-bold tracking-widest flex items-center gap-1.5 mb-1">
                    <Navigation className="w-3 h-3 text-[#10B981]" />
                    <span>Teslimat Adresi</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Örn: Maslak Mah. Ahi Evran Cad. No:4, Sarıyer"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    className="w-full bg-[#222229] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-[#999999]/60 focus:outline-hidden transition-colors"
                  />
                </div>
              </div>

              {/* Status Alert: Auto-Distance Result or Manual KM Warning */}
              {isAutoCalculated && approximateDistanceText && (
                <div className="p-2.5 rounded-xl bg-[#D6A84F]/10 border border-[#D6A84F]/40 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-[#D6A84F]">
                    <Sparkles className="w-4 h-4 text-[#D6A84F] shrink-0" />
                    <span className="font-bold">{approximateDistanceText}</span>
                  </div>
                  <span className="text-[10px] bg-[#0B0B0D] text-slate-300 px-2 py-0.5 rounded-md border border-[#303036]">
                    Otomatik Rota
                  </span>
                </div>
              )}

              {autoCalcError && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold text-amber-300">{autoCalcError}</p>
                    <p className="text-[10px] text-amber-200/80 mt-0.5">
                      Aşağıdaki 'Mesafe (KM)' alanından tahmini kilometreyi dilediğiniz gibi güncelleyebilirsiniz.
                    </p>
                  </div>
                </div>
              )}

              {/* Live Route Map Visualization */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[#999999] flex items-center gap-1">
                    <span>CANLI HARİTA & ROTA</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowMap(!showMap)}
                    className="text-[10px] text-[#D6A84F] hover:underline cursor-pointer"
                  >
                    {showMap ? 'Haritayı Gizle' : 'Haritayı Göster'}
                  </button>
                </div>

                {showMap && (
                  <RouteMap
                    pickupCoords={pickupCoords}
                    deliveryCoords={deliveryCoords}
                    routePoints={routePoints}
                    distanceKm={distanceKm}
                    approximateDistanceText={approximateDistanceText}
                    isAutoCalculated={isAutoCalculated}
                  />
                )}
              </div>

              {/* Package Type, Count & Manual Mesafe (KM) Grid */}
              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[10px] text-[#999999] uppercase block mb-1 font-semibold">
                    Paket Türü
                  </label>
                  <select
                    value={packageType}
                    onChange={(e) => setPackageType(e.target.value as PackageType)}
                    className="w-full bg-[#222229] border border-[#303036] focus:border-[#D6A84F] rounded-lg px-2 py-2 text-xs text-white focus:outline-hidden cursor-pointer"
                  >
                    <option value="Evrak">Evrak</option>
                    <option value="Küçük Paket">Küçük Paket</option>
                    <option value="Orta Paket">Orta Paket</option>
                    <option value="Büyük Paket">Büyük Paket</option>
                    <option value="Diğer">Diğer</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] text-[#999999] uppercase block mb-1 font-semibold">
                    Adet
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={packageCount}
                    onChange={(e) => setPackageCount(Math.max(1, Number(e.target.value) || 1))}
                    className="w-full bg-[#222229] border border-[#303036] focus:border-[#D6A84F] rounded-lg px-2.5 py-2 text-xs font-mono font-bold text-white focus:outline-hidden"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] text-[#999999] uppercase font-semibold">
                      Mesafe (KM)
                    </label>
                    <span className="text-[9px] text-[#D6A84F] font-bold">Manuel Giriş</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="150"
                      value={distanceKm}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        setDistanceKm(val);
                        setIsAutoCalculated(false);
                      }}
                      className="w-full bg-[#222229] border border-[#303036] focus:border-[#D6A84F] rounded-lg px-2.5 py-2 text-xs font-mono font-bold text-white focus:outline-hidden"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[#999999] font-mono">
                      KM
                    </span>
                  </div>
                </div>
              </div>

              {/* Courier Type Segmented Switcher (from Elegant Dark Design) */}
              <div>
                <label className="text-[10px] text-[#999999] uppercase block mb-1 font-semibold">
                  Kurye Hizmet Türü
                </label>
                <div className="flex gap-1.5 p-1 bg-[#0B0B0D] rounded-xl border border-[#303036]">
                  <button
                    type="button"
                    onClick={() => setCourierType('Standart Kurye')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer ${
                      courierType === 'Standart Kurye'
                        ? 'bg-[#D6A84F] text-[#0B0B0D] shadow-sm'
                        : 'text-[#999999] hover:text-white'
                    }`}
                  >
                    Standart
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourierType('Acil Kurye')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer ${
                      courierType === 'Acil Kurye'
                        ? 'bg-[#D6A84F] text-[#0B0B0D] shadow-sm'
                        : 'text-[#999999] hover:text-white'
                    }`}
                  >
                    Acil (1.30×)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCourierType('VIP Kurye')}
                    className={`flex-1 py-2 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer ${
                      courierType === 'VIP Kurye'
                        ? 'bg-[#D6A84F] text-[#0B0B0D] shadow-sm'
                        : 'text-[#999999] hover:text-white'
                    }`}
                  >
                    VIP (1.60×)
                  </button>
                </div>
              </div>

              {/* KULLANICIYA GÖSTER: MESAFE, HİZMET, TAHMİNİ ÜCRET */}
              <div className="bg-[#0B0B0D] border-2 border-[#D6A84F]/40 rounded-2xl p-4 shadow-2xl relative overflow-hidden">
                <div className="absolute -right-8 -bottom-8 w-28 h-28 bg-[#D6A84F]/10 rounded-full blur-2xl pointer-events-none" />
                <div className="grid grid-cols-3 gap-2 text-center divide-x divide-[#303036]">
                  <div className="px-2">
                    <span className="text-[10px] text-[#999999] font-bold uppercase tracking-wider block mb-1">
                      MESAFE
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-white font-mono tracking-tight block">
                      {distanceKm} KM
                    </span>
                    <span className="text-[9px] text-[#999999] block mt-0.5">
                      {isAutoCalculated ? 'Otomatik Hesap' : 'Manuel Giriş'}
                    </span>
                  </div>

                  <div className="px-2">
                    <span className="text-[10px] text-[#999999] font-bold uppercase tracking-wider block mb-1">
                      HİZMET
                    </span>
                    <span className="text-sm sm:text-base font-bold text-[#D6A84F] block mt-1">
                      {courierType}
                    </span>
                    <span className="text-[9px] text-[#999999] block mt-0.5">
                      {courierType === 'VIP Kurye' ? '1.60× VIP' : courierType === 'Acil Kurye' ? '1.30× Acil' : 'Normal'}
                    </span>
                  </div>

                  <div className="px-2">
                    <span className="text-[10px] text-[#999999] font-bold uppercase tracking-wider block mb-1">
                      TAHMİNİ ÜCRET
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-[#D6A84F] font-mono tracking-tight block">
                      ₺{finalPrice.toLocaleString('tr-TR')}
                    </span>
                    <span className="text-[9px] text-[#999999] block mt-0.5">
                      {isMinimumApplied ? 'Min. 250 TL Taban' : `${distanceKm} × 50 TL`}
                    </span>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-[#303036]/60 flex items-center justify-between text-[11px] text-[#999999]">
                  <span>Fiyat Detayı: {distanceKm} KM × 50 TL {multiplier > 1 ? `× ${multiplier} (${courierType})` : ''}</span>
                  {isMinimumApplied && (
                    <span className="text-[#D6A84F] font-medium">* 250 TL taban fiyat uygulandı</span>
                  )}
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="text-[10px] text-[#999999] uppercase block mb-1 font-semibold">
                  Kuryeye Not (Opsiyonel)
                </label>
                <textarea
                  rows={2}
                  placeholder="Örn: 4. kat, zile basmayınız, resepsiyona teslim ediniz vb."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full bg-[#222229] border border-[#303036] focus:border-[#D6A84F] rounded-lg px-3 py-2 text-xs text-white placeholder:text-[#999999]/60 focus:outline-hidden resize-none"
                />
              </div>

              {/* Submit Button - Elegant Dark */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#D6A84F] hover:bg-[#c49740] text-[#0B0B0D] font-bold py-3.5 rounded-2xl shadow-lg shadow-[#D6A84F]/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 uppercase tracking-wider text-xs"
              >
                <Truck className="w-4 h-4" />
                <span>SİPARİŞİ ONAYLA</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
