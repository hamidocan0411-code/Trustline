import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Loader2,
  MapPin,
  Navigation,
  Sparkles,
  Truck,
  X,
} from 'lucide-react';

import {
  CourierType,
  Order,
  PackageType,
  PricingConfig,
  UrgencyLevel,
  UserProfile,
} from '../types';

import {
  calculateOrderPrice,
  PackageSize,
} from '../utils/pricing';

import { storage } from '../services/storage';
import {
  GeoCoordinate,
  mapService,
} from '../services/mapService';

import { RouteMap } from './RouteMap';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  pricing: PricingConfig;
  prefillData?: Partial<Order>;
  onOrderCreated: (newOrder: Order) => void;
}

interface CustomerDraft {
  pickupAddress: string;
  deliveryAddress: string;
  packageType: PackageType;
  packageCount: number;
  packageSize: PackageSize;
  courierType: CourierType;
  urgency: UrgencyLevel;
  distanceKm: number;
  note: string;
}

export const NewOrderModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentUser,
  pricing,
  prefillData,
  onOrderCreated,
}) => {
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');

  const [packageType, setPackageType] =
    useState<PackageType>('Evrak');

  const [packageCount, setPackageCount] =
    useState<number>(1);

  const [packageSize, setPackageSize] =
    useState<PackageSize>('Küçük');

  const [courierType, setCourierType] =
    useState<CourierType>('Standart Kurye');

  const [urgency, setUrgency] =
    useState<UrgencyLevel>('Normal');

  const [distanceKm, setDistanceKm] =
    useState<number>(10);

  const [note, setNote] = useState('');

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [errorMsg, setErrorMsg] =
    useState('');

  const [successOrder, setSuccessOrder] =
    useState<Order | null>(null);

  const [pickupCoords, setPickupCoords] =
    useState<GeoCoordinate | null>(null);

  const [deliveryCoords, setDeliveryCoords] =
    useState<GeoCoordinate | null>(null);

  const [routePoints, setRoutePoints] =
    useState<[number, number][]>([]);

  const [approximateDistanceText, setApproximateDistanceText] =
    useState('');

  const [isAutoCalculated, setIsAutoCalculated] =
    useState(false);

  const [isCalculatingDistance, setIsCalculatingDistance] =
    useState(false);

  const [autoCalcError, setAutoCalcError] =
    useState('');

  const [showMap, setShowMap] =
    useState(true);

  const debounceTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const calculationRequestRef =
    useRef(0);

  // ============================================================
  // MÜŞTERİLERİN FORM SEÇİMLERİNİ AYRI AYRI TUT
  // ============================================================

  const customerDraftsRef =
    useRef<Record<string, CustomerDraft>>({});

  // ============================================================
  // MÜŞTERİ DEĞİŞTİĞİNDE O MÜŞTERİNİN FORMUNU GETİR
  // ============================================================

  useEffect(() => {
    const customerId = currentUser.id;

    const draft =
      customerDraftsRef.current[customerId];

    if (draft) {
      setPickupAddress(draft.pickupAddress);
      setDeliveryAddress(draft.deliveryAddress);
      setPackageType(draft.packageType);
      setPackageCount(draft.packageCount);
      setPackageSize(draft.packageSize);
      setCourierType(draft.courierType);
      setUrgency(draft.urgency);
      setDistanceKm(draft.distanceKm);
      setNote(draft.note);

      setSuccessOrder(null);
      setErrorMsg('');

      return;
    }

    // Yeni müşteriyse temiz form
    setPickupAddress('');
    setDeliveryAddress('');
    setPackageType('Evrak');
    setPackageCount(1);
    setPackageSize('Küçük');
    setCourierType('Standart Kurye');
    setUrgency('Normal');
    setDistanceKm(10);
    setNote('');

    setPickupCoords(null);
    setDeliveryCoords(null);
    setRoutePoints([]);
    setApproximateDistanceText('');
    setIsAutoCalculated(false);
    setAutoCalcError('');
    setSuccessOrder(null);
    setErrorMsg('');
  }, [currentUser.id]);

  // ============================================================
  // PREFILL / AI VERİSİ
  // ============================================================

  useEffect(() => {
    if (!prefillData) return;

    if (prefillData.pickupAddress !== undefined) {
      setPickupAddress(prefillData.pickupAddress);
    }

    if (prefillData.deliveryAddress !== undefined) {
      setDeliveryAddress(prefillData.deliveryAddress);
    }

    if (prefillData.packageType !== undefined) {
      setPackageType(prefillData.packageType);
    }

    if (prefillData.packageCount !== undefined) {
      setPackageCount(prefillData.packageCount);
    }

    if (prefillData.courierType !== undefined) {
      setCourierType(prefillData.courierType);
    }

    if (prefillData.urgency !== undefined) {
      setUrgency(prefillData.urgency);
    }

    if (prefillData.distanceKm !== undefined) {
      setDistanceKm(prefillData.distanceKm);
    }

    if (prefillData.note !== undefined) {
      setNote(prefillData.note);
    }
  }, [prefillData]);

  // ============================================================
  // AKTİF MÜŞTERİNİN SEÇİMLERİNİ KAYDET
  // ============================================================

  useEffect(() => {
    customerDraftsRef.current[currentUser.id] = {
      pickupAddress,
      deliveryAddress,
      packageType,
      packageCount,
      packageSize,
      courierType,
      urgency,
      distanceKm,
      note,
    };
  }, [
    currentUser.id,
    pickupAddress,
    deliveryAddress,
    packageType,
    packageCount,
    packageSize,
    courierType,
    urgency,
    distanceKm,
    note,
  ]);

  // ============================================================
  // OTOMATİK MESAFE HESAPLAMA
  // ============================================================

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    const pickup = pickupAddress.trim();
    const delivery = deliveryAddress.trim();

    const requestId =
      ++calculationRequestRef.current;

    if (
      pickup.length < 3 ||
      delivery.length < 3
    ) {
      setIsCalculatingDistance(false);
      setIsAutoCalculated(false);
      setApproximateDistanceText('');
      setAutoCalcError('');
      return;
    }

    setIsCalculatingDistance(true);
    setIsAutoCalculated(false);
    setAutoCalcError('');

    debounceTimerRef.current =
      setTimeout(async () => {
        try {
          const result =
            await mapService.calculateDistance(
              pickup,
              delivery
            );

          if (
            requestId !==
            calculationRequestRef.current
          ) {
            return;
          }

          if (
            result.success &&
            result.isAutoCalculated &&
            Number(result.distanceKm) > 0
          ) {
            const km =
              Number(result.distanceKm);

            setDistanceKm(km);

            setPickupCoords(
              result.pickupCoords || null
            );

            setDeliveryCoords(
              result.deliveryCoords || null
            );

            setRoutePoints(
              result.routePoints || []
            );

            setApproximateDistanceText(
              result.approximateDistanceText ||
                `Yaklaşık mesafe: ${km} km`
            );

            setIsAutoCalculated(true);
            setAutoCalcError('');
          } else {
            setIsAutoCalculated(false);

            setAutoCalcError(
              result.error ||
                'Mesafe otomatik hesaplanamadı.'
            );
          }
        } catch {
          if (
            requestId !==
            calculationRequestRef.current
          ) {
            return;
          }

          setIsAutoCalculated(false);

          setAutoCalcError(
            'Mesafe otomatik hesaplanamadı. Lütfen tekrar deneyin.'
          );
        } finally {
          if (
            requestId ===
            calculationRequestRef.current
          ) {
            setIsCalculatingDistance(false);
          }
        }
      }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(
          debounceTimerRef.current
        );
      }
    };
  }, [
    pickupAddress,
    deliveryAddress,
  ]);

  // ============================================================
  // KURYE TÜRÜNE GÖRE ACİLİYET
  // ============================================================

  useEffect(() => {
    if (
      courierType === 'Acil Kurye' &&
      urgency === 'Normal'
    ) {
      setUrgency('Acil');
    }

    if (
      courierType === 'VIP Kurye'
    ) {
      setUrgency('Çok Acil');
    }

    if (
      courierType === 'Standart Kurye' &&
      urgency !== 'Normal'
    ) {
      setUrgency('Normal');
    }
  }, [courierType]);

  // ============================================================
  // FİYAT
  // ============================================================

  const {
    finalPrice,
    multiplier,
    isMinimumApplied,
    packageSizeFee,
  } = calculateOrderPrice(
    distanceKm,
    courierType,
    pricing,
    packageSize
  );

  // ============================================================
  // SİPARİŞ OLUŞTUR
  // ============================================================

  const handleSubmit = (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setErrorMsg('');

    if (!pickupAddress.trim()) {
      setErrorMsg(
        'Lütfen paketin alınacağı adresi giriniz.'
      );
      return;
    }

    if (!deliveryAddress.trim()) {
      setErrorMsg(
        'Lütfen paketin teslim edileceği adresi giriniz.'
      );
      return;
    }

    if (distanceKm <= 0) {
      setErrorMsg(
        'Lütfen geçerli bir mesafe belirtiniz.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const newOrder =
        storage.createOrder({
          customerId: currentUser.id,
          customerName: currentUser.name,
          customerPhone: currentUser.phone,

          courierId: null,

          pickupAddress:
            pickupAddress.trim(),

          deliveryAddress:
            deliveryAddress.trim(),

          packageType,
          packageCount,

          courierType,
          urgency,

          distanceKm,
          price: finalPrice,

          status: 'Kurye Bekleniyor',

          note: note.trim(),

          estimatedDeliveryMinutes:
            courierType === 'Acil Kurye'
              ? 35
              : courierType === 'VIP Kurye'
              ? 25
              : 60,
        });

      setSuccessOrder(newOrder);
      setIsSubmitting(false);

      onOrderCreated(newOrder);
    } catch {
      setErrorMsg(
        'Sipariş kaydedilirken bir hata oluştu.'
      );

      setIsSubmitting(false);
    }
  };

  // ============================================================
  // HIZLI ROTA
  // ============================================================

  const handleQuickAddress = (
    from: string,
    to: string
  ) => {
    setPickupAddress(from);
    setDeliveryAddress(to);
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn overflow-y-auto">
      <div
        className="w-full max-w-lg bg-[#19191E] border border-[#303036] rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
        onClick={(e) =>
          e.stopPropagation()
        }
      >

        {/* HEADER */}

        <div className="p-4 sm:p-5 border-b border-[#303036] flex items-center justify-between bg-[#0B0B0D]">

          <div className="flex items-center gap-2.5">

            <div className="w-8 h-8 rounded-xl bg-[#D6A84F]/20 border border-[#D6A84F]/40 flex items-center justify-center">
              <Truck className="w-4 h-4 text-[#D6A84F]" />
            </div>

            <div>
              <h2 className="font-bold text-base sm:text-lg text-white">
                Kurye Çağır
              </h2>

              <p className="text-[11px] text-[#999999]">
                Güvenli, hızlı ve şeffaf fiyatlı kurye siparişi
              </p>
            </div>

          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#999999] hover:text-white hover:bg-[#222229]"
          >
            <X className="w-5 h-5" />
          </button>

        </div>

        {/* BODY */}

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">

          {successOrder ? (

            <div className="text-center py-6 space-y-4">

              <div className="w-16 h-16 rounded-full bg-[#D6A84F]/20 border-2 border-[#D6A84F] flex items-center justify-center mx-auto text-[#D6A84F]">
                <Check className="w-8 h-8" />
              </div>

              <div>

                <span className="text-xs font-mono font-bold text-[#D6A84F]">
                  SİPARİŞ ONAYLANDI
                </span>

                <h3 className="text-xl font-extrabold text-white mt-1">
                  Kuryeniz Aranıyor!
                </h3>

                <p className="text-xs text-[#999999] mt-2">
                  Siparişiniz sisteme kaydedildi.
                </p>

              </div>

              <div className="bg-[#222229] border border-[#303036] rounded-2xl p-4 text-left space-y-2 text-xs">

                <div className="flex justify-between">
                  <span className="text-[#999999]">
                    Sipariş No:
                  </span>

                  <span className="font-mono font-bold text-white">
                    #{successOrder.id}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#999999]">
                    Kurye Türü:
                  </span>

                  <span className="font-semibold text-[#D6A84F]">
                    {successOrder.courierType}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-[#999999]">
                    Mesafe:
                  </span>

                  <span className="font-semibold text-white">
                    {successOrder.distanceKm} KM
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-white font-bold">
                    Toplam:
                  </span>

                  <span className="text-base font-extrabold text-[#D6A84F]">
                    {successOrder.price} TL
                  </span>
                </div>

              </div>

              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-[#D6A84F] text-[#0B0B0D] font-bold"
              >
                Siparişlerime Git
              </button>

            </div>

          ) : (

            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >

              {/* AI */}

              {prefillData &&
                (prefillData.pickupAddress ||
                  prefillData.deliveryAddress) && (

                <div className="p-3 rounded-xl bg-[#D6A84F]/10 border border-[#D6A84F]/30 text-[#D6A84F] text-xs">
                  ✨ Trustline AI tarafından hazırlandı
                </div>

              )}

              {/* ERROR */}

              {errorMsg && (

                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex gap-2">

                  <AlertCircle className="w-4 h-4" />

                  {errorMsg}

                </div>

              )}

              {/* QUICK ROUTES */}

              <div className="space-y-1.5">

                <span className="text-[11px] font-semibold text-[#999999]">
                  Hızlı Rota:
                </span>

                <div className="flex flex-wrap gap-1.5">

                  <button
                    type="button"
                    onClick={() =>
                      handleQuickAddress(
                        'Levent Mah. Şişli / İstanbul',
                        'Maslak Mah. Sarıyer / İstanbul'
                      )
                    }
                    className="text-[10px] bg-[#222229] text-slate-300 px-2 py-1 rounded-md border border-[#303036]"
                  >
                    Levent → Maslak
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleQuickAddress(
                        'Moda Mah. Kadıköy / İstanbul',
                        'Ataşehir Varyap Plaza / İstanbul'
                      )
                    }
                    className="text-[10px] bg-[#222229] text-slate-300 px-2 py-1 rounded-md border border-[#303036]"
                  >
                    Kadıköy → Ataşehir
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleQuickAddress(
                        'Avcılar Merkez / İstanbul',
                        'Beşiktaş Çarşı / İstanbul'
                      )
                    }
                    className="text-[10px] bg-[#222229] text-slate-300 px-2 py-1 rounded-md border border-[#303036]"
                  >
                    Avcılar → Beşiktaş
                  </button>

                </div>

              </div>

              {/* ADDRESSES */}

              <div className="space-y-3">

                <div>

                  <div className="flex items-center justify-between mb-1">

                    <label className="text-[10px] text-[#D6A84F] uppercase font-bold flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      Alım Adresi
                    </label>

                    {isCalculatingDistance && (

                      <span className="text-[10px] text-[#D6A84F] flex items-center gap-1">

                        <Loader2 className="w-3 h-3 animate-spin" />

                        Hesaplanıyor...

                      </span>

                    )}

                  </div>

                  <input
                    type="text"
                    required
                    placeholder="Örn: Avcılar Merkez, İstanbul"
                    value={pickupAddress}
                    onChange={(e) =>
                      setPickupAddress(
                        e.target.value
                      )
                    }
                    className="w-full bg-[#222229] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden"
                  />

                </div>

                <div>

                  <label className="text-[10px] text-emerald-400 uppercase font-bold flex items-center gap-1.5 mb-1">

                    <Navigation className="w-3 h-3" />

                    Teslimat Adresi

                  </label>

                  <input
                    type="text"
                    required
                    placeholder="Örn: Beşiktaş Çarşı, İstanbul"
                    value={deliveryAddress}
                    onChange={(e) =>
                      setDeliveryAddress(
                        e.target.value
                      )
                    }
                    className="w-full bg-[#222229] border border-[#303036] focus:border-[#D6A84F] rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-hidden"
                  />

                </div>

              </div>

              {/* DISTANCE */}

              {isCalculatingDistance && (

                <div className="p-3 rounded-xl bg-[#D6A84F]/10 border border-[#D6A84F]/30 text-[#D6A84F] text-xs flex items-center gap-2">

                  <Loader2 className="w-4 h-4 animate-spin" />

                  Adresler için güncel mesafe hesaplanıyor...

                </div>

              )}

              {isAutoCalculated &&
                approximateDistanceText && (

                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">

                  <div className="flex items-center gap-2 text-emerald-400">

                    <Sparkles className="w-4 h-4" />

                    <span className="font-bold">
                      {approximateDistanceText}
                    </span>

                  </div>

                  <span className="text-[10px] text-emerald-400">
                    OTOMATİK
                  </span>

                </div>

              )}

              {autoCalcError && (

                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-2">

                  <AlertCircle className="w-4 h-4" />

                  <div>

                    <p className="font-semibold">
                      {autoCalcError}
                    </p>

                    <p className="text-[10px] mt-1">
                      KM alanından manuel değer girebilirsiniz.
                    </p>

                  </div>

                </div>

              )}

              {/* MAP */}

              <div>

                <div className="flex items-center justify-between mb-1.5">

                  <span className="text-[10px] uppercase font-bold text-[#999999]">
                    CANLI HARİTA & ROTA
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      setShowMap(!showMap)
                    }
                    className="text-[10px] text-[#D6A84F]"
                  >
                    {showMap
                      ? 'Haritayı Gizle'
                      : 'Haritayı Göster'}
                  </button>

                </div>

                {showMap && (

                  <RouteMap
                    pickupCoords={pickupCoords}
                    deliveryCoords={deliveryCoords}
                    routePoints={routePoints}
                    distanceKm={distanceKm}
                    approximateDistanceText={
                      approximateDistanceText
                    }
                    isAutoCalculated={
                      isAutoCalculated
                    }
                  />

                )}

              </div>

              {/* PACKAGE SIZE */}

              <div>

                <label className="text-[10px] text-[#999999] uppercase block mb-1 font-semibold">
                  Paket Ebatı
                </label>

                <div className="grid grid-cols-4 gap-1.5">

                  {(
                    [
                      ['Küçük', 0],
                      ['Orta', 50],
                      ['Büyük', 100],
                      ['Çok Büyük', 200],
                    ] as [PackageSize, number][]
                  ).map(([size, fee]) => (

                    <button
                      key={size}
                      type="button"
                      onClick={() =>
                        setPackageSize(size)
                      }
                      className={`py-2 px-1 rounded-lg border text-[10px] font-bold ${
                        packageSize === size
                          ? 'bg-[#D6A84F] text-[#0B0B0D] border-[#D6A84F]'
                          : 'bg-[#222229] text-[#999999] border-[#303036]'
                      }`}
                    >

                      <div>
                        {size}
                      </div>

                      <div className="text-[9px] mt-0.5">
                        {fee === 0
                          ? '+₺0'
                          : `+₺${fee}`}
                      </div>

                    </button>

                  ))}

                </div>

              </div>

              {/* PACKAGE + COUNT + KM */}

              <div className="grid grid-cols-3 gap-2.5">

                <div>

                  <label className="text-[10px] text-[#999999] uppercase block mb-1 font-semibold">
                    Paket Türü
                  </label>

                  <select
                    value={packageType}
                    onChange={(e) =>
                      setPackageType(
                        e.target.value as PackageType
                      )
                    }
                    className="w-full bg-[#222229] border border-[#303036] rounded-lg px-2 py-2 text-xs text-white"
                  >

                    <option value="Evrak">
                      Evrak
                    </option>

                    <option value="Küçük Paket">
                      Küçük Paket
                    </option>

                    <option value="Orta Paket">
                      Orta Paket
                    </option>

                    <option value="Büyük Paket">
                      Büyük Paket
                    </option>

                    <option value="Diğer">
                      Diğer
                    </option>

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
                    onChange={(e) =>
                      setPackageCount(
                        Math.max(
                          1,
                          Number(e.target.value) || 1
                        )
                      )
                    }
                    className="w-full bg-[#222229] border border-[#303036] rounded-lg px-2.5 py-2 text-xs font-bold text-white"
                  />

                </div>

                <div>

                  <label className="text-[10px] text-[#999999] uppercase block mb-1 font-semibold">
                    Mesafe KM
                  </label>

                  <input
                    type="number"
                    min="1"
                    max="150"
                    value={distanceKm}
                    onChange={(e) => {

                      const val =
                        Math.max(
                          1,
                          Number(e.target.value) || 1
                        );

                      setDistanceKm(val);
                      setIsAutoCalculated(false);

                    }}
                    className="w-full bg-[#222229] border border-[#303036] rounded-lg px-2.5 py-2 text-xs font-bold text-white"
                  />

                </div>

              </div>

              {/* COURIER TYPE */}

              <div>

                <label className="text-[10px] text-[#999999] uppercase block mb-1 font-semibold">
                  Kurye Hizmet Türü
                </label>

                <div className="flex gap-1.5 p-1 bg-[#0B0B0D] rounded-xl border border-[#303036]">

                  {[
                    'Standart Kurye',
                    'Acil Kurye',
                    'VIP Kurye',
                  ].map((type) => (

                    <button
                      key={type}
                      type="button"
                      onClick={() =>
                        setCourierType(
                          type as CourierType
                        )
                      }
                      className={`flex-1 py-2 text-[10px] font-bold rounded-lg ${
                        courierType === type
                          ? 'bg-[#D6A84F] text-[#0B0B0D]'
                          : 'text-[#999999]'
                      }`}
                    >

                      {type === 'Standart Kurye'
                        ? 'Standart'
                        : type === 'Acil Kurye'
                        ? 'Acil 1.30×'
                        : 'VIP 1.60×'}

                    </button>

                  ))}

                </div>

              </div>

              {/* PRICE */}

              <div className="bg-[#0B0B0D] border-2 border-[#D6A84F]/40 rounded-2xl p-4">

                <div className="grid grid-cols-3 gap-2 text-center divide-x divide-[#303036]">

                  <div>

                    <span className="text-[10px] text-[#999999] font-bold block">
                      MESAFE
                    </span>

                    <span className="text-2xl font-black text-white block">
                      {distanceKm} KM
                    </span>

                    <span className="text-[9px] text-[#999999]">
                      {isAutoCalculated
                        ? 'Otomatik'
                        : 'Manuel'}
                    </span>

                  </div>

                  <div>

                    <span className="text-[10px] text-[#999999] font-bold block">
                      HİZMET
                    </span>

                    <span className="text-sm font-bold text-[#D6A84F] block mt-1">
                      {courierType}
                    </span>

                  </div>

                  <div>

                    <span className="text-[10px] text-[#999999] font-bold block">
                      TAHMİNİ ÜCRET
                    </span>

                    <span className="text-2xl font-black text-[#D6A84F] block">
                      ₺{finalPrice.toLocaleString('tr-TR')}
                    </span>

                    <span className="text-[9px] text-[#999999]">
                      {isMinimumApplied
                        ? 'Min. 250 TL'
                        : `${distanceKm} × 50 TL`}
                    </span>

                  </div>

                </div>

                <div className="mt-3 pt-2 border-t border-[#303036] text-[10px] text-[#999999]">

                  {distanceKm} KM × 50 TL

                  {multiplier > 1
                    ? ` × ${multiplier}`
                    : ''}

                  {packageSizeFee > 0
                    ? ` + ${packageSizeFee} TL ebat`
                    : ''}

                </div>

              </div>

              {/* NOTE */}

              <div>

                <label className="text-[10px] text-[#999999] uppercase block mb-1 font-semibold">
                  Kuryeye Not
                </label>

                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) =>
                    setNote(e.target.value)
                  }
                  placeholder="Örn: 4. kat, resepsiyona teslim..."
                  className="w-full bg-[#222229] border border-[#303036] rounded-lg px-3 py-2 text-xs text-white resize-none"
                />

              </div>

              {/* SUBMIT */}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#D6A84F] text-[#0B0B0D] font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
              >

                <Truck className="w-4 h-4" />

                {isSubmitting
                  ? 'SİPARİŞ OLUŞTURULUYOR...'
                  : 'SİPARİŞİ ONAYLA'}

              </button>

            </form>

          )}

        </div>
      </div>
    </div>
  );
};