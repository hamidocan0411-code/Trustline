import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  ExternalLink,
  Flag,
  MapPin,
  Navigation,
  Phone,
  Radio,
  Star,
  TrendingUp,
  Truck,
  User,
  Wallet,
  Zap,
} from "lucide-react";

import type {
  CourierAvailability,
  CourierLocation,
  Order,
  OrderStatus,
  UserProfile,
} from "../types";

import { storage } from "../services/storage";
import {
  subscribeToCourierRatingSummary,
  type CourierRatingSummary,
} from "../services/courierRatings";

import { saveDeliveryProof } from "../services/deliveryProof";

import { DeliveryProofModal } from "./DeliveryProofModal";

import { DeliveryProofCard } from "./DeliveryProofCard";

interface Props {
  currentCourier: UserProfile;
  orders: Order[];
}

const FLOW: OrderStatus[] = [
  "Kurye Bekleniyor",
  "Kurye Atandı",
  "Kurye Kabul Etti",
  "Paket Alındı",
  "Teslimatta",
  "Teslim Edildi",
];

const getStatusLabel = (status: OrderStatus) => {
  switch (status) {
    case "Kurye Bekleniyor":
      return "Bekleniyor";
    case "Kurye Atandı":
      return "Atandı";
    case "Kurye Kabul Etti":
      return "Kabul";
    case "Paket Alındı":
      return "Paket Alındı";
    case "Teslimatta":
      return "Teslimatta";
    case "Teslim Edildi":
      return "Teslim Edildi";
    default:
      return status;
  }
};

/*
 * Aciliyet öncelik sırası (küçük = daha öncelikli).
 */
const URGENCY_PRIORITY: Record<string, number> = {
  "Çok Acil": 0,
  "Acil": 1,
  "Normal": 2,
};

/*
 * Aciliyete göre renk kodlu rozet stilleri.
 */
const getUrgencyStyle = (urgency: string) => {
  switch (urgency) {
    case "Çok Acil":
      return {
        text: "text-red-400",
        bg: "bg-red-500/10",
        border: "border-red-500/30",
      };
    case "Acil":
      return {
        text: "text-amber-400",
        bg: "bg-amber-500/10",
        border: "border-amber-500/30",
      };
    default:
      return {
        text: "text-sky-400",
        bg: "bg-sky-500/10",
        border: "border-sky-500/30",
      };
  }
};

/*
 * Google Haritalar'da yol tarifi açar.
 */
const openDirections = (address: string) => {
  if (!address) return;

  const url =
    "https://www.google.com/maps/dir/?api=1&destination=" +
    encodeURIComponent(address);

  window.open(url, "_blank", "noopener,noreferrer");
};

/*
 * Yeni görev bildirim sesi (Web Audio API).
 */
const playNotificationSound = () => {
  try {
    const AudioContext =
      window.AudioContext ||
      (
        window as unknown as {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContext) return;

    const ctx = new AudioContext();

    const playTone = (
      frequency: number,
      start: number,
      duration: number
    ) => {
      const osc =
        ctx.createOscillator();

      const gain =
        ctx.createGain();

      osc.type = "sine";
      osc.frequency.value =
        frequency;

      gain.gain.setValueAtTime(
        0.0001,
        ctx.currentTime + start
      );

      gain.gain.exponentialRampToValueAtTime(
        0.3,
        ctx.currentTime + start + 0.02
      );

      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + start + duration
      );

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(
        ctx.currentTime + start
      );

      osc.stop(
        ctx.currentTime + start + duration
      );
    };

    /* İki tonlu hoş bir "ding-dong" sesi */
    playTone(880, 0, 0.3);
    playTone(1174.66, 0.18, 0.35);

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1200);
  } catch (error) {
    console.warn(
      "Bildirim sesi çalınamadı:",
      error
    );
  }
};

/*
 * Cihazda titreşim (mobil).
 */
const vibrateDevice = () => {
  try {
    if ("vibrate" in navigator) {
      navigator.vibrate([
        200,
        100,
        200,
      ]);
    }
  } catch (error) {
    /* ignore */
  }
};

const formatTime = (value?: string) => {
  if (!value) return "--:--";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const CourierPanel: React.FC<Props> = ({
  currentCourier,
  orders,
}) => {
  const [activeTab, setActiveTab] =
    useState<"active" | "history">("active");

  const [mobileProfileOpen, setMobileProfileOpen] =
    useState(false);

  const normalizeCourierStatus = (
  status?: string
): CourierAvailability => {
  if (
    status === "Ã‡evrimdÄ±ÅŸÄ±" ||
    status === "ÇevrimdÄ±ÅŸÄ±"
  ) {
    return "Çevrimdışı";
  }

  if (
    status === "MÃ¼sait" ||
    status === "Müsait"
  ) {
    return "Müsait";
  }

  if (
    status === "MeÅŸgul" ||
    status === "Meşgul"
  ) {
    return "Meşgul";
  }

  return "Çevrimdışı";
};

const [courierStatus, setCourierStatus] =
    useState<CourierAvailability>(
      normalizeCourierStatus(
        currentCourier.courierStatus
      )
    );

  const [proofOrder, setProofOrder] =
    useState<Order | null>(null);

  const [expandedHistoryId, setExpandedHistoryId] =
    useState<string | null>(null);

  const [isSharingLocation, setIsSharingLocation] =
    useState(false);

  const [courierLoc, setCourierLoc] =
    useState<CourierLocation | undefined>();

  const [geoError, setGeoError] =
    useState<string | null>(null);

  const [isRequestingGeo, setIsRequestingGeo] =
    useState(false);

  const [updatingOrderId, setUpdatingOrderId] =
    useState<string | null>(null);

  const [copiedAddress, setCopiedAddress] =
    useState<string | null>(null);

  const [ratingSummary, setRatingSummary] =
    useState<CourierRatingSummary>({
      average: 0,
      count: 0,
      total: 0,
    });

  const watchIdRef =
    useRef<number | null>(null);

  const startingLocationRef =
    useRef(false);

  const prevUnseenCountRef =
    useRef<number | null>(null);

  /*
   * ==========================================
   * STOP LIVE GPS
   * ==========================================
   */

  const stopLiveLocation = async () => {
    if (
      watchIdRef.current !== null &&
      "geolocation" in navigator
    ) {
      navigator.geolocation.clearWatch(
        watchIdRef.current
      );

      watchIdRef.current = null;
    }

    try {
      await storage.setCourierOffline(
        currentCourier.id
      );
    } catch (error) {
      console.error(
        "Kurye çevrimdışı yapılamadı:",
        error
      );

      try {
        const existing =
          storage.getCourierLocation(
            currentCourier.id
          );

        if (existing) {
          await storage.updateCourierLocation({
            courierId:
              currentCourier.id,
            latitude:
              existing.latitude,
            longitude:
              existing.longitude,
            updatedAt:
              new Date().toISOString(),
            isSharing: false,
          });
        }
      } catch (locationError) {
        console.error(
          "GPS kapatılamadı:",
          locationError
        );
      }
    }

    setIsSharingLocation(false);

    setCourierLoc((previous) =>
      previous
        ? {
            ...previous,
            isSharing: false,
            updatedAt:
              new Date().toISOString(),
          }
        : previous
    );
  };

  /*
   * ==========================================
   * START LIVE GPS
   * ==========================================
   */

  const startLiveLocation = async () => {
    if (
      startingLocationRef.current ||
      String(courierStatus) === "Çevrimdışı"
    ) {
      return;
    }

    if (!("geolocation" in navigator)) {
      setGeoError(
        "Bu cihazda GPS desteği bulunmuyor."
      );

      try {
        await storage.updateCourierStatus(
          currentCourier.id,
          "Çevrimdışı"
        );

        setCourierStatus(
          "Çevrimdışı"
        );
      } catch {}

      return;
    }

    startingLocationRef.current = true;
    setIsRequestingGeo(true);
    setGeoError(null);

    try {
      const position =
        await new Promise<GeolocationPosition>(
          (resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              reject,
              {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 20000,
              }
            );
          }
        );

      const {
        latitude,
        longitude,
      } = position.coords;

      const now =
        new Date().toISOString();

      const updated =
        await storage.updateCourierLocation({
          courierId:
            currentCourier.id,
          latitude,
          longitude,
          updatedAt: now,
          isSharing: true,
        });

      setCourierLoc(updated);
      setIsSharingLocation(true);
      setGeoError(null);

      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(
          watchIdRef.current
        );
      }

      watchIdRef.current =
        navigator.geolocation.watchPosition(
          async (nextPosition) => {
            try {
              if (
                courierStatus ===
                "Çevrimdışı"
              ) {
                return;
              }

              const next =
                await storage.updateCourierLocation({
                  courierId:
                    currentCourier.id,
                  latitude:
                    nextPosition.coords
                      .latitude,
                  longitude:
                    nextPosition.coords
                      .longitude,
                  updatedAt:
                    new Date().toISOString(),
                  isSharing: true,
                });

              setCourierLoc(next);
              setIsSharingLocation(true);
            } catch (error) {
              console.error(
                "GPS konumu Firebase'e kaydedilemedi:",
                error
              );
            }
          },
          async (error) => {
            console.warn(
              "GPS izleme hatası:",
              error.message
            );

            if (watchIdRef.current !== null) {
              navigator.geolocation.clearWatch(
                watchIdRef.current
              );

              watchIdRef.current = null;
            }

            setIsSharingLocation(false);

            if (
              error.code ===
              GeolocationPositionError.PERMISSION_DENIED
            ) {
              setGeoError(
                "Canlı konum zorunludur. Tarayıcıdan konum iznini vermeniz gerekiyor."
              );
            } else if (
              error.code ===
              GeolocationPositionError.TIMEOUT
            ) {
              setGeoError(
                "GPS sinyali alınamadı. Lütfen konum servislerini kontrol edin."
              );
            } else {
              setGeoError(
                "Canlı GPS bağlantısı kesildi."
              );
            }

            try {
              await storage.setCourierOffline(
                currentCourier.id
              );

              setCourierStatus(
                "Çevrimdışı"
              );
            } catch (offlineError) {
              console.error(
                "GPS hatasında kurye çevrimdışı yapılamadı:",
                offlineError
              );

              try {
                await storage.updateCourierStatus(
                  currentCourier.id,
                  "Çevrimdışı"
                );

                setCourierStatus(
                  "Çevrimdışı"
                );
              } catch (statusError) {
                console.error(
                  "Kurye durumu güncellenemedi:",
                  statusError
                );
              }
            }

            try {
              await storage.updateCourierLocation({
                courierId:
                  currentCourier.id,
                latitude,
                longitude,
                updatedAt:
                  new Date().toISOString(),
                isSharing: false,
              });
            } catch (locationError) {
              console.error(
                "GPS kapatılamadı:",
                locationError
              );
            }

            setCourierLoc((previous) =>
              previous
                ? {
                    ...previous,
                    isSharing: false,
                    updatedAt:
                      new Date().toISOString(),
                  }
                : previous
            );
          },
          {
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 25000,
          }
        );
    } catch (error) {
      console.error(
        "GPS başlatılamadı:",
        error
      );

      setIsSharingLocation(false);

      if (
        error instanceof GeolocationPositionError &&
        error.code ===
          GeolocationPositionError.PERMISSION_DENIED
      ) {
        setGeoError(
          "Canlı konum zorunludur. Çalışmaya devam etmek için tarayıcıdan konum izni vermelisiniz."
        );
      } else if (
        error instanceof GeolocationPositionError &&
        error.code ===
          GeolocationPositionError.TIMEOUT
      ) {
        setGeoError(
          "GPS sinyali zaman aşımına uğradı. Konum servislerini kontrol edin."
        );
      } else {
        setGeoError(
          "Canlı konum başlatılamadı."
        );
      }

      try {
        await storage.updateCourierStatus(
          currentCourier.id,
          "Çevrimdışı"
        );

        setCourierStatus(
          "Çevrimdışı"
        );

        await storage.updateCourierLocation({
          courierId:
            currentCourier.id,
          latitude:
            courierLoc?.latitude ?? 0,
          longitude:
            courierLoc?.longitude ?? 0,
          updatedAt:
            new Date().toISOString(),
          isSharing: false,
        });
      } catch (offlineError) {
        console.error(
          "GPS hatasında kurye çevrimdışı yapılamadı:",
          offlineError
        );
      }
    } finally {
      setIsRequestingGeo(false);
      startingLocationRef.current = false;
    }
  };

  /*
   * ==========================================
   * LIVE COURIER RATING
   * ==========================================
   */

  useEffect(() => {
    const unsubscribe =
      subscribeToCourierRatingSummary(
        currentCourier.id,
        setRatingSummary
      );

    return () => {
      unsubscribe?.();
    };
  }, [currentCourier.id]);

  /*
   * ==========================================
   * LIVE FIREBASE DATA
   * ==========================================
   */

  useEffect(() => {
    const sync = () => {
      const user =
        storage.getUserById(
          currentCourier.id
        );

      if (user) {
        setCourierStatus(
          user.courierStatus ||
            "Müsait"
        );
      }

      const location =
        storage.getCourierLocation(
          currentCourier.id
        );

      setCourierLoc(location);

      setIsSharingLocation(
        Boolean(location?.isSharing)
      );
    };

    sync();

    const unsubscribe =
      storage.subscribe(sync);

    return () => {
      unsubscribe?.();

      if (
        watchIdRef.current !== null &&
        "geolocation" in navigator
      ) {
        navigator.geolocation.clearWatch(
          watchIdRef.current
        );

        watchIdRef.current = null;
      }
    };
  }, [currentCourier.id]);

  /*
   * ==========================================
   * AUTOMATIC GPS
   * ==========================================
   */

  useEffect(() => {
    if (
      courierStatus === "Çevrimdışı"
    ) {
      void stopLiveLocation();
      return;
    }

    if (
      courierStatus === "Müsait" ||
      courierStatus === "Meşgul"
    ) {
      if (!isSharingLocation) {
        void startLiveLocation();
      }
    }
  }, [
    courierStatus,
    currentCourier.id,
  ]);

  /*
   * ==========================================
   * ORDERS
   * ==========================================
   */

  const myOrders = orders.filter(
    (order) =>
      order.courierId ===
      currentCourier.id
  );

  const activeOrders =
    myOrders
      .filter(
        (order) =>
          order.status !==
            "Teslim Edildi" &&
          order.status !==
            "İptal Edildi"
      )
      .sort((a, b) => {
        const pa =
          URGENCY_PRIORITY[a.urgency] ??
          2;

        const pb =
          URGENCY_PRIORITY[b.urgency] ??
          2;

        if (pa !== pb) {
          return pa - pb;
        }

        return (
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
        );
      });

  const newAssignedOrders =
    activeOrders.filter(
      (order) =>
        order.status ===
          "Kurye Atandı" &&
        !order.courierSeenAt
    );

  const completedOrders =
    myOrders.filter(
      (order) =>
        order.status ===
        "Teslim Edildi"
    );

  const todayKey =
    new Date().toLocaleDateString(
      "tr-TR"
    );

  const todayCompletedOrders =
    completedOrders.filter(
      (order) => {
        if (!order.deliveredAt)
          return false;

        const date =
          new Date(
            order.deliveredAt
          );

        if (
          Number.isNaN(
            date.getTime()
          )
        ) {
          return false;
        }

        return (
          date.toLocaleDateString(
            "tr-TR"
          ) === todayKey
        );
      }
    );

  const todayEarnings =
    todayCompletedOrders.reduce(
      (sum, order) =>
        sum +
        Math.round(
          Number(
            order.price || 0
          ) * 0.7
        ),
      0
    );

  const totalEarnings =
    completedOrders.reduce(
      (sum, order) =>
        sum +
        Math.round(
          Number(
            order.price || 0
          ) * 0.7
        ),
      0
    );

  const rating =
    ratingSummary.average;

  const ratingCount =
    ratingSummary.count;

  const isLowRating =
    ratingCount > 0 &&
    rating < 3;

  const totalDeliveries =
    currentCourier.totalDeliveries ??
    completedOrders.length;

  /*
   * ==========================================
   * HAFTALIK KAZANÇ
   * ==========================================
   */

  const weeklyEarnings = (() => {
    const days: {
      label: string;
      amount: number;
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(
        date.getDate() - i
      );

      const key =
        date.toLocaleDateString(
          "tr-TR"
        );

      const amount =
        completedOrders
          .filter((order) => {
            if (!order.deliveredAt)
              return false;

            const d = new Date(
              order.deliveredAt
            );

            return (
              !Number.isNaN(
                d.getTime()
              ) &&
              d.toLocaleDateString(
                "tr-TR"
              ) === key
            );
          })
          .reduce(
            (sum, order) =>
              sum +
              Math.round(
                Number(
                  order.price || 0
                ) * 0.7
              ),
            0
          );

      days.push({
        label: date.toLocaleDateString(
          "tr-TR",
          { weekday: "short" }
        ),
        amount,
      });
    }

    return days;
  })();

  const weeklyMax =
    Math.max(
      ...weeklyEarnings.map(
        (day) => day.amount
      ),
      1
    );

  /*
   * ==========================================
   * YENİ GÖREV BİLDİRİMİ (SES + TİTREŞİM)
   * ==========================================
   */

  useEffect(() => {
    const count =
      newAssignedOrders.length;

    if (
      prevUnseenCountRef.current ===
      null
    ) {
      prevUnseenCountRef.current =
        count;
      return;
    }

    if (
      count >
      prevUnseenCountRef.current
    ) {
      playNotificationSound();
      vibrateDevice();
    }

    prevUnseenCountRef.current =
      count;
  }, [newAssignedOrders.length]);

  /*
   * ==========================================
   * COURIER STATUS
   * ==========================================
   */

  const handleCourierStatus = async (
    status: CourierAvailability
  ) => {
    if (
      status === "Çevrimdışı"
    ) {
      try {
        await storage.setCourierOffline(
          currentCourier.id
        );

        setCourierStatus(
          "Çevrimdışı"
        );

        if (
          watchIdRef.current !== null &&
          "geolocation" in navigator
        ) {
          navigator.geolocation.clearWatch(
            watchIdRef.current
          );

          watchIdRef.current = null;
        }

        setIsSharingLocation(
          false
        );

        setCourierLoc(
          (previous) =>
            previous
              ? {
                  ...previous,
                  isSharing:
                    false,
                  updatedAt:
                    new Date().toISOString(),
                }
              : previous
        );

        setGeoError(null);
      } catch (error) {
        console.error(
          "Kurye çevrimdışı yapılamadı:",
          error
        );

        setGeoError(
          "Çevrimdışı duruma geçilemedi."
        );
      }

      return;
    }

    try {
      await storage.updateCourierStatus(
        currentCourier.id,
        status
      );

      setCourierStatus(status);

      setTimeout(() => {
        void startLiveLocation();
      }, 100);
    } catch (error) {
      console.error(
        "Kurye durumu değiştirilemedi:",
        error
      );

      setGeoError(
        "Kurye durumu değiştirilemedi."
      );
    }
  };

  /*
   * ==========================================
   * ORDER STATUS
   * ==========================================
   */

  const updateOrderStatus = async (
    orderId: string,
    nextStatus: OrderStatus
  ) => {
    if (updatingOrderId)
      return;

    try {
      /*
       * TESLİM EDİLDİ:
       * Önce teslimat kanıtı modalını aç.
       * Burada GPS zorunlu değil.
       */
      if (
        nextStatus ===
        "Teslim Edildi"
      ) {
        const order =
          orders.find(
            (item) =>
              item.id === orderId
          );

        if (!order) {
          console.error(
            "Teslimat kanıtı için sipariş bulunamadı:",
            orderId
          );

          window.alert(
            "Sipariş bulunamadı. Lütfen sayfayı yenileyin."
          );

          return;
        }

        setProofOrder(order);

        return;
      }

      /*
       * Diğer durum değişikliklerinde
       * GPS zorunluluğu devam eder.
       */
      if (!isSharingLocation) {
        setGeoError(
          "Bu işlem için canlı GPS bağlantısı gereklidir."
        );

        return;
      }

      setUpdatingOrderId(
        orderId
      );

      await storage.updateOrderStatus(
        orderId,
        nextStatus
      );
    } catch (error) {
      console.error(
        "Sipariş durumu güncellenemedi:",
        error
      );

      window.alert(
        "Sipariş durumu güncellenemedi. Lütfen tekrar deneyin."
      );
    } finally {
      setUpdatingOrderId(null);
    }
  };

  /*
   * ==========================================
   * ACTION
   * ==========================================
   */

  const getAction = (
    status: OrderStatus
  ) => {
    switch (status) {
      case "Kurye Atandı":
        return {
          status:
            "Kurye Kabul Etti" as OrderStatus,
          label: "Siparişi Kabul Et",
          icon: CheckCircle2,
          className:
            "bg-[#D6A84F] text-[#0B0B0D]",
        };

      case "Kurye Kabul Etti":
        return {
          status:
            "Paket Alındı" as OrderStatus,
          label: "Paketi Aldım",
          icon: PackageIcon,
          className:
            "bg-purple-600 text-white",
        };

      case "Paket Alındı":
        return {
          status:
            "Teslimatta" as OrderStatus,
          label: "Teslimata Başla",
          icon: Navigation,
          className:
            "bg-blue-600 text-white",
        };

      case "Teslimatta":
        return {
          status:
            "Teslim Edildi" as OrderStatus,
          label: "Teslimatı Tamamla",
          icon: CheckCircle2,
          className:
            "bg-emerald-600 text-white",
        };

      default:
        return null;
    }
  };

  /*
   * ==========================================
   * DELIVERY PROOF
   * ==========================================
   */

  const handleCopyAddress = async (
    address: string
  ) => {
    if (!address) return;

    try {
      await navigator.clipboard.writeText(
        address
      );

      setCopiedAddress(address);

      window.setTimeout(() => {
        setCopiedAddress((current) =>
          current === address
            ? null
            : current
        );
      }, 1500);
    } catch (error) {
      console.error(
        "Adres kopyalanamadı:",
        error
      );
    }
  };

  const handleMarkSeen = async (
    orderId: string
  ) => {
    if (!orderId) return;

    try {
      await storage.updateOrder(
        orderId,
        {
          courierSeenAt:
            new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error(
        "Görev görüldü olarak işaretlenemedi:",
        error
      );
    }
  };

  const handleProofSubmit =
    async (data: {
      receiverName: string;
      deliveryNote: string;
      signature: string;
      photoFile?: File;
    }) => {
      if (!proofOrder) {
        return;
      }

      try {
        setUpdatingOrderId(
          proofOrder.id
        );

        /*
         * Önce teslimat kanıtını kaydet.
         */
        await saveDeliveryProof(
          proofOrder,
          {
            receiverName:
              data.receiverName.trim(),

            deliveryNote:
              data.deliveryNote.trim(),

            signature:
              data.signature || "",
          }
        );

        /*
         * Sonra siparişi Teslim Edildi yap.
         */
        await storage.updateOrderStatus(
          proofOrder.id,
          "Teslim Edildi"
        );

        console.log(
          "Teslimat başarıyla tamamlandı:",
          proofOrder.id
        );

        /*
         * Başarılı işlemden sonra modalı kapat.
         */
        setProofOrder(null);
      } catch (error) {
        console.error(
          "Teslimat tamamlanamadı:",
          error
        );

        window.alert(
          "Teslimat tamamlanamadı. Lütfen tekrar deneyin."
        );
      } finally {
        setUpdatingOrderId(null);
      }
    };

  /*
   * ==========================================
   * RENDER
   * ==========================================
   */

  return (
    <div className="relative mx-auto w-full max-w-[1480px] space-y-5 pb-8 text-white sm:space-y-6 lg:space-y-7">
      {/* NEW TASK ALERT */}
      {newAssignedOrders.length > 0 && (
        <section className="relative overflow-hidden rounded-[30px] border border-[#D6A84F]/40 bg-[radial-gradient(circle_at_100%_0%,rgba(214,168,79,0.22),transparent_42%),linear-gradient(135deg,#211b11,#151519_55%,#0d0d10)] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.35)] sm:p-5">
          <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#D6A84F]/15 blur-3xl" />
          <div className="relative flex items-center gap-3 sm:gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#D6A84F] text-[#0B0B0D] shadow-lg shadow-[#D6A84F]/20">
              <Bell size={21} className="animate-pulse" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#D6A84F]/15 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#D6A84F]">
                  Yeni görev
                </span>
                <span className="text-[10px] font-bold text-[#77777F]">Hemen işlem bekliyor</span>
              </div>
              <h3 className="mt-1 text-sm font-black text-white sm:text-base">
                {newAssignedOrders.length} yeni görev atandı
              </h3>
              <p className="mt-0.5 text-[10px] text-[#A7A7AF]">Görevi açıp teslimat akışını başlatın.</p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab("active")}
              className="shrink-0 rounded-xl bg-[#D6A84F] px-3.5 py-2.5 text-[10px] font-black text-[#0B0B0D] shadow-lg shadow-[#D6A84F]/10 transition hover:bg-[#E2B866] active:scale-95"
            >
              Görevlere Git
            </button>
          </div>
        </section>
      )}

      {/* COMMAND CENTER */}
      <section id="courier-command-center" className="relative overflow-hidden rounded-[32px] border border-white/[0.07] bg-[radial-gradient(circle_at_85%_15%,rgba(214,168,79,0.14),transparent_30%),radial-gradient(circle_at_0%_100%,rgba(16,185,129,0.06),transparent_30%),linear-gradient(145deg,#1b1813,#121216_58%,#0c0c0f)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.4)] sm:p-6 lg:p-7">
        <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-[#D6A84F]/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-48 rounded-full bg-emerald-500/5 blur-3xl" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3.5">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[19px] border border-[#D6A84F]/30 bg-[#D6A84F]/10 shadow-inner sm:h-16 sm:w-16">
                {currentCourier.avatar ? (
                  <img src={currentCourier.avatar} alt={currentCourier.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Truck size={28} className="text-[#D6A84F]" />
                  </div>
                )}
                <span
                  className={`absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-[#151519] ${
                    courierStatus === "Çevrimdışı"
                      ? "bg-red-400"
                      : isSharingLocation
                        ? "bg-emerald-400"
                        : "bg-amber-400"
                  }`}
                />
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#77777F]">TrustLine Express</span>
                  {isSharingLocation && (
                    <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[8px] font-black text-emerald-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> CANLI
                    </span>
                  )}
                </div>
                <h2 className="mt-1 truncate text-xl font-black tracking-tight text-white sm:text-2xl">
                  Merhaba, {currentCourier.name.split(" ")[0]}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                  <span className="font-mono font-bold text-[#D6A84F]">{currentCourier.plate || "PLAKA YOK"}</span>
                  <span className="text-[#44444B]">•</span>
                  <span className="text-[#8A8A93]">{currentCourier.vehicle || "Kurye"}</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileProfileOpen(false);
                  setActiveTab("active");
                  window.setTimeout(() => {
                    document.getElementById("active-orders")?.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }, 30);
                }}
                className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.08] bg-black/25 text-[#D6A84F] transition hover:border-[#D6A84F]/30 hover:bg-[#D6A84F]/10 active:scale-95 sm:h-14 sm:w-14"
                aria-label="Görevler"
              >
                <Truck size={20} />
                {newAssignedOrders.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.8)]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setMobileProfileOpen(true)}
                className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-[#D6A84F]/20 bg-black/25 text-[#D6A84F] transition hover:border-[#D6A84F]/40 hover:bg-[#D6A84F]/10 active:scale-95 sm:h-14 sm:w-14"
                aria-label="Profil aç"
              >
                {currentCourier.avatar ? (
                  <img
                    src={currentCourier.avatar}
                    alt={currentCourier.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User size={20} />
                )}
              </button>
            </div>
          </div>

          {/* STATUS SWITCH */}
          <div className="mt-6 rounded-2xl border border-white/[0.06] bg-black/20 p-2 lg:mt-7">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-[#6F6F78]">Çalışma durumu</span>
              <span
                className={`flex items-center gap-1.5 text-[9px] font-black ${
                  courierStatus === "Müsait" ? "text-emerald-400" : courierStatus === "Meşgul" ? "text-amber-400" : "text-red-400"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current" /> {courierStatus}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(["Müsait", "Meşgul", "Çevrimdışı"] as (CourierAvailability | "Çevrimdışı")[]).map((status) => {
                const selected = courierStatus === status;
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => void handleCourierStatus(status as CourierAvailability)}
                    className={`rounded-xl px-2 py-3 text-[10px] font-black transition active:scale-[0.98] ${
                      selected
                        ? status === "Müsait"
                          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/15"
                          : status === "Meşgul"
                            ? "bg-amber-500 text-[#0B0B0D] shadow-lg shadow-amber-500/15"
                            : "bg-red-500 text-white shadow-lg shadow-red-500/15"
                        : "text-[#74747D] hover:bg-white/[0.04]"
                    }`}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
          </div>

          {/* KPI STRIP */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:mt-5 lg:gap-3">
            {[
              { label: "Aktif görev", value: activeOrders.length, suffix: "", icon: Truck, tone: "text-[#D6A84F]" },
              { label: "Bugün", value: todayCompletedOrders.length, suffix: " teslim", icon: CheckCircle2, tone: "text-emerald-400" },
              { label: "Puan", value: Number(rating).toFixed(1), suffix: "/5", icon: Star, tone: "text-[#D6A84F]" },
              { label: "Bugünkü hakediş", value: todayEarnings, suffix: " TL", icon: Wallet, tone: "text-white" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.035] p-3.5">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[8px] font-black uppercase tracking-[0.12em] text-[#676770]">{item.label}</span>
                    <Icon size={13} className={item.tone} />
                  </div>
                  <div className={`text-lg font-black tracking-tight ${item.tone}`}>
                    {item.value}<span className="ml-1 text-[9px] font-bold text-[#676770]">{item.suffix}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {ratingCount > 0 && (
            <div
              className={`mt-3 rounded-2xl border p-3 ${
                isLowRating
                  ? "border-red-500/25 bg-red-500/10"
                  : "border-[#D6A84F]/10 bg-black/20"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                    isLowRating
                      ? "bg-red-500/10 text-red-400"
                      : "bg-[#D6A84F]/10 text-[#D6A84F]"
                  }`}
                >
                  {isLowRating ? (
                    <AlertCircle size={17} />
                  ) : (
                    <Star size={17} />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={`text-[9px] font-black uppercase tracking-wider ${
                        isLowRating
                          ? "text-red-300"
                          : "text-[#77777F]"
                      }`}
                    >
                      Canlı müşteri puanı
                    </span>

                    <span
                      className={`text-sm font-black ${
                        isLowRating
                          ? "text-red-300"
                          : "text-[#D6A84F]"
                      }`}
                    >
                      {rating.toFixed(2)} / 5
                    </span>
                  </div>

                  <p className="mt-1 text-[9px] text-[#6F6F78]">
                    {ratingCount} müşteri
                    değerlendirmesi
                  </p>

                  {isLowRating && (
                    <p className="mt-2 text-[10px] font-bold leading-4 text-red-300">
                      Düşük puan uyarısı: müşteri
                      değerlendirmelerinizin ortalaması
                      3.00 altında.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* NEXT OPERATION */}
      {activeOrders[0] && (
        <section id="next-operation" className="relative overflow-hidden rounded-[30px] border border-[#D6A84F]/25 bg-[linear-gradient(135deg,#241d12,#17171c_62%,#101013)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.28)] sm:p-6 lg:p-7">
          <div className="absolute right-0 top-0 h-36 w-36 rounded-full bg-[#D6A84F]/10 blur-3xl" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#D6A84F]/10 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-[#D6A84F]">Sıradaki operasyon</span>
                  <span className="font-mono text-[9px] font-bold text-[#65656D]">#{activeOrders[0].id}</span>
                </div>
                <h3 className="mt-2 text-lg font-black text-white">{getStatusLabel(activeOrders[0].status)}</h3>
                <p className="mt-1 max-w-[680px] truncate text-xs text-[#A1A1AA]">
                  {activeOrders[0].status === "Paket Alındı" || activeOrders[0].status === "Teslimatta" ? activeOrders[0].deliveryAddress : activeOrders[0].pickupAddress}
                </p>
              </div>
              <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-[#D6A84F] text-[#0B0B0D] shadow-lg shadow-[#D6A84F]/15 sm:flex">
                <Navigation size={21} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                <span className="block text-[8px] font-black uppercase tracking-wider text-[#62626A]">Sipariş</span>
                <b className="mt-1 block text-sm font-black text-[#D6A84F]">{activeOrders[0].price} TL</b>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                <span className="block text-[8px] font-black uppercase tracking-wider text-[#62626A]">Mesafe</span>
                <b className="mt-1 block text-sm font-black text-white">{activeOrders[0].distanceKm} KM</b>
              </div>
              <div className="hidden rounded-2xl border border-white/[0.06] bg-black/20 p-3 sm:block">
                <span className="block text-[8px] font-black uppercase tracking-wider text-[#62626A]">Tahmini hakediş</span>
                <b className="mt-1 block text-sm font-black text-emerald-400">{Math.round(Number(activeOrders[0].price || 0) * 0.7)} TL</b>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openDirections(activeOrders[0].status === "Paket Alındı" || activeOrders[0].status === "Teslimatta" ? activeOrders[0].deliveryAddress : activeOrders[0].pickupAddress)}
                className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl bg-[#D6A84F] px-4 text-xs font-black text-[#0B0B0D] shadow-lg shadow-[#D6A84F]/10 transition hover:bg-[#E2B866] active:scale-[0.98]"
              >
                <ExternalLink size={16} /> Yol Tarifi
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("active");
                  if (activeOrders[0]?.id) {
                    void handleMarkSeen(activeOrders[0].id);
                  }
                  window.setTimeout(() => {
                    document
                      .getElementById("active-orders")
                      ?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                  }, 50);
                }}
                className="flex min-h-[50px] items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-black/25 px-4 text-xs font-black text-white transition hover:border-[#D6A84F]/30 active:scale-[0.98]"
              >
                Görevi Aç <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </section>
      )}

      {/* GPS STATUS */}
      <section id="live-gps" className="overflow-hidden rounded-[30px] border border-white/[0.07] bg-[#17171C] shadow-[0_18px_60px_rgba(0,0,0,0.25)]">
        <div className="flex items-center justify-between border-b border-white/[0.06] p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isSharingLocation ? "bg-emerald-500/10 text-emerald-400" : "bg-white/[0.04] text-[#77777F]"}`}>
              <Radio size={19} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-black text-white">Canlı GPS</h3>
                {isSharingLocation && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[8px] font-black text-emerald-400">CANLI</span>}
              </div>
              <p className="mt-0.5 text-[9px] text-[#6F6F78]">
                {isSharingLocation ? "Konumunuz operasyon ekibiyle canlı paylaşılıyor." : courierStatus === "Çevrimdışı" ? "Çalışma dışındasınız." : "Konum bağlantısı hazırlanıyor..."}
              </p>
            </div>
          </div>
          <span className={`hidden rounded-full border px-2.5 py-1 text-[8px] font-black sm:block ${isSharingLocation ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : courierStatus === "Çevrimdışı" ? "border-red-500/20 bg-red-500/10 text-red-400" : "border-amber-500/20 bg-amber-500/10 text-amber-400"}`}>
            {isSharingLocation ? "BAĞLI" : courierStatus === "Çevrimdışı" ? "KAPALI" : "BEKLENİYOR"}
          </span>
        </div>
        <div className="p-4 sm:p-5">
          <div className={`flex min-h-[76px] items-center justify-center gap-3 rounded-2xl border ${isSharingLocation ? "border-emerald-500/20 bg-emerald-500/[0.06]" : courierStatus === "Çevrimdışı" ? "border-white/[0.06] bg-black/20" : "border-amber-500/20 bg-amber-500/[0.06]"}`}>
            <span className={`h-3 w-3 rounded-full ${isSharingLocation ? "animate-pulse bg-emerald-400" : courierStatus === "Çevrimdışı" ? "bg-red-400" : "animate-pulse bg-amber-400"}`} />
            <div className="text-center">
              <div className={`text-sm font-black ${isSharingLocation ? "text-emerald-300" : courierStatus === "Çevrimdışı" ? "text-red-300" : "text-amber-300"}`}>
                {isSharingLocation ? "Canlı Konum Aktif" : courierStatus === "Çevrimdışı" ? "GPS Kapalı" : "GPS Başlatılıyor"}
              </div>
              <div className="mt-0.5 text-[9px] text-[#73737C]">
                {isSharingLocation ? "Son konum Firebase'e aktarılıyor" : courierStatus === "Çevrimdışı" ? "Tekrar Müsait olduğunuzda otomatik başlar" : "Tarayıcı konum izni bekleniyor"}
              </div>
            </div>
          </div>

          {courierLoc && isSharingLocation && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                <span className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider text-[#62626A]"><MapPin size={11} /> Enlem</span>
                <b className="mt-1 block font-mono text-[10px] text-white">{courierLoc.latitude.toFixed(5)}</b>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3">
                <span className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-wider text-[#62626A]"><MapPin size={11} /> Boylam</span>
                <b className="mt-1 block font-mono text-[10px] text-white">{courierLoc.longitude.toFixed(5)}</b>
              </div>
            </div>
          )}

          {isRequestingGeo && <div className="mt-3 rounded-2xl border border-[#D6A84F]/20 bg-[#D6A84F]/[0.05] p-3 text-center text-[10px] font-bold text-[#D6A84F]">Tarayıcı konum izni bekleniyor...</div>}
          {geoError && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-3 text-[10px] leading-5 text-red-300">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              <span>{geoError}</span>
            </div>
          )}
        </div>
      </section>

      {/* EARNINGS */}
      <section id="earnings" className="rounded-[30px] border border-[#D6A84F]/15 bg-[linear-gradient(135deg,#211e18,#16161a)] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#D6A84F]/10 text-[#D6A84F]"><Wallet size={19} /></div>
            <div>
              <span className="block text-[8px] font-black uppercase tracking-[0.16em] text-[#696971]">Toplam hakediş</span>
              <b className="mt-0.5 block text-2xl font-black tracking-tight text-white">{totalEarnings} TL</b>
            </div>
          </div>
          <div className="hidden text-right sm:block">
            <span className="block text-[8px] font-black uppercase tracking-wider text-[#696971]">Toplam teslimat</span>
            <b className="mt-0.5 block text-lg font-black text-[#D6A84F]">{totalDeliveries}</b>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3.5">
            <span className="block text-[8px] uppercase tracking-wider text-[#696971]">Bugün</span>
            <b className="mt-1 flex items-center gap-1 text-base font-black text-emerald-400"><TrendingUp size={14} /> {todayEarnings} TL</b>
          </div>
          <div className="rounded-2xl border border-white/[0.06] bg-black/20 p-3.5">
            <span className="block text-[8px] uppercase tracking-wider text-[#696971]">Teslimat başı</span>
            <b className="mt-1 block text-base font-black text-white">{completedOrders.length ? Math.round(totalEarnings / completedOrders.length) : 0} TL</b>
          </div>
        </div>
      </section>

      {/* WEEKLY PERFORMANCE */}
      <section id="weekly-performance" className="rounded-[30px] border border-white/[0.07] bg-[#17171C] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-6 lg:p-7">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#D6A84F]/10 text-[#D6A84F]"><BarChart3 size={18} /></div>
            <div>
              <h3 className="text-sm font-black text-white">Haftalık performans</h3>
              <p className="text-[9px] text-[#676770]">Son 7 gün</p>
            </div>
          </div>
          <span className="text-sm font-black text-[#D6A84F]">{weeklyEarnings.reduce((sum, day) => sum + day.amount, 0)} TL</span>
        </div>
        <div className="mt-5 flex h-32 items-end justify-between gap-1.5">
          {weeklyEarnings.map((day, idx) => {
            const height = weeklyMax > 0 ? Math.max(5, Math.round((day.amount / weeklyMax) * 100)) : 5;
            const isToday = idx === weeklyEarnings.length - 1;
            return (
              <div key={idx} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
                <span className="min-h-3 text-[8px] font-bold text-[#686871]">{day.amount > 0 ? day.amount : ""}</span>
                <div className="flex h-24 w-full items-end rounded-lg bg-white/[0.025]">
                  <div className={`w-full rounded-lg transition-all ${isToday ? "bg-[#D6A84F] shadow-lg shadow-[#D6A84F]/10" : day.amount > 0 ? "bg-[#D6A84F]/45" : "bg-[#222229]"}`} style={{ height: `${height}%` }} />
                </div>
                <span className={`text-[9px] ${isToday ? "font-black text-[#D6A84F]" : "text-[#55555C]"}`}>{day.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* QUICK COMMAND RAIL */}
      <section className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#111115] p-3 shadow-[0_18px_55px_rgba(0,0,0,0.24)] sm:p-4 lg:p-5">
        <div className="mb-3 flex items-center justify-between px-1">
          <div>
            <span className="text-[8px] font-black uppercase tracking-[0.18em] text-[#62626A]">Hızlı komutlar</span>
            <h3 className="mt-0.5 text-xs font-black text-white">Operasyon merkezine tek dokunuş</h3>
          </div>
          <Zap size={15} className="text-[#D6A84F]" />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <button type="button" onClick={() => document.getElementById("next-operation")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-2xl border border-[#D6A84F]/15 bg-[#D6A84F]/[0.06] px-2 py-3 text-center transition hover:bg-[#D6A84F]/10 active:scale-95">
            <Navigation size={16} className="mx-auto text-[#D6A84F]" />
            <span className="mt-1.5 block text-[8px] font-black text-white">Operasyon</span>
          </button>
          <button type="button" onClick={() => document.getElementById("live-gps")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-2 py-3 text-center transition hover:bg-white/[0.05] active:scale-95">
            <Radio size={16} className={isSharingLocation ? "mx-auto text-emerald-400" : "mx-auto text-[#77777F]"} />
            <span className="mt-1.5 block text-[8px] font-black text-white">GPS</span>
          </button>
          <button type="button" onClick={() => document.getElementById("earnings")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-2 py-3 text-center transition hover:bg-white/[0.05] active:scale-95">
            <Wallet size={16} className="mx-auto text-[#D6A84F]" />
            <span className="mt-1.5 block text-[8px] font-black text-white">Kazanç</span>
          </button>
          <button type="button" onClick={() => setActiveTab("active")} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-2 py-3 text-center transition hover:bg-white/[0.05] active:scale-95">
            <Truck size={16} className="mx-auto text-[#D6A84F]" />
            <span className="mt-1.5 block text-[8px] font-black text-white">Görevler</span>
          </button>
          <button type="button" onClick={() => setActiveTab("history")} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-2 py-3 text-center transition hover:bg-white/[0.05] active:scale-95">
            <Clock3 size={16} className="mx-auto text-[#77777F]" />
            <span className="mt-1.5 block text-[8px] font-black text-white">Geçmiş</span>
          </button>
          <button type="button" onClick={() => document.getElementById("courier-command-center")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] px-2 py-3 text-center transition hover:bg-white/[0.05] active:scale-95">
            <User size={16} className="mx-auto text-[#77777F]" />
            <span className="mt-1.5 block text-[8px] font-black text-white">Profil</span>
          </button>
        </div>
      </section>

      {/* TASK NAVIGATION */}
      <div className="sticky top-3 z-20 rounded-2xl border border-white/[0.07] bg-[#0B0B0D]/90 p-1.5 shadow-2xl backdrop-blur-xl lg:top-5">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab("active")}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${activeTab === "active" ? "bg-[#D6A84F] text-[#0B0B0D] shadow-lg shadow-[#D6A84F]/10" : "text-[#74747D] hover:bg-white/[0.04]"}`}
          >
            <Truck size={15} /> Aktif Görevler <span className="opacity-60">{activeOrders.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-black transition ${activeTab === "history" ? "bg-[#D6A84F] text-[#0B0B0D] shadow-lg shadow-[#D6A84F]/10" : "text-[#74747D] hover:bg-white/[0.04]"}`}
          >
            <Clock3 size={15} /> Geçmiş <span className="opacity-60">{completedOrders.length}</span>
          </button>
        </div>
      </div>

      {/* ACTIVE ORDERS */}
      {activeTab === "active" && (
        <div id="active-orders" className="scroll-mt-24 lg:grid lg:grid-cols-2 lg:items-start lg:gap-5">
          {activeOrders.length === 0 ? (
            <div className="rounded-[30px] border border-white/[0.07] bg-[#17171C] p-12 text-center shadow-xl">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.035] text-[#55555C]"><Truck size={29} /></div>
              <h3 className="mt-4 text-base font-black text-white">Aktif görev yok</h3>
              <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-[#686871]">Yeni bir sipariş atandığında burada anında görünecek.</p>
              <div className="mx-auto mt-4 flex w-fit items-center gap-1.5 rounded-full border border-white/[0.06] bg-black/20 px-3 py-1.5 text-[9px] font-bold text-[#686871]"><Clock3 size={11} /> Görev bekleniyor</div>
            </div>
          ) : (
            activeOrders.map((order) => {
              const action = getAction(order.status);
              const currentIndex = FLOW.indexOf(order.status);
              const isUpdating = updatingOrderId === order.id;
              const ActionIcon = action?.icon;
              const urgencyStyle = getUrgencyStyle(order.urgency);
              const isNew = order.status === "Kurye Atandı" && !order.courierSeenAt;
              const destination = order.status === "Paket Alındı" || order.status === "Teslimatta" ? order.deliveryAddress : order.pickupAddress;

              return (
                <article key={order.id} className={`relative min-w-0 overflow-hidden rounded-[30px] border bg-[#17171C] shadow-[0_20px_70px_rgba(0,0,0,0.28)] ${isNew ? "border-[#D6A84F]/70 ring-1 ring-[#D6A84F]/20" : "border-white/[0.07]"}`}>
                  <div className={`h-1 w-full ${order.urgency === "Çok Acil" ? "bg-red-500" : order.urgency === "Acil" ? "bg-amber-500" : "bg-sky-500"}`} />

                  {/* ORDER HEADER */}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-black text-[#D6A84F]">#{order.id}</span>
                          {isNew && <span className="flex items-center gap-1 rounded-full bg-[#D6A84F] px-2 py-1 text-[8px] font-black text-[#0B0B0D]"><Bell size={9} /> YENİ</span>}
                          <span className="rounded-full border border-white/[0.07] bg-black/20 px-2 py-1 text-[8px] font-bold text-[#8A8A93]">{order.courierType}</span>
                          <span className={`flex items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-black ${urgencyStyle.border} ${urgencyStyle.bg} ${urgencyStyle.text}`}><Flag size={9} /> {order.urgency}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-[9px] text-[#62626A]"><Clock3 size={11} /> Oluşturulma {formatTime(order.createdAt)}</div>
                        {isNew && (
                          <button type="button" onClick={() => void handleMarkSeen(order.id)} className="mt-2 rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[8px] font-black text-[#999999] transition hover:text-white"><CheckCircle2 size={10} className="mr-1 inline" /> Gördüm</button>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="block text-[8px] font-black uppercase tracking-wider text-[#62626A]">Sipariş</span>
                        <b className="mt-0.5 block text-xl font-black text-[#D6A84F]">{order.price} TL</b>
                        <span className="block text-[8px] font-bold text-emerald-400/80">Hakediş {Math.round(Number(order.price || 0) * 0.7)} TL</span>
                      </div>
                    </div>
                  </div>

                  {/* STATUS TIMELINE */}
                  <div className="border-y border-white/[0.06] bg-black/15 px-4 py-4 sm:px-5">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[8px] font-black uppercase tracking-[0.15em] text-[#62626A]">Teslimat akışı</span>
                      <span className="text-[9px] font-black text-[#D6A84F]">{getStatusLabel(order.status)}</span>
                    </div>
                    <div className="grid grid-cols-6 gap-1">
                      {FLOW.map((step, index) => {
                        const done = currentIndex >= index;
                        const current = currentIndex === index;
                        return (
                          <div key={step} className="min-w-0 text-center">
                            <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[9px] font-black ${current ? "bg-[#D6A84F] text-[#0B0B0D] shadow-lg shadow-[#D6A84F]/20" : done ? "bg-emerald-500 text-white" : "border border-white/[0.08] bg-[#19191E] text-[#55555C]"}`}>
                              {done ? "✓" : index + 1}
                            </div>
                            <span className={`mt-1 block truncate text-[7px] ${current ? "font-black text-[#D6A84F]" : done ? "text-emerald-400/70" : "text-[#55555C]"}`}>{step.replace("Kurye ", "").replace("Paket ", "")}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* CUSTOMER */}
                  <div className="p-4 pb-0 sm:p-5 sm:pb-0">
                    <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3.5">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-400"><User size={17} /></div>
                        <div className="min-w-0">
                          <span className="block text-[8px] font-black uppercase tracking-wider text-[#62626A]">Müşteri</span>
                          <h4 className="truncate text-xs font-black text-white">{order.customerName}</h4>
                        </div>
                      </div>
                      {order.customerPhone && (
                        <a href={`tel:${order.customerPhone}`} className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-500/10 px-3 text-[10px] font-black text-emerald-400 transition hover:bg-emerald-500/15 active:scale-95"><Phone size={15} /> Ara</a>
                      )}
                    </div>
                  </div>

                  {/* ROUTE */}
                  <div className="p-4 sm:p-5">
                    <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-black/20">
                      <div className="flex items-start gap-3 p-4">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D6A84F]/10 text-[#D6A84F]"><MapPin size={16} /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[8px] font-black uppercase tracking-[0.14em] text-[#77777F]">01 • Paketi Al</span>
                            {destination === order.pickupAddress && <span className="rounded-full bg-[#D6A84F]/10 px-2 py-1 text-[7px] font-black text-[#D6A84F]">SIRADAKİ</span>}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-white">{order.pickupAddress}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button type="button" onClick={() => openDirections(order.pickupAddress)} className="rounded-lg bg-sky-500/10 px-2.5 py-1.5 text-[8px] font-black text-sky-400"><ExternalLink size={10} className="mr-1 inline" /> Yol Tarifi</button>
                            <button type="button" onClick={() => void handleCopyAddress(order.pickupAddress)} className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[8px] font-black text-[#888891]">{copiedAddress === order.pickupAddress ? "✓ Kopyalandı" : "Kopyala"}</button>
                          </div>
                        </div>
                      </div>
                      <div className="mx-4 border-l border-dashed border-white/[0.1] pl-7" />
                      <div className="flex items-start gap-3 p-4">
                        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><Navigation size={16} /></div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[8px] font-black uppercase tracking-[0.14em] text-[#77777F]">02 • Teslim Et</span>
                            {destination === order.deliveryAddress && <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[7px] font-black text-emerald-400">SIRADAKİ</span>}
                          </div>
                          <p className="mt-1 text-xs leading-5 text-white">{order.deliveryAddress}</p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <button type="button" onClick={() => openDirections(order.deliveryAddress)} className="rounded-lg bg-sky-500/10 px-2.5 py-1.5 text-[8px] font-black text-sky-400"><ExternalLink size={10} className="mr-1 inline" /> Yol Tarifi</button>
                            <button type="button" onClick={() => void handleCopyAddress(order.deliveryAddress)} className="rounded-lg bg-white/[0.04] px-2.5 py-1.5 text-[8px] font-black text-[#888891]">{copiedAddress === order.deliveryAddress ? "✓ Kopyalandı" : "Kopyala"}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DETAILS */}
                  <div className="grid grid-cols-3 gap-2 px-4 sm:px-5">
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-center"><span className="block text-[7px] font-black uppercase tracking-wider text-[#5F5F68]">Paket</span><b className="mt-1 block truncate text-[10px] text-white">{order.packageType}</b></div>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-center"><span className="block text-[7px] font-black uppercase tracking-wider text-[#5F5F68]">Mesafe</span><b className="mt-1 block text-[10px] text-white">{order.distanceKm} KM</b></div>
                    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 text-center"><span className="block text-[7px] font-black uppercase tracking-wider text-[#5F5F68]">Öncelik</span><b className={`mt-1 block truncate text-[10px] ${urgencyStyle.text}`}>{order.urgency}</b></div>
                  </div>

                  {order.note && (
                    <div className="px-4 pt-4 sm:px-5">
                      <div className="rounded-2xl border border-amber-500/15 bg-amber-500/[0.04] p-3.5">
                        <div className="mb-1 flex items-center gap-1.5"><Zap size={12} className="text-amber-400" /><b className="text-[8px] font-black uppercase tracking-wider text-amber-300">Müşteri notu</b></div>
                        <p className="text-xs leading-5 text-amber-100/90">{order.note}</p>
                      </div>
                    </div>
                  )}

                  {/* PRIMARY ACTION */}
                  {action && (
                    <div className="p-4 sm:p-5">
                      <button
                        type="button"
                        disabled={isUpdating || (!isSharingLocation && action.status !== "Teslim Edildi")}
                        onClick={() => void updateOrderStatus(order.id, action.status)}
                        className={`flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-2xl px-6 text-sm font-black shadow-xl transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 ${action.className}`}
                      >
                        {isUpdating ? (
                          <><span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> Güncelleniyor...</>
                        ) : !isSharingLocation && action.status !== "Teslim Edildi" ? (
                          <><AlertCircle size={19} /> Canlı GPS gerekli</>
                        ) : (
                          <>{ActionIcon && <ActionIcon size={20} />} {action.label} <ChevronRight size={18} /></>
                        )}
                      </button>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}

      {/* HISTORY */}
      {activeTab === "history" && (
        <div id="history-orders" className="scroll-mt-24 space-y-3">
          {completedOrders.length === 0 ? (
            <div className="rounded-[30px] border border-white/[0.07] bg-[#17171C] p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-white/[0.035] text-[#55555C]"><Clock3 size={28} /></div>
              <h3 className="mt-4 text-base font-black text-white">Henüz teslimat yok</h3>
              <p className="mt-1 text-xs leading-5 text-[#686871]">Tamamladığınız teslimatlar burada güvenli şekilde listelenecek.</p>
            </div>
          ) : (
            completedOrders.map((order) => {
              const expanded = expandedHistoryId === order.id;
              const earning = Math.round(Number(order.price || 0) * 0.7);
              return (
                <article key={order.id} className="overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#17171C] shadow-lg">
                  <button type="button" onClick={() => setExpandedHistoryId(expanded ? null : order.id)} className="w-full p-4 text-left transition hover:bg-white/[0.02] sm:p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs font-black text-white">#{order.id}</span>
                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[8px] font-black text-emerald-400"><CheckCircle2 size={10} /> Teslim Edildi</span>
                        </div>
                        <p className="mt-1.5 max-w-[260px] truncate text-xs text-[#8D8D95]">{order.pickupAddress.split(",")[0]} → {order.deliveryAddress.split(",")[0]}</p>
                        <span className="mt-1 block text-[8px] text-[#55555C]">{formatTime(order.deliveredAt)}</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="block text-base font-black text-[#D6A84F]">+{earning} TL</span>
                        <span className="mt-0.5 block text-[8px] text-[#55555C]">Hakediş</span>
                        <ChevronRight size={15} className={`ml-auto mt-2 text-[#66666E] transition ${expanded ? "rotate-90" : ""}`} />
                      </div>
                    </div>
                  </button>
                  {expanded && (
                    <div className="border-t border-white/[0.06] p-4 sm:p-5">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3"><span className="block text-[8px] text-[#62626A]">Müşteri</span><b className="mt-1 block truncate text-xs text-white">{order.customerName}</b></div>
                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3"><span className="block text-[8px] text-[#62626A]">Sipariş tutarı</span><b className="mt-1 block text-xs text-white">{order.price} TL</b></div>
                      </div>
                      <div className="mt-3"><DeliveryProofCard order={order} /></div>
                    </div>
                  )}
                </article>
              );
            })
          )}
        </div>
      )}

      {/* MOBILE PROFILE SHEET */}
      {mobileProfileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden" role="dialog" aria-modal="true" aria-label="Kurye profili">
          <button type="button" aria-label="Profili kapat" onClick={() => setMobileProfileOpen(false)} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-[30px] border-t border-white/[0.10] bg-[#111115] p-5 pb-8 shadow-[0_-25px_80px_rgba(0,0,0,0.65)] animate-[profileSheetUp_0.25s_ease-out]">
            <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-white/10" />
            <div className="flex items-center gap-3">
              <div className="h-14 w-14 overflow-hidden rounded-2xl border border-[#D6A84F]/25 bg-[#D6A84F]/10">
                {currentCourier.avatar ? <img src={currentCourier.avatar} alt={currentCourier.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center"><User size={22} className="text-[#D6A84F]" /></div>}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-base font-black text-white">{currentCourier.name}</p>
                <p className="mt-0.5 truncate text-[10px] text-[#77777F]">{currentCourier.vehicle || "Kurye"} • {currentCourier.plate || "PLAKA YOK"}</p>
              </div>
              <button type="button" onClick={() => setMobileProfileOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.05] text-[#999]" aria-label="Kapat">×</button>
            </div>

            {ratingCount > 0 && (
              <div className={`mb-3 rounded-2xl border p-3 ${isLowRating ? "border-red-500/25 bg-red-500/10" : "border-[#D6A84F]/10 bg-white/[0.02]"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className={`text-[8px] font-black uppercase tracking-wider ${isLowRating ? "text-red-300" : "text-[#77777F]"}`}>
                    Müşteri puanı
                  </span>
                  <span className={`text-xs font-black ${isLowRating ? "text-red-300" : "text-[#D6A84F]"}`}>
                    {ratingCount} değerlendirme
                  </span>
                </div>
                {isLowRating && (
                  <p className="mt-2 text-[9px] font-bold leading-4 text-red-300">
                    Düşük puan uyarısı — ortalamanızı yükseltmek için müşteri memnuniyetine dikkat edin.
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                <span className="block text-[8px] uppercase tracking-wider text-[#686871]">Puan</span>
                <b className={`mt-1 block text-lg font-black ${isLowRating ? "text-red-300" : "text-[#D6A84F]"}`}>
                  {ratingCount > 0 ? `${Number(rating).toFixed(2)} / 5` : "Yeni"}
                </b>
              </div>
              <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
                <span className="block text-[8px] uppercase tracking-wider text-[#686871]">Toplam teslimat</span>
                <b className="mt-1 block text-lg font-black text-white">{totalDeliveries}</b>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[8px] font-black uppercase tracking-[0.16em] text-[#686871]">Çalışma durumu</span>
                <span className="text-[9px] font-black text-[#D6A84F]">{courierStatus}</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {(["Müsait", "Meşgul", "Çevrimdışı"] as (CourierAvailability | "Çevrimdışı")[]).map((status) => {
                  const selected = courierStatus === status;
                  return (
                    <button key={status} type="button" onClick={() => void handleCourierStatus(status as CourierAvailability)} className={`rounded-xl px-2 py-2.5 text-[9px] font-black transition active:scale-95 ${selected ? status === "Müsait" ? "bg-emerald-500 text-white" : status === "Meşgul" ? "bg-amber-500 text-[#0B0B0D]" : "bg-red-500 text-white" : "bg-white/[0.04] text-[#77777F]"}`}>
                      {status}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button type="button" onClick={() => { setMobileProfileOpen(false); setActiveTab("history"); document.getElementById("history-orders")?.scrollIntoView({ behavior: "smooth", block: "start" }); }} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 text-left transition active:scale-[0.98]">
                <Clock3 size={16} className="text-[#D6A84F]" />
                <span className="mt-1.5 block text-[10px] font-black text-white">Teslimat geçmişi</span>
                <span className="mt-0.5 block text-[8px] text-[#686871]">{completedOrders.length} tamamlandı</span>
              </button>
              <button type="button" onClick={() => { setMobileProfileOpen(false); document.getElementById("earnings")?.scrollIntoView({ behavior: "smooth", block: "center" }); }} className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-3 text-left transition active:scale-[0.98]">
                <Wallet size={16} className="text-[#D6A84F]" />
                <span className="mt-1.5 block text-[10px] font-black text-white">Kazanç özeti</span>
                <span className="mt-0.5 block text-[8px] text-[#686871]">{totalEarnings} TL toplam</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELIVERY PROOF */}
      {proofOrder && (
        <DeliveryProofModal order={proofOrder} onClose={() => setProofOrder(null)} onSubmit={handleProofSubmit} />
      )}
    </div>
  );
}
const PackageIcon: React.FC<{
  size?: number;
}> = ({ size = 20 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m16.5 9.4-9-5.19" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.27 6.96 8.73 5.05 8.73-5.05" />
    <path d="M12 22.08V12" />
  </svg>
);
