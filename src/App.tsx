import React, { useEffect, useState } from 'react';

import { storage } from './services/storage';
import {
  subscribeToAuth,
  getUserProfile,
} from './services/auth';
import { auth } from './services/firebase';

import {
  NotificationItem,
  Order,
  PricingConfig,
  UserProfile,
} from './types';

import { Navbar } from './components/Navbar';
import { BottomNavigation } from './components/BottomNavigation';
import { CustomerHome } from './components/CustomerHome';
import { CustomerOrders } from './components/CustomerOrders';
import { TrustlineAI } from './components/TrustlineAI';
import { CourierPanel } from './components/CourierPanel';
import { AdminPanel } from './components/AdminPanel';
import { ProfileView } from './components/ProfileView';
import { NewOrderModal } from './components/NewOrderModal';
import { NotificationDrawer } from './components/NotificationDrawer';

export function App() {
  const [currentUser, setCurrentUser] =
    useState<UserProfile | null>(null);

  const [orders, setOrders] = useState<Order[]>(
    storage.getOrders()
  );

  const [pricing, setPricing] =
    useState<PricingConfig>(
      storage.getPricing()
    );

  const [notifications, setNotifications] =
    useState<NotificationItem[]>([]);

  const [authLoading, setAuthLoading] =
    useState(true);

  const [activeTab, setActiveTab] =
    useState<string>('home');

  const [isNewOrderOpen, setIsNewOrderOpen] =
    useState(false);

  const [newOrderPrefill, setNewOrderPrefill] =
    useState<Partial<Order> | undefined>(
      undefined
    );

  const [isNotificationsOpen, setIsNotificationsOpen] =
    useState(false);

  const [selectedOrderId, setSelectedOrderId] =
    useState<string | null>(null);

  const [isIPhoneMode, setIsIPhoneMode] =
    useState(false);

  /*
   * =====================================================
   * FIREBASE AUTH LISTENER
   * =====================================================
   */

  useEffect(() => {
    let mounted = true;

    const unsubscribe = subscribeToAuth(
      async (firebaseUser, profile) => {
        if (!mounted) {
          return;
        }

        if (!firebaseUser) {
          setCurrentUser(null);
          setNotifications([]);
          setAuthLoading(false);
          return;
        }

        let resolvedProfile = profile;

        /*
         * Profil listener tarafından bulunamazsa
         * Firestore'dan bir kez daha almaya çalış.
         */
        if (!resolvedProfile) {
          resolvedProfile =
            await getUserProfile(
              firebaseUser
            );
        }

        if (!mounted) {
          return;
        }

        if (resolvedProfile) {
          setCurrentUser(
            resolvedProfile
          );

          /*
           * Eski storage API'si ile uyumluluk.
           * Gerçek kimlik Firebase UID'dir.
           */
          storage.setCurrentUser(
            resolvedProfile
          );

          setNotifications(
            storage.getNotifications(
              resolvedProfile.id
            )
          );

          /*
           * Kullanıcı rolüne göre başlangıç ekranı.
           */
          if (
            resolvedProfile.role ===
            'customer'
          ) {
            setActiveTab('home');
          } else if (
            resolvedProfile.role ===
            'courier'
          ) {
            setActiveTab(
              'courier_panel'
            );
          } else {
            setActiveTab(
              'admin_panel'
            );
          }
        }

        setAuthLoading(false);
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  /*
   * =====================================================
   * STORAGE / FIRESTORE REACTIVITY
   * =====================================================
   */

  useEffect(() => {
    const unsubscribe =
      storage.subscribe(() => {
        setOrders(
          storage.getOrders()
        );

        setPricing(
          storage.getPricing()
        );

        if (currentUser) {
          setNotifications(
            storage.getNotifications(
              currentUser.id
            )
          );
        }
      });

    return () => {
      unsubscribe();
    };
  }, [currentUser?.id]);

  /*
   * =====================================================
   * NOTIFICATIONS
   * =====================================================
   */

  useEffect(() => {
    if (!currentUser) {
      setNotifications([]);
      return;
    }

    setNotifications(
      storage.getNotifications(
        currentUser.id
      )
    );

    if (
      currentUser.role ===
      'customer'
    ) {
      setActiveTab('home');
    } else if (
      currentUser.role ===
      'courier'
    ) {
      setActiveTab(
        'courier_panel'
      );
    } else {
      setActiveTab(
        'admin_panel'
      );
    }
  }, [
    currentUser?.id,
    currentUser?.role,
  ]);

  /*
   * =====================================================
   * NEW ORDER
   * =====================================================
   */

  const handleOpenNewOrder = (
    prefill?: Partial<Order>
  ) => {
    setNewOrderPrefill(
      prefill
    );

    setIsNewOrderOpen(true);
  };

  const handleTransferFromAI = (
    draft: Partial<Order>
  ) => {
    handleOpenNewOrder(
      draft
    );

    setActiveTab('home');
  };

  /*
   * =====================================================
   * LOADING SCREEN
   * =====================================================
   */

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#D6A84F] flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(214,168,79,0.25)]">
            <span className="text-[#0B0B0D] font-black text-2xl">
              T
            </span>
          </div>

          <p className="text-[#D6A84F] font-bold tracking-widest text-sm">
            TRUSTLINE EXPRESS
          </p>

          <p className="text-[#777777] text-xs mt-2">
            Hesap kontrol ediliyor...
          </p>
        </div>
      </div>
    );
  }

  /*
   * =====================================================
   * AUTH GEREKİYOR
   * =====================================================
   *
   * Login/Register ekranını bir sonraki adımda
   * ekleyeceğiz.
   */

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] text-white flex items-center justify-center px-6">
        <div className="w-full max-w-md bg-[#19191E] border border-[#303036] rounded-3xl p-8 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-[#D6A84F] flex items-center justify-center mx-auto mb-5">
            <span className="text-[#0B0B0D] font-black text-3xl">
              T
            </span>
          </div>

          <h1 className="text-2xl font-black tracking-tight">
            Trustline Express
          </h1>

          <p className="text-sm text-[#999999] mt-2">
            Devam etmek için hesabınıza
            giriş yapmanız gerekiyor.
          </p>

          <div className="mt-6 bg-[#222229] border border-[#303036] rounded-2xl p-4">
            <p className="text-xs text-[#777777]">
              V1 kimlik doğrulama sistemi
              aktif.
            </p>

            <p className="text-sm text-[#D6A84F] font-semibold mt-1">
              Giriş / Kayıt ekranı
              hazırlanıyor.
            </p>
          </div>
        </div>
      </div>
    );
  }

  /*
   * =====================================================
   * USER DATA
   * =====================================================
   */

  const unreadNotificationsCount =
    notifications.filter(
      (notification) =>
        !notification.read
    ).length;

  const myOrders =
    currentUser.role ===
    'customer'
      ? orders.filter(
          (order) =>
            order.customerId ===
            currentUser.id
        )
      : currentUser.role ===
        'courier'
      ? orders.filter(
          (order) =>
            order.courierId ===
            currentUser.id
        )
      : orders;

  const activeOrders =
    myOrders.filter(
      (order) =>
        ![
          'Teslim Edildi',
          'İptal Edildi',
        ].includes(
          order.status
        )
    );

  /*
   * =====================================================
   * MAIN UI
   * =====================================================
   */

  return (
    <div
      className={`min-h-screen bg-[#0B0B0D] text-white flex flex-col font-sans transition-all ${
        isIPhoneMode
          ? 'py-4 sm:py-8 px-2 sm:px-4 items-center justify-center bg-zinc-950'
          : ''
      }`}
    >
      <div
        className={`w-full flex flex-col transition-all ${
          isIPhoneMode
            ? 'w-full max-w-[390px] h-[820px] bg-[#19191E] rounded-[48px] border-[8px] border-[#222229] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden relative'
            : 'min-h-screen'
        }`}
      >
        {isIPhoneMode && (
          <>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#222229] rounded-b-2xl z-50 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-black/60 border border-[#303036]/60" />
            </div>

            <div className="h-9 bg-[#0B0B0D] flex items-center justify-between px-7 text-[11px] text-[#999999] shrink-0 font-medium select-none z-40 border-b border-[#303036]/30">
              <span className="font-semibold text-white">
                09:41
              </span>

              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[10px]">
                  5G
                </span>

                <div className="w-4 h-2 border border-[#999999] rounded-xs p-0.5">
                  <div className="w-full h-full bg-[#999999]" />
                </div>
              </div>
            </div>
          </>
        )}

        <Navbar
          currentUser={currentUser}
          onSwitchUser={() => {
            /*
             * Gerçek Auth V1'de rol değişimi
             * demo üzerinden yapılmayacak.
             */
          }}
          unreadNotificationsCount={
            unreadNotificationsCount
          }
          onOpenNotifications={() =>
            setIsNotificationsOpen(
              true
            )
          }
          isIPhoneMode={
            isIPhoneMode
          }
          onToggleIPhoneMode={() =>
            setIsIPhoneMode(
              !isIPhoneMode
            )
          }
          activeTab={activeTab}
        />

        <main
          className={`flex-1 overflow-y-auto px-4 py-5 max-w-7xl w-full mx-auto ${
            isIPhoneMode
              ? 'overflow-y-auto max-h-[740px]'
              : ''
          }`}
        >
          {currentUser.role ===
            'customer' && (
            <>
              {activeTab ===
                'home' && (
                <CustomerHome
                  onOpenNewOrder={
                    handleOpenNewOrder
                  }
                  onOpenAI={() =>
                    setActiveTab('ai')
                  }
                  onGoToOrders={() =>
                    setActiveTab(
                      'orders'
                    )
                  }
                  activeOrders={
                    activeOrders
                  }
                  pricing={pricing}
                />
              )}

              {activeTab ===
                'orders' && (
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
                'ai' && (
                <TrustlineAI
                  onTransferToOrder={
                    handleTransferFromAI
                  }
                  orders={myOrders}
                />
              )}

              {activeTab ===
                'profile' && (
                <ProfileView
                  currentUser={
                    currentUser
                  }
                  onSwitchUser={() => {}}
                />
              )}
            </>
          )}

          {currentUser.role ===
            'courier' && (
            <>
              {activeTab ===
                'courier_panel' && (
                <CourierPanel
                  currentCourier={
                    currentUser
                  }
                  orders={orders}
                />
              )}

              {activeTab ===
                'profile' && (
                <ProfileView
                  currentUser={
                    currentUser
                  }
                  onSwitchUser={() => {}}
                />
              )}
            </>
          )}

          {currentUser.role ===
            'admin' && (
            <>
              {activeTab ===
                'admin_panel' && (
                <AdminPanel
                  orders={orders}
                  pricing={pricing}
                />
              )}

              {activeTab ===
                'profile' && (
                <ProfileView
                  currentUser={
                    currentUser
                  }
                  onSwitchUser={() => {}}
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
            setSelectedOrderId(
              null
            );
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
          setIsNewOrderOpen(
            false
          );
          setNewOrderPrefill(
            undefined
          );
        }}
        currentUser={currentUser}
        pricing={pricing}
        prefillData={
          newOrderPrefill
        }
        onOrderCreated={(
          newOrder
        ) => {
          setActiveTab(
            'orders'
          );

          setSelectedOrderId(
            newOrder.id
          );
        }}
      />

      <NotificationDrawer
        isOpen={
          isNotificationsOpen
        }
        onClose={() =>
          setIsNotificationsOpen(
            false
          )
        }
        notifications={
          notifications
        }
        userId={
          currentUser.id
        }
        onSelectOrder={(
          orderId
        ) => {
          setSelectedOrderId(
            orderId
          );

          setActiveTab(
            'orders'
          );
        }}
      />
    </div>
  );
}

export default App;