import React, {
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  AlertCircle,
  CheckCircle2,
  MapPin,
  Navigation,
  Phone,
  Radio,
  Truck,
  User,
} from 'lucide-react';

import type {
  CourierAvailability,
  CourierLocation,
  Order,
  OrderStatus,
  UserProfile,
} from '../types';

import { storage } from '../services/storage';

import { DeliveryProofModal } from './DeliveryProofModal';
import { DeliveryProofCard } from './DeliveryProofCard';

interface Props {
  currentCourier: UserProfile;
  orders: Order[];
}

export const CourierPanel: React.FC<Props> = ({
  currentCourier,
  orders,
}) => {
  const [activeTab, setActiveTab] =
    useState<'active' | 'history'>(
      'active'
    );

  const [
    courierStatus,
    setCourierStatus,
  ] = useState<CourierAvailability>(
    currentCourier.courierStatus ||
      'Müsait'
  );

  const [proofOrder, setProofOrder] =
    useState<Order | null>(null);

  const [
    expandedHistoryId,
    setExpandedHistoryId,
  ] = useState<string | null>(null);

  const [
    isSharingLocation,
    setIsSharingLocation,
  ] = useState(false);

  const [courierLoc, setCourierLoc] =
    useState<
      CourierLocation | undefined
    >();

  const [geoError, setGeoError] =
    useState<string | null>(null);

  const [
    isRequestingGeo,
    setIsRequestingGeo,
  ] = useState(false);

  const watchIdRef =
    useRef<number | null>(null);

  /* =====================================================
     KURYE DURUMUNU SENKRON TUT
  ===================================================== */

  useEffect(() => {
    const syncCourier = () => {
      const fresh =
        storage.getUserById(
          currentCourier.id
        );

      if (!fresh) return;

      setCourierStatus(
        fresh.courierStatus ||
          'Müsait'
      );
    };

    syncCourier();

    const unsubscribe =
      storage.subscribe(
        syncCourier
      );

    return () =>
      unsubscribe();
  }, [
    currentCourier.id,
  ]);

  /* =====================================================
     KONUMU SENKRON TUT
  ===================================================== */

  useEffect(() => {
    const syncLocation = () => {
      const location =
        storage.getCourierLocation(
          currentCourier.id
        );

      setCourierLoc(
        location
      );

      setIsSharingLocation(
        Boolean(
          location?.isSharing
        )
      );
    };

    syncLocation();

    const unsubscribe =
      storage.subscribe(
        syncLocation
      );

    return () =>
      unsubscribe();
  }, [
    currentCourier.id,
  ]);

  /* =====================================================
     GPS TEMİZLİK
  ===================================================== */

  useEffect(() => {
    return () => {
      if (
        watchIdRef.current !==
          null &&
        'geolocation' in navigator
      ) {
        navigator.geolocation.clearWatch(
          watchIdRef.current
        );

        watchIdRef.current =
          null;
      }
    };
  }, []);

  /* =====================================================
     SİPARİŞLER
  ===================================================== */

  const myOrders =
    orders.filter(
      (order) =>
        order.courierId ===
        currentCourier.id
    );

  const activeOrders =
    myOrders.filter(
      (order) =>
        order.status !==
          'Teslim Edildi' &&
        order.status !==
          'İptal Edildi'
    );

  const completedOrders =
    myOrders.filter(
      (order) =>
        order.status ===
        'Teslim Edildi'
    );

  const totalEarnings =
    completedOrders.reduce(
      (sum, order) =>
        sum +
        Math.round(
          order.price * 0.7
        ),
      0
    );

  /* =====================================================
     KURYE DURUMU
  ===================================================== */

  const handleStatusChange = (
    status: CourierAvailability
  ) => {
    const updated =
      storage.updateCourierStatus(
        currentCourier.id,
        status
      );

    if (updated) {
      setCourierStatus(
        updated.courierStatus ||
          status
      );
    }
  };

  /* =====================================================
     SİPARİŞ DURUMU
  ===================================================== */

  const handleUpdateOrderStatus =
    (
      orderId: string,
      nextStatus: OrderStatus
    ) => {
      if (
        nextStatus ===
        'Teslim Edildi'
      ) {
        const target =
          orders.find(
            (order) =>
              order.id ===
              orderId
          );

        if (target) {
          setProofOrder(
            target
          );
        }

        return;
      }

      const order =
        storage.getOrderById(
          orderId
        );

      if (!order) {
        return;
      }

      /*
       * Kurye yalnızca kendi atanmış
       * siparişinin durumunu değiştirebilir.
       */
      if (
        order.courierId !==
        currentCourier.id
      ) {
        return;
      }

      storage.updateOrderStatus(
        orderId,
        nextStatus
      );
    };

  /* =====================================================
     GPS KONUM PAYLAŞIMI
  ===================================================== */

  const stopLocationSharing =
    () => {
      if (
        watchIdRef.current !==
          null &&
        'geolocation' in navigator
      ) {
        navigator.geolocation.clearWatch(
          watchIdRef.current
        );

        watchIdRef.current =
          null;
      }

      const existing =
        storage.getCourierLocation(
          currentCourier.id
        );

      if (existing) {
        storage.updateCourierLocation(
          {
            ...existing,
            isSharing: false,
            updatedAt:
              new Date().toISOString(),
          }
        );
      } else {
        storage.updateCourierLocation(
          {
            courierId:
              currentCourier.id,
            latitude: 0,
            longitude: 0,
            updatedAt:
              new Date().toISOString(),
            isSharing: false,
          }
        );
      }

      setIsSharingLocation(
        false
      );

      setCourierLoc(
        (previous) =>
          previous
            ? {
                ...previous,
                isSharing: false,
              }
            : undefined
      );

      setGeoError(null);
    };

  const handleToggleLocationSharing =
    () => {
      if (
        isSharingLocation
      ) {
        stopLocationSharing();
        return;
      }

      if (
        !(
          'geolocation' in
          navigator
        )
      ) {
        setGeoError(
          'Cihazınız veya tarayıcınız GPS servisini desteklemiyor.'
        );

        return;
      }

      setIsRequestingGeo(
        true
      );

      setGeoError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setIsRequestingGeo(
            false
          );

          const {
            latitude,
            longitude,
          } = position.coords;

          const location:
            CourierLocation = {
            courierId:
              currentCourier.id,

            latitude,

            longitude,

            updatedAt:
              new Date().toISOString(),

            isSharing:
              true,
          };

          storage.updateCourierLocation(
            location
          );

          setCourierLoc(
            location
          );

          setIsSharingLocation(
            true
          );

          const watchId =
            navigator.geolocation.watchPosition(
              (watchPosition) => {
                const updatedLocation:
                  CourierLocation = {
                  courierId:
                    currentCourier.id,

                  latitude:
                    watchPosition
                      .coords
                      .latitude,

                  longitude:
                    watchPosition
                      .coords
                      .longitude,

                  updatedAt:
                    new Date().toISOString(),

                  isSharing:
                    true,
                };

                storage.updateCourierLocation(
                  updatedLocation
                );

                setCourierLoc(
                  updatedLocation
                );
              },
              (error) => {
                console.warn(
                  'GPS izleme hatası:',
                  error.message
                );
              },
              {
                enableHighAccuracy:
                  true,
                maximumAge:
                  10000,
                timeout:
                  25000,
              }
            );

          watchIdRef.current =
            watchId;
        },
        (error) => {
          setIsRequestingGeo(
            false
          );

          setIsSharingLocation(
            false
          );

          if (
            error.code ===
            error.PERMISSION_DENIED
          ) {
            setGeoError(
              'Konum erişim izni reddedildi.'
            );
          } else if (
            error.code ===
            error.TIMEOUT
          ) {
            setGeoError(
              'GPS sinyali zaman aşımına uğradı.'
            );
          } else {
            setGeoError(
              `Konum alınamadı: ${error.message}`
            );
          }
        },
        {
          enableHighAccuracy:
            true,
          timeout: 15000,
        }
      );
    };

  /* =====================================================
     SİPARİŞ AKIŞI
  ===================================================== */

  const getNextAction = (
    status: OrderStatus
  ) => {
    switch (status) {
      case 'Kurye Atandı':
        return {
          nextStatus:
            'Kurye Kabul Etti' as OrderStatus,
          label: 'Kabul Et',
          className:
            'bg-[#D6A84F] text-[#0B0B0D]',
        };

      case 'Kurye Kabul Etti':
        return {
          nextStatus:
            'Paket Alındı' as OrderStatus,
          label: 'Paket Alındı',
          className:
            'bg-purple-600 text-white',
        };

      case 'Paket Alındı':
        return {
          nextStatus:
            'Teslimatta' as OrderStatus,
          label: 'Teslimatta',
          className:
            'bg-blue-600 text-white',
        };

      case 'Teslimatta':
        return {
          nextStatus:
            'Teslim Edildi' as OrderStatus,
          label: 'Teslim Edildi',
          className:
            'bg-emerald-600 text-white',
        };

      default:
        return null;
    }
  };

  const orderFlowSteps:
    OrderStatus[] = [
      'Kurye Bekleniyor',
      'Kurye Atandı',
      'Kurye Kabul Etti',
      'Paket Alındı',
      'Teslimatta',
      'Teslim Edildi',
    ];

  /* =====================================================
     RENDER
  ===================================================== */

  return (
    <div className="space-y-5 pb-20">

      {/* =================================================
          KURYE BİLGİSİ
      ================================================= */}

      <div className="bg-[#19191E] border border-[#303036] rounded-3xl p-5 shadow-2xl">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

          <div className="flex items-center gap-3.5">

            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 overflow-hidden">

              {currentCourier.avatar ? (
                <img
                  src={
                    currentCourier.avatar
                  }
                  alt={
                    currentCourier.name
                  }
                  className="w-full h-full object-cover"
                />
              ) : (
                <Truck className="w-6 h-6" />
              )}

            </div>

            <div>
              <div className="flex items-center gap-2">

                <h2 className="text-base sm:text-lg font-bold text-white">
                  {
                    currentCourier.name
                  }
                </h2>

                <span className="text-[10px] font-mono bg-[#0B0B0D] px-2 py-0.5 rounded border border-[#303036] text-[#D6A84F]">
                  {
                    currentCourier.plate ||
                    'Plaka Yok'
                  }
                </span>

              </div>

              <p className="text-xs text-[#999999] mt-0.5">
                {
                  currentCourier.vehicle ||
                  'Araç bilgisi yok'
                }

                {' • '}

                Puan: ⭐{' '}

                {
                  currentCourier.rating?.toFixed(
                    1
                  ) ||
                  '0.0'
                }
              </p>
            </div>

          </div>

          {/* DURUM */}

          <div className="flex items-center gap-1.5 bg-[#0B0B0D] p-1.5 rounded-2xl border border-[#303036]">

            {(
              [
                'Müsait',
                'Meşgul',
                'Çevrimdışı',
              ] as CourierAvailability[]
            ).map(
              (status) => {
                const selected =
                  courierStatus ===
                  status;

                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() =>
                      handleStatusChange(
                        status
                      )
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                      selected
                        ? status ===
                          'Müsait'
                          ? 'bg-emerald-500 text-white'
                          : status ===
                            'Meşgul'
                          ? 'bg-amber-500 text-[#0B0B0D]'
                          : 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : 'text-[#999999] hover:text-white'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        status ===
                        'Müsait'
                          ? 'bg-emerald-300'
                          : status ===
                            'Meşgul'
                          ? 'bg-amber-300'
                          : 'bg-gray-400'
                      }`}
                    />

                    {status}
                  </button>
                );
              }
            )}

          </div>

        </div>

        {/* KPI */}

        <div className="grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-[#303036]">

          <div className="bg-[#222229] p-3 rounded-2xl border border-[#303036]/60 text-center">
            <span className="text-[10px] text-[#999999] block">
              Aktif Görev
            </span>

            <span className="text-lg font-bold text-white">
              {
                activeOrders.length
              }
            </span>
          </div>

          <div className="bg-[#222229] p-3 rounded-2xl border border-[#303036]/60 text-center">
            <span className="text-[10px] text-[#999999] block">
              Tamamlanan
            </span>

            <span className="text-lg font-bold text-emerald-400">
              {
                completedOrders.length
              }
            </span>
          </div>

          <div className="bg-[#222229] p-3 rounded-2xl border border-[#303036]/60 text-center">
            <span className="text-[10px] text-[#999999] block">
              Tahmini Hakediş
            </span>

            <span className="text-lg font-bold text-[#D6A84F]">
              {totalEarnings}{' '}
              TL
            </span>
          </div>

        </div>

      </div>

      {/* =================================================
          GPS
      ================================================= */}

      <div className="bg-[#19191E] border border-[#303036] rounded-3xl p-4 sm:p-5 shadow-xl">

        <div className="flex items-center justify-between gap-2 mb-3">

          <div className="flex items-center gap-2">

            <div
              className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                isSharingLocation
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-[#222229] text-[#999999]'
              }`}
            >
              <Radio className="w-4 h-4" />
            </div>

            <div>
              <h3 className="text-xs sm:text-sm font-bold text-white">
                Canlı GPS Konum
              </h3>

              <p className="text-[11px] text-[#999999]">
                {isSharingLocation
                  ? 'Konumunuz Firestore üzerinden paylaşılıyor.'
                  : 'Canlı takip için konum paylaşımını başlatın.'}
              </p>
            </div>

          </div>

          <span
            className={`text-[10px] px-2.5 py-1 rounded-full font-bold ${
              isSharingLocation
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'bg-[#222229] text-[#777777]'
            }`}
          >
            {isSharingLocation
              ? 'YAYINDA'
              : 'KAPALI'}
          </span>

        </div>

        <button
          type="button"
          onClick={
            handleToggleLocationSharing
          }
          disabled={
            isRequestingGeo
          }
          className={`w-full min-h-[52px] py-3.5 px-5 rounded-2xl font-black text-sm flex items-center justify-center gap-2.5 ${
            isSharingLocation
              ? 'bg-emerald-500/15 border-2 border-emerald-500 text-emerald-300'
              : 'bg-[#D6A84F] text-[#0B0B0D]'
          }`}
        >
          {isSharingLocation ? (
            <>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              Canlı Konum Paylaşılıyor
            </>
          ) : (
            <>
              <Navigation className="w-5 h-5" />

              {isRequestingGeo
                ? 'GPS İzni İsteniyor...'
                : 'Konumumu Paylaş'}
            </>
          )}
        </button>

        {courierLoc &&
          isSharingLocation && (
            <div className="mt-3 p-3 bg-[#0B0B0D] border border-[#303036] rounded-xl text-[11px] font-mono">
              📍{' '}
              {courierLoc.latitude.toFixed(
                5
              )}
              ,{' '}
              {courierLoc.longitude.toFixed(
                5
              )}
            </div>
          )}

        {geoError && (
          <div className="mt-3 p-3 bg-red-500/15 border border-red-500/30 rounded-xl flex gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {geoError}
          </div>
        )}

      </div>

      {/* =================================================
          TABS
      ================================================= */}

      <div className="flex gap-2 border-b border-[#303036] pb-2">

        <button
          type="button"
          onClick={() =>
            setActiveTab(
              'active'
            )
          }
          className={`px-4 py-2 text-xs font-bold rounded-xl ${
            activeTab === 'active'
              ? 'bg-[#D6A84F] text-[#0B0B0D]'
              : 'bg-[#19191E] text-[#999999]'
          }`}
        >
          Aktif Siparişler (
          {activeOrders.length}
          )
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveTab(
              'history'
            )
          }
          className={`px-4 py-2 text-xs font-bold rounded-xl ${
            activeTab === 'history'
              ? 'bg-[#D6A84F] text-[#0B0B0D]'
              : 'bg-[#19191E] text-[#999999]'
          }`}
        >
          Geçmiş Siparişler (
          {
            completedOrders.length
          }
          )
        </button>

      </div>

      {/* =================================================
          AKTİF SİPARİŞLER
      ================================================= */}

      {activeTab === 'active' && (
        <div className="space-y-4">

          {activeOrders.length ===
          0 ? (
            <div className="text-center py-16 bg-[#19191E] border border-[#303036] rounded-3xl p-6">

              <Truck className="w-12 h-12 text-[#999999]/30 mx-auto mb-3" />

              <h3 className="font-bold text-white text-base">
                Üzerinizde Aktif Sipariş Yok
              </h3>

              <p className="text-xs text-[#999999] mt-1">
                Yönetici size yeni
                bir sipariş
                atadığında burada
                görünecektir.
              </p>

            </div>
          ) : (
            activeOrders.map(
              (order) => {
                const action =
                  getNextAction(
                    order.status
                  );

                const currentStepIdx =
                  orderFlowSteps.indexOf(
                    order.status
                  );

                return (
                  <div
                    key={order.id}
                    className="bg-[#19191E] border-2 border-[#D6A84F]/50 rounded-3xl p-5 space-y-4"
                  >

                    <div className="flex items-center justify-between gap-3">

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-[#D6A84F]">
                          #{order.id}
                        </span>

                        <span className="text-xs font-bold text-white">
                          {
                            order.courierType
                          }
                        </span>
                      </div>

                      <span className="text-base font-extrabold text-[#D6A84F]">
                        {
                          order.price
                        }{' '}
                        TL
                      </span>

                    </div>

                    {/* PROGRESS */}

                    <div className="bg-[#0B0B0D] p-3 rounded-2xl border border-[#303036]">

                      <span className="text-[10px] text-[#999999] uppercase font-bold block mb-2">
                        Sipariş Aşaması
                      </span>

                      <div className="grid grid-cols-6 gap-1 text-center">

                        {orderFlowSteps.map(
                          (
                            step,
                            index
                          ) => {
                            const done =
                              currentStepIdx >=
                              index;

                            const current =
                              currentStepIdx ===
                              index;

                            return (
                              <div
                                key={step}
                                className="flex flex-col items-center min-w-0"
                              >
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                                    current
                                      ? 'bg-[#D6A84F] text-[#0B0B0D]'
                                      : done
                                      ? 'bg-emerald-500 text-white'
                                      : 'bg-[#19191E] text-[#999999]'
                                  }`}
                                >
                                  {done
                                    ? '✓'
                                    : index +
                                      1}
                                </div>

                                <span className="text-[8px] text-[#999999] truncate w-full mt-1">
                                  {step
                                    .replace(
                                      'Kurye ',
                                      ''
                                    )
                                    .replace(
                                      'Paket ',
                                      ''
                                    )}
                                </span>
                              </div>
                            );
                          }
                        )}

                      </div>
                    </div>

                    {/* MÜŞTERİ */}

                    <div className="bg-[#222229] border border-[#303036] rounded-2xl p-3.5 flex items-center justify-between gap-3">

                      <div className="flex items-center gap-2.5 min-w-0">

                        <div className="w-9 h-9 rounded-full bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <span className="text-[10px] text-[#999999] block">
                            Müşteri
                          </span>

                          <h4 className="text-xs font-bold text-white truncate">
                            {
                              order.customerName
                            }
                          </h4>
                        </div>

                      </div>

                      {order.customerPhone && (
                        <a
                          href={`tel:${order.customerPhone}`}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 text-xs font-bold shrink-0"
                        >
                          <Phone className="w-4 h-4" />
                          Ara
                        </a>
                      )}

                    </div>

                    {/* ADRESLER */}

                    <div className="space-y-3 bg-[#0B0B0D] border border-[#303036] p-4 rounded-2xl">

                      <div className="flex items-start gap-2.5">
                        <MapPin className="w-4 h-4 text-[#D6A84F] shrink-0" />

                        <div>
                          <span className="text-[10px] text-[#999999] font-bold uppercase block">
                            Alınacak Adres
                          </span>

                          <p className="text-xs text-white mt-0.5">
                            {
                              order.pickupAddress
                            }
                          </p>
                        </div>
                      </div>

                      <div className="border-l-2 border-dashed border-[#303036] ml-2 h-4" />

                      <div className="flex items-start gap-2.5">
                        <Navigation className="w-4 h-4 text-emerald-400 shrink-0" />

                        <div>
                          <span className="text-[10px] text-[#999999] font-bold uppercase block">
                            Teslim Adresi
                          </span>

                          <p className="text-xs text-white mt-0.5">
                            {
                              order.deliveryAddress
                            }
                          </p>
                        </div>
                      </div>

                    </div>

                    {/* DETAY */}

                    <div className="grid grid-cols-3 gap-2 text-xs text-[#999999]">

                      <div className="bg-[#222229] rounded-xl p-2.5">
                        <span className="block text-[9px] text-[#666666]">
                          Paket
                        </span>

                        <b className="text-white text-[10px]">
                          {
                            order.packageType
                          }
                        </b>
                      </div>

                      <div className="bg-[#222229] rounded-xl p-2.5">
                        <span className="block text-[9px] text-[#666666]">
                          Mesafe
                        </span>

                        <b className="text-white text-[10px]">
                          {
                            order.distanceKm
                          }{' '}
                          KM
                        </b>
                      </div>

                      <div className="bg-[#222229] rounded-xl p-2.5">
                        <span className="block text-[9px] text-[#666666]">
                          Fiyat
                        </span>

                        <b className="text-[#D6A84F] text-[10px]">
                          {
                            order.price
                          }{' '}
                          TL
                        </b>
                      </div>

                    </div>

                    {order.note && (
                      <div className="text-xs bg-[#222229] p-3 rounded-2xl border border-[#303036] text-amber-200">
                        <b className="text-white">
                          Müşteri Notu:
                        </b>{' '}
                        {order.note}
                      </div>
                    )}

                    {/* AKSİYON */}

                    {action && (
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateOrderStatus(
                            order.id,
                            action.nextStatus
                          )
                        }
                        className={`w-full min-h-[52px] py-4 px-6 rounded-2xl font-black text-base flex items-center justify-center gap-2.5 ${action.className}`}
                      >
                        <CheckCircle2 className="w-5 h-5" />
                        {
                          action.label
                        }
                      </button>
                    )}

                  </div>
                );
              }
            )
          )}

        </div>
      )}

      {/* =================================================
          GEÇMİŞ
      ================================================= */}

      {activeTab ===
        'history' && (
        <div className="space-y-3">

          {completedOrders.length ===
          0 ? (
            <div className="text-center py-16 bg-[#19191E] border border-[#303036] rounded-3xl p-6 text-[#999999]">
              Henüz tamamlanan
              teslimatınız
              bulunmamaktadır.
            </div>
          ) : (
            completedOrders.map(
              (order) => {
                const expanded =
                  expandedHistoryId ===
                  order.id;

                return (
                  <div
                    key={order.id}
                    className="bg-[#19191E] border border-[#303036] rounded-2xl p-4 space-y-3 text-xs"
                  >

                    <div className="flex items-center justify-between gap-3">

                      <div className="min-w-0">

                        <div className="flex items-center gap-2 mb-1">

                          <span className="font-mono font-bold text-white">
                            #{order.id}
                          </span>

                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">
                            Teslim Edildi
                          </span>

                        </div>

                        <p className="text-slate-300 truncate max-w-xs">
                          {
                            order.pickupAddress.split(
                              ','
                            )[0]
                          }

                          {' → '}

                          {
                            order.deliveryAddress.split(
                              ','
                            )[0]
                          }
                        </p>

                      </div>

                      <div className="text-right shrink-0">

                        <span className="text-sm font-extrabold text-[#D6A84F] block">
                          {
                            order.price
                          }{' '}
                          TL
                        </span>

                        <span className="text-[10px] text-emerald-400 block">
                          +
                          {Math.round(
                            order.price *
                              0.7
                          )}{' '}
                          TL
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedHistoryId(
                              expanded
                                ? null
                                : order.id
                            )
                          }
                          className="text-[11px] font-bold text-[#D6A84F] mt-1"
                        >
                          {expanded
                            ? 'Kanıtı Gizle'
                            : 'Kanıtı İncele'}
                        </button>

                      </div>

                    </div>

                    {expanded && (
                      <div className="pt-2 border-t border-[#303036]">
                        <DeliveryProofCard
                          order={
                            order
                          }
                        />
                      </div>
                    )}

                  </div>
                );
              }
            )
          )}

        </div>
      )}

      {/* =================================================
          TESLİMAT KANITI
      ================================================= */}

      {proofOrder && (
        <DeliveryProofModal
          order={proofOrder}
          isOpen={true}
          onClose={() =>
            setProofOrder(null)
          }
          onSuccess={() =>
            setProofOrder(null)
          }
        />
      )}

    </div>
  );
};

export default CourierPanel;