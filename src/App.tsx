import React, {
  useEffect,
  useState,
} from "react";

import { storage } from "./services/storage";

import {
  subscribeToAuth,
  handleGoogleRedirectResult,
  ensureUserProfile,
} from "./services/auth";

import type {
  NotificationItem,
  Order,
  PricingConfig,
  UserProfile,
} from "./types";

import { Navbar } from "./components/Navbar";
import { BottomNavigation } from "./components/BottomNavigation";
import { CustomerHome } from "./components/CustomerHome";
import { CustomerOrders } from "./components/CustomerOrders";
import { TrustlineAI } from "./components/TrustlineAI";
import { CourierPanel } from "./components/CourierPanel";
import { AdminPanel } from "./components/AdminPanel";
import { ProfileView } from "./components/ProfileView";
import { NewOrderModal } from "./components/NewOrderModal";
import { NotificationDrawer } from "./components/NotificationDrawer";
import { AuthScreen } from "./components/AuthScreen";

export function App() {
  const [currentUser, setCurrentUser] =
    useState<UserProfile | null>(null);

  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const savedOrders = storage.getOrders();

      return Array.isArray(savedOrders)
        ? savedOrders
        : [];
    } catch (error) {
      console.error(
        "Orders yüklenemedi:",
        error
      );

      return [];
    }
  });

  const [pricing, setPricing] =
    useState<PricingConfig>(() => {
      try {
        return storage.getPricing();
      } catch (error) {
        console.error(
          "Pricing yüklenemedi:",
          error
        );

        return {
          perKmPrice: 20,
          minPrice: 100,
          urgentMultiplier: 1.5,
          vipMultiplier: 2,
          requireDeliveryPhoto: false,
          updatedAt:
            new Date().toISOString(),
        };
      }
    });

  const [notifications, setNotifications] =
    useState<NotificationItem[]>([]);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [profileLoading, setProfileLoading] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState("home");

  const [isNewOrderOpen, setIsNewOrderOpen] =
    useState(false);

  const [newOrderPrefill, setNewOrderPrefill] =
    useState<Partial<Order> | undefined>();

  const [
    isNotificationsOpen,
    setIsNotificationsOpen,
  ] = useState(false);

  const [selectedOrderId, setSelectedOrderId] =
    useState<string | null>(null);

  const [isIPhoneMode, setIsIPhoneMode] =
    useState(false);

  const [appError, setAppError] =
    useState<string | null>(null);

  /* ==========================================================
     FIREBASE AUTH
  ========================================================== */

  useEffect(() => {
    let mounted = true;

    let unsubscribe:
      | (() => void)
      | undefined;

    console.log(
      "🚀 Trustline Firebase Auth başlatılıyor..."
    );

    /**
     * ========================================================
     * GOOGLE REDIRECT + AUTH STATE
     * ========================================================
     */

    const initializeAuth = async () => {
      /**
       * ------------------------------------------------------
       * ÖNCE GOOGLE REDIRECT SONUCUNU KONTROL ET
       * ------------------------------------------------------
       */

      console.log(
        "🔎 Google redirect sonucu kontrol ediliyor..."
      );

      try {
        const redirectProfile =
          await handleGoogleRedirectResult();

        if (!mounted) {
          return;
        }

        if (redirectProfile) {
          console.log(
            "🟢 Google redirect profili bulundu:",
            {
              uid: redirectProfile.id,
              email: redirectProfile.email,
              role: redirectProfile.role,
            }
          );

          const appProfile =
            redirectProfile as UserProfile;

          /**
           * STORAGE
           */

          try {
            storage.setCurrentUser(
              appProfile
            );
          } catch (error) {
            console.warn(
              "⚠️ Storage kullanıcı ayarlanamadı:",
              error
            );
          }

          /**
           * REACT USER
           */

          setCurrentUser(
            appProfile
          );

          /**
           * NOTIFICATIONS
           */

          try {
            const userNotifications =
              storage.getNotifications(
                appProfile.id
              );

            setNotifications(
              Array.isArray(
                userNotifications
              )
                ? userNotifications
                : []
            );
          } catch (error) {
            console.warn(
              "⚠️ Bildirimler yüklenemedi:",
              error
            );

            setNotifications([]);
          }

          /**
           * ROLE
           */

          if (
            appProfile.role ===
            "customer"
          ) {
            setActiveTab("home");
          } else if (
            appProfile.role ===
            "courier"
          ) {
            setActiveTab(
              "courier_panel"
            );
          } else if (
            appProfile.role ===
            "admin"
          ) {
            setActiveTab(
              "admin_panel"
            );
          }

          setProfileLoading(false);
          setAuthLoading(false);
          setAppError(null);

          console.log(
            "🚀 GOOGLE REDIRECT GİRİŞİ TAMAMLANDI."
          );
        }
      } catch (error) {
        if (!mounted) {
          return;
        }

        console.warn(
          "⚠️ Google redirect sonucu alınamadı:",
          error
        );
      }

      if (!mounted) {
        return;
      }

      /**
       * ------------------------------------------------------
       * AUTH STATE LISTENER
       * ------------------------------------------------------
       */

      unsubscribe =
        subscribeToAuth(
          async (firebaseUser) => {
            if (!mounted) {
              return;
            }

            console.log(
              "🔄 App Auth callback:",
              {
                uid:
                  firebaseUser?.uid ??
                  "YOK",
                email:
                  firebaseUser?.email ??
                  "YOK",
                emailVerified:
                  firebaseUser?.emailVerified ??
                  false,
              }
            );

            /**
             * ==================================================
             * KULLANICI YOK
             * ==================================================
             */

            if (!firebaseUser) {
              console.log(
                "🔒 Firebase'de aktif kullanıcı yok."
              );

              try {
                storage.setCurrentUser(
                  null
                );
              } catch (error) {
                console.warn(
                  "⚠️ Storage kullanıcı temizlenemedi:",
                  error
                );
              }

              setCurrentUser(null);
              setNotifications([]);
              setProfileLoading(false);
              setAuthLoading(false);
              setAppError(null);

              return;
            }

            /**
             * ==================================================
             * AUTH KULLANICISI BULUNDU
             * ==================================================
             */

            console.log(
              "🟢 Firebase Authentication kullanıcısı bulundu:",
              {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                verified:
                  firebaseUser.emailVerified,
                providers:
                  firebaseUser.providerData.map(
                    (provider) =>
                      provider.providerId
                  ),
              }
            );

            /**
             * ==================================================
             * GOOGLE PROVIDER KONTROLÜ
             * ==================================================
             */

            const isGoogleUser =
              firebaseUser.providerData.some(
                (provider) =>
                  provider.providerId ===
                  "google.com"
              );

            /**
             * ==================================================
             * EMAIL DOĞRULAMA
             * ==================================================
             *
             * Google kullanıcıları için eski email/password
             * doğrulama kontrolünü uygulamıyoruz.
             */

            if (
              !isGoogleUser &&
              !firebaseUser.emailVerified
            ) {
              console.warn(
                "⚠️ Auth kullanıcısı mevcut ancak e-posta doğrulanmamış.",
                {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                }
              );

              setCurrentUser(null);
              setNotifications([]);
              setProfileLoading(false);
              setAuthLoading(false);
              setAppError(null);

              return;
            }

            /**
             * ==================================================
             * FIRESTORE PROFİLİ
             * ==================================================
             */

            setAuthLoading(false);
            setProfileLoading(true);
            setAppError(null);

            try {
              console.log(
                "👤 Firestore kullanıcı profili hazırlanıyor:",
                {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  verified:
                    firebaseUser.emailVerified,
                  google:
                    isGoogleUser,
                }
              );

              const profile =
                await ensureUserProfile(
                  firebaseUser
                );

              if (!mounted) {
                return;
              }

              console.log(
                "✅ Firestore kullanıcı profili hazır:",
                {
                  uid: profile.id,
                  email: profile.email,
                  role: profile.role,
                }
              );

              const appProfile =
                profile as UserProfile;

              /**
               * ==================================================
               * STORAGE
               * ==================================================
               */

              try {
                storage.setCurrentUser(
                  appProfile
                );
              } catch (error) {
                console.error(
                  "⚠️ Storage kullanıcı ayarlanamadı:",
                  error
                );
              }

              /**
               * ==================================================
               * REACT USER
               * ==================================================
               */

              setCurrentUser(
                appProfile
              );

              /**
               * ==================================================
               * NOTIFICATIONS
               * ==================================================
               */

              try {
                const userNotifications =
                  storage.getNotifications(
                    appProfile.id
                  );

                setNotifications(
                  Array.isArray(
                    userNotifications
                  )
                    ? userNotifications
                    : []
                );
              } catch (error) {
                console.warn(
                  "⚠️ Bildirimler yüklenemedi:",
                  error
                );

                setNotifications([]);
              }

              /**
               * ==================================================
               * ROLE
               * ==================================================
               */

              if (
                appProfile.role ===
                "customer"
              ) {
                setActiveTab("home");
              } else if (
                appProfile.role ===
                "courier"
              ) {
                setActiveTab(
                  "courier_panel"
                );
              } else if (
                appProfile.role ===
                "admin"
              ) {
                setActiveTab(
                  "admin_panel"
                );
              }

              /**
               * ==================================================
               * TAMAMLANDI
               * ==================================================
               */

              setProfileLoading(false);
              setAuthLoading(false);
              setAppError(null);

              console.log(
                "🚀 TRUSTLINE DASHBOARD HAZIR."
              );
            } catch (error) {
              if (!mounted) {
                return;
              }

              console.error(
                "❌ Kullanıcı profili hazırlanamadı:",
                error
              );

              setProfileLoading(false);
              setAuthLoading(false);

              const code =
                typeof error ===
                  "object" &&
                error !== null &&
                "code" in error
                  ? String(
                      (
                        error as {
                          code?: unknown;
                        }
                      ).code
                    )
                  : "";

              /**
               * EMAIL DOĞRULAMA
               */

              if (
                code ===
                  "auth/email-not-verified" ||
                code ===
                  "auth/email-verification-required"
              ) {
                console.warn(
                  "⚠️ Kullanıcı doğrulanmamış."
                );

                setCurrentUser(null);
                setNotifications([]);
                setAppError(null);

                return;
              }

              /**
               * FIRESTORE PERMISSION
               */

              if (
                code ===
                "permission-denied"
              ) {
                setCurrentUser(null);

                setAppError(
                  "Kullanıcı hesabı bulundu ancak Firestore kullanıcı profiline erişilemiyor. Firebase Firestore Rules kontrol edilmeli."
                );

                return;
              }

              /**
               * DİĞER HATALAR
               */

              setCurrentUser(null);

              setAppError(
                "Kullanıcı profili hazırlanırken bir hata oluştu. Lütfen tekrar deneyin."
              );
            }
          }
        );
    };

    /**
     * AUTH BAŞLAT
     */

    void initializeAuth();

    /**
     * CLEANUP
     */

    return () => {
      mounted = false;

      try {
        unsubscribe?.();
      } catch (error) {
        console.warn(
          "Auth listener kapatılamadı:",
          error
        );
      }
    };
  }, []);

  /* ==========================================================
     STORAGE LISTENER
  ========================================================== */

  useEffect(() => {
    let mounted = true;

    let unsubscribe:
      | (() => void)
      | undefined;

    try {
      unsubscribe =
        storage.subscribe(() => {
          if (!mounted) {
            return;
          }

          /**
           * ORDERS
           */

          try {
            const nextOrders =
              storage.getOrders();

            setOrders(
              Array.isArray(
                nextOrders
              )
                ? nextOrders
                : []
            );
          } catch (error) {
            console.error(
              "Orders listener hatası:",
              error
            );
          }

          /**
           * PRICING
           */

          try {
            const nextPricing =
              storage.getPricing();

            if (nextPricing) {
              setPricing(
                nextPricing
              );
            }
          } catch (error) {
            console.error(
              "Pricing listener hatası:",
              error
            );
          }

          /**
           * NOTIFICATIONS
           */

          if (currentUser) {
            try {
              const nextNotifications =
                storage.getNotifications(
                  currentUser.id
                );

              setNotifications(
                Array.isArray(
                  nextNotifications
                )
                  ? nextNotifications
                  : []
              );
            } catch (error) {
              console.error(
                "Notification listener hatası:",
                error
              );
            }
          }
        });
    } catch (error) {
      console.error(
        "Storage listener başlatılamadı:",
        error
      );
    }

    return () => {
      mounted = false;

      try {
        unsubscribe?.();
      } catch (error) {
        console.warn(
          "Storage listener kapatılamadı:",
          error
        );
      }
    };
  }, [currentUser?.id]);

  /* ==========================================================
     NEW ORDER
  ========================================================== */

  const handleOpenNewOrder = (
    prefill?: Partial<Order>
  ) => {
    setNewOrderPrefill(prefill);
    setIsNewOrderOpen(true);
  };

  const handleTransferFromAI = (
    draft: Partial<Order>
  ) => {
    handleOpenNewOrder(draft);
    setActiveTab("home");
  };

  /* ==========================================================
     AUTH LOADING
  ========================================================== */

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0B0D] text-white">
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D6A84F]">
            <span className="text-3xl font-black text-[#0B0B0D]">
              T
            </span>
          </div>

          <div className="text-sm font-black tracking-[0.2em] text-[#D6A84F]">
            TRUSTLINE
          </div>

          <div className="mt-1 text-[10px] tracking-[0.3em] text-[#888888]">
            EXPRESS
          </div>

          <p className="mt-4 text-xs text-[#666666]">
            Güvenli bağlantı kuruluyor...
          </p>
        </div>
      </div>
    );
  }

  /* ==========================================================
     PROFILE LOADING
  ========================================================== */

  if (
    profileLoading &&
    !currentUser
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0B0D] text-white">
        <div className="w-full max-w-sm rounded-3xl border border-[#303036] bg-[#19191E] p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D6A84F]/15">
            <span className="text-2xl font-black text-[#D6A84F]">
              T
            </span>
          </div>

          <h2 className="mt-5 text-lg font-bold text-white">
            Hesap hazırlanıyor
          </h2>

          <p className="mt-2 text-xs text-[#999999]">
            Hesap bilgileriniz yükleniyor...
          </p>

          <div className="mx-auto mt-5 h-1.5 w-32 overflow-hidden rounded-full bg-[#303036]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[#D6A84F]" />
          </div>
        </div>
      </div>
    );
  }

  /* ==========================================================
     ERROR
  ========================================================== */

  if (
    appError &&
    !currentUser
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0B0D] px-5 text-white">
        <div className="w-full max-w-md rounded-3xl border border-red-500/30 bg-[#19191E] p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">
            !
          </div>

          <h2 className="mt-4 text-lg font-bold">
            Bağlantı Hatası
          </h2>

          <p className="mt-2 text-sm text-[#999999]">
            {appError}
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="mt-6 rounded-2xl bg-[#D6A84F] px-6 py-3 text-sm font-black text-[#0B0B0D]"
          >
            Tekrar Dene
          </button>
        </div>
      </div>
    );
  }

  /* ==========================================================
     LOGIN
  ========================================================== */

  if (!currentUser) {
    return <AuthScreen />;
  }

  /* ==========================================================
     ORDERS
  ========================================================== */

  const safeOrders =
    Array.isArray(orders)
      ? orders
      : [];

  const myOrders =
    currentUser.role ===
    "customer"
      ? safeOrders.filter(
          (order) =>
            order.customerId ===
            currentUser.id
        )
      : currentUser.role ===
        "courier"
      ? safeOrders.filter(
          (order) =>
            order.courierId ===
            currentUser.id
        )
      : safeOrders;

  const activeOrders =
    myOrders.filter(
      (order) =>
        order.status !==
          "Teslim Edildi" &&
        order.status !==
          "İptal Edildi"
    );

  const unreadNotificationsCount =
    notifications.filter(
      (notification) =>
        !notification.read
    ).length;

  /* ==========================================================
     MAIN APPLICATION
  ========================================================== */

  return (
    <div
      className={`flex min-h-screen flex-col bg-[#0B0B0D] text-white ${
        isIPhoneMode
          ? "items-center justify-center px-2 py-4"
          : ""
      }`}
    >
      <div
        className={`flex w-full flex-col ${
          isIPhoneMode
            ? "h-[820px] max-w-[390px] overflow-hidden rounded-[48px] border-[8px] border-[#222229] bg-[#19191E] shadow-2xl"
            : "min-h-screen"
        }`}
      >
        {isIPhoneMode && (
          <div className="flex h-8 shrink-0 items-center justify-center bg-[#0B0B0D]">
            <div className="h-5 w-28 rounded-b-xl bg-[#222229]" />
          </div>
        )}

        <Navbar
          currentUser={currentUser}
          unreadNotificationsCount={
            unreadNotificationsCount
          }
          onOpenNotifications={() =>
            setIsNotificationsOpen(true)
          }
          isIPhoneMode={isIPhoneMode}
          onToggleIPhoneMode={() =>
            setIsIPhoneMode(
              (value) => !value
            )
          }
          activeTab={activeTab}
        />

        <main
          className={`flex-1 overflow-y-auto px-4 py-5 ${
            isIPhoneMode
              ? "max-h-[740px]"
              : ""
          }`}
        >
          {currentUser.role ===
            "customer" && (
            <>
              {activeTab ===
                "home" && (
                <CustomerHome
                  onOpenNewOrder={
                    handleOpenNewOrder
                  }
                  onOpenAI={() =>
                    setActiveTab("ai")
                  }
                  onGoToOrders={() =>
                    setActiveTab(
                      "orders"
                    )
                  }
                  activeOrders={
                    activeOrders
                  }
                  pricing={pricing}
                />
              )}

              {activeTab ===
                "orders" && (
                <CustomerOrders
                  orders={myOrders}
                  onOpenNewOrder={
                    handleOpenNewOrder
                  }
                  selectedOrderId={
                    selectedOrderId
                  }
                />
              )}

              {activeTab ===
                "ai" && (
                <TrustlineAI
                  onTransferToOrder={
                    handleTransferFromAI
                  }
                  orders={myOrders}
                />
              )}

              {activeTab ===
                "profile" && (
                <ProfileView
                  currentUser={
                    currentUser
                  }
                />
              )}
            </>
          )}

          {currentUser.role ===
            "courier" && (
            <>
              {activeTab ===
                "courier_panel" && (
                <CourierPanel
                  currentCourier={
                    currentUser
                  }
                  orders={safeOrders}
                />
              )}

              {activeTab ===
                "profile" && (
                <ProfileView
                  currentUser={
                    currentUser
                  }
                />
              )}
            </>
          )}

          {currentUser.role ===
            "admin" && (
            <>
              {activeTab ===
                "admin_panel" && (
                <AdminPanel
                  orders={safeOrders}
                  pricing={pricing}
                />
              )}

              {activeTab ===
                "profile" && (
                <ProfileView
                  currentUser={
                    currentUser
                  }
                />
              )}
            </>
          )}
        </main>

        <BottomNavigation
          role={currentUser.role}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setSelectedOrderId(null);
          }}
          onOpenNewOrder={() =>
            handleOpenNewOrder()
          }
          activeOrdersCount={
            activeOrders.length
          }
        />
      </div>

      <NewOrderModal
        isOpen={isNewOrderOpen}
        onClose={() => {
          setIsNewOrderOpen(false);
          setNewOrderPrefill(
            undefined
          );
        }}
        currentUser={currentUser}
        pricing={pricing}
        prefillData={
          newOrderPrefill
        }
        onOrderCreated={(order) => {
          setActiveTab("orders");
          setSelectedOrderId(
            order.id
          );
        }}
      />

      <NotificationDrawer
        isOpen={
          isNotificationsOpen
        }
        onClose={() =>
          setIsNotificationsOpen(false)
        }
        notifications={
          notifications
        }
        userId={currentUser.id}
        onSelectOrder={(orderId) => {
          setSelectedOrderId(
            orderId
          );

          if (
            currentUser.role ===
            "courier"
          ) {
            setActiveTab(
              "courier_panel"
            );
          } else {
            setActiveTab(
              "orders"
            );
          }
        }}
      />
    </div>
  );
}

export default App;