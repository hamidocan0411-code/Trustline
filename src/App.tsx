import React, { useEffect, useState } from "react";

import { storage } from "./services/storage";
import { subscribeToAuth } from "./services/auth";

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

  const [orders, setOrders] = useState<Order[]>(
    () => {
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
    }
  );

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

  const [isNotificationsOpen, setIsNotificationsOpen] =
    useState(false);

  const [selectedOrderId, setSelectedOrderId] =
    useState<string | null>(null);

  const [isIPhoneMode, setIsIPhoneMode] =
    useState(false);

  const [appError, setAppError] =
    useState<string | null>(null);

  /*
   * ==========================================
   * FIREBASE AUTH
   * ==========================================
   */

  useEffect(() => {
    let mounted = true;

    let unsubscribe:
      | (() => void)
      | undefined;

    try {
      unsubscribe = subscribeToAuth(
        async (firebaseUser, profile) => {
          if (!mounted) {
            return;
          }

          try {
            setAppError(null);

            /*
             * Kullanıcı çıkış yaptıysa
             */
            if (!firebaseUser) {
              storage.setCurrentUser(null);

              setCurrentUser(null);
              setNotifications([]);
              setProfileLoading(false);
              setAuthLoading(false);

              return;
            }

            /*
             * Firebase Auth var ama Firestore
             * profili henüz gelmediyse bekle.
             */
            if (!profile) {
              setProfileLoading(true);
              setAuthLoading(false);

              return;
            }

            /*
             * Profil geldikten sonra kullanıcıyı
             * uygulamaya aktar.
             */
            storage.setCurrentUser(profile);

            setCurrentUser(profile);

            try {
              const userNotifications =
                storage.getNotifications(
                  profile.id
                );

              setNotifications(
                Array.isArray(
                  userNotifications
                )
                  ? userNotifications
                  : []
              );
            } catch (notificationError) {
              console.error(
                "Bildirimler yüklenemedi:",
                notificationError
              );

              setNotifications([]);
            }

            /*
             * ROLE GÖRE SAYFA
             */
            if (profile.role === "customer") {
              setActiveTab("home");
            } else if (
              profile.role === "courier"
            ) {
              setActiveTab("courier_panel");
            } else if (
              profile.role === "admin"
            ) {
              setActiveTab("admin_panel");
            }

            setProfileLoading(false);
            setAuthLoading(false);
          } catch (error) {
            console.error(
              "Trustline auth/profile error:",
              error
            );

            if (!mounted) {
              return;
            }

            setAppError(
              "Hesap bilgileri yüklenirken bir hata oluştu."
            );

            setCurrentUser(null);
            setNotifications([]);
            setProfileLoading(false);
            setAuthLoading(false);
          }
        }
      );
    } catch (error) {
      console.error(
        "Auth listener başlatılamadı:",
        error
      );

      if (mounted) {
        setAppError(
          "Firebase bağlantısı kurulamadı."
        );

        setAuthLoading(false);
        setProfileLoading(false);
      }
    }

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

  /*
   * ==========================================
   * STORAGE LISTENER
   * ==========================================
   */

  useEffect(() => {
    let mounted = true;

    let unsubscribe:
      | (() => void)
      | undefined;

    try {
      unsubscribe = storage.subscribe(() => {
        if (!mounted) {
          return;
        }

        try {
          const nextOrders =
            storage.getOrders();

          setOrders(
            Array.isArray(nextOrders)
              ? nextOrders
              : []
          );
        } catch (error) {
          console.error(
            "Orders listener hatası:",
            error
          );
        }

        try {
          const nextPricing =
            storage.getPricing();

          if (nextPricing) {
            setPricing(nextPricing);
          }
        } catch (error) {
          console.error(
            "Pricing listener hatası:",
            error
          );
        }

        /*
         * Kullanıcı varsa bildirimleri yenile.
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

  /*
   * ==========================================
   * NEW ORDER
   * ==========================================
   */

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

  /*
   * ==========================================
   * AUTH LOADING
   * ==========================================
   */

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

  /*
   * ==========================================
   * PROFILE LOADING
   * ==========================================
   */

  if (
    profileLoading &&
    !currentUser
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0B0D] text-white">
        <div className="w-full max-w-sm rounded-3xl border border-[#303036] bg-[#19191E] p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D6A84F]/15">
            <span className="text-2xl font-black text-[#D6A84F]">
              T
            </span>
          </div>

          <h2 className="mt-5 text-lg font-bold text-white">
            Hesap hazırlanıyor
          </h2>

          <p className="mt-2 text-xs text-[#999999]">
            Kurye bilgileriniz yükleniyor...
          </p>

          <div className="mx-auto mt-5 h-1.5 w-32 overflow-hidden rounded-full bg-[#303036]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[#D6A84F]" />
          </div>
        </div>
      </div>
    );
  }

  /*
   * ==========================================
   * ERROR
   * ==========================================
   */

  if (appError && !currentUser) {
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

  /*
   * ==========================================
   * LOGIN / REGISTER
   * ==========================================
   */

  if (!currentUser) {
    return <AuthScreen />;
  }

  /*
   * ==========================================
   * USER ORDERS
   * ==========================================
   */

  const safeOrders = Array.isArray(orders)
    ? orders
    : [];

  const myOrders =
    currentUser.role === "customer"
      ? safeOrders.filter(
          (order) =>
            order.customerId ===
            currentUser.id
        )
      : currentUser.role === "courier"
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

  /*
   * ==========================================
   * MAIN APPLICATION
   * ==========================================
   */

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
          {/* ==========================================
              CUSTOMER
          ========================================== */}

          {currentUser.role ===
            "customer" && (
            <>
              {activeTab === "home" && (
                <CustomerHome
                  onOpenNewOrder={
                    handleOpenNewOrder
                  }
                  onOpenAI={() =>
                    setActiveTab("ai")
                  }
                  onGoToOrders={() =>
                    setActiveTab("orders")
                  }
                  activeOrders={
                    activeOrders
                  }
                  pricing={pricing}
                />
              )}

              {activeTab === "orders" && (
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

              {activeTab === "ai" && (
                <TrustlineAI
                  onTransferToOrder={
                    handleTransferFromAI
                  }
                  orders={myOrders}
                />
              )}

              {activeTab === "profile" && (
                <ProfileView
                  currentUser={
                    currentUser
                  }
                />
              )}
            </>
          )}

          {/* ==========================================
              COURIER
          ========================================== */}

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

              {activeTab === "profile" && (
                <ProfileView
                  currentUser={
                    currentUser
                  }
                />
              )}
            </>
          )}

          {/* ==========================================
              ADMIN
          ========================================== */}

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

              {activeTab === "profile" && (
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

      {/* ==========================================
          NEW ORDER
      ========================================== */}

      <NewOrderModal
        isOpen={isNewOrderOpen}
        onClose={() => {
          setIsNewOrderOpen(false);
          setNewOrderPrefill(undefined);
        }}
        currentUser={currentUser}
        pricing={pricing}
        prefillData={newOrderPrefill}
        onOrderCreated={(order) => {
          setActiveTab("orders");
          setSelectedOrderId(order.id);
        }}
      />

      {/* ==========================================
          NOTIFICATIONS
      ========================================== */}

      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() =>
          setIsNotificationsOpen(false)
        }
        notifications={notifications}
        userId={currentUser.id}
        onSelectOrder={(orderId) => {
          setSelectedOrderId(orderId);

          /*
           * Kurye ise sipariş ekranına,
           * müşteri ise orders ekranına.
           */
          if (
            currentUser.role ===
            "courier"
          ) {
            setActiveTab("courier_panel");
          } else {
            setActiveTab("orders");
          }
        }}
      />
    </div>
  );
}

export default App;