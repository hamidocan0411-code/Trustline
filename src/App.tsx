import React, { useEffect, useState } from 'react';

import { storage } from './services/storage';
import {
  subscribeToAuth,
  ensureUserProfile,
} from './services/auth';

import type {
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
import { AuthScreen } from './components/AuthScreen';

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
    useState('home');

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

  /*
   * ==========================================
   * FIREBASE AUTH
   * ==========================================
   */

  useEffect(() => {
    let mounted = true;

    const unsubscribe = subscribeToAuth(
      async (firebaseUser) => {
        if (!mounted) return;

        try {
          if (!firebaseUser) {
            setCurrentUser(null);
            setNotifications([]);
            setAuthLoading(false);
            return;
          }

          const resolvedProfile =
            await ensureUserProfile(firebaseUser);

          if (!mounted) return;

          setCurrentUser(resolvedProfile);

          storage.setCurrentUser(
            resolvedProfile
          );

          setNotifications(
            storage.getNotifications(
              resolvedProfile.id
            )
          );

          if (
            resolvedProfile.role ===
            'customer'
          ) {
            setActiveTab('home');
          }

          if (
            resolvedProfile.role ===
            'courier'
          ) {
            setActiveTab(
              'courier_panel'
            );
          }

          if (
            resolvedProfile.role ===
            'admin'
          ) {
            setActiveTab(
              'admin_panel'
            );
          }

          setAuthLoading(false);
        } catch (error) {
          console.error(
            'Trustline auth/profile error:',
            error
          );

          if (!mounted) return;

          setCurrentUser(null);
          setNotifications([]);
          setAuthLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  /*
   * ==========================================
   * STORAGE LISTENER
   * ==========================================
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
    setActiveTab('home');
  };

  /*
   * ==========================================
   * AUTH LOADING
   * ==========================================
   */

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B0B0D] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#D6A84F] flex items-center justify-center mx-auto mb-5">
            <span className="text-[#0B0B0D] font-black text-3xl">
              T
            </span>
          </div>

          <div className="text-[#D6A84F] font-black tracking-[0.2em] text-sm">
            TRUSTLINE
          </div>

          <div className="text-[#888888] text-[10px] tracking-[0.3em] mt-1">
            EXPRESS
          </div>

          <p className="text-[#666666] text-xs mt-4">
            Güvenli bağlantı kuruluyor...
          </p>
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
    return (
      <AuthScreen />
    );
  }

  /*
   * ==========================================
   * USER ORDERS
   * ==========================================
   */

  const myOrders =
    currentUser.role === 'customer'
      ? orders.filter(
          (order) =>
            order.customerId ===
            currentUser.id
        )
      : currentUser.role === 'courier'
      ? orders.filter(
          (order) =>
            order.courierId ===
            currentUser.id
        )
      : orders;

  const activeOrders =
    myOrders.filter(
      (order) =>
        order.status !==
          'Teslim Edildi' &&
        order.status !==
          'İptal Edildi'
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
      className={`min-h-screen bg-[#0B0B0D] text-white flex flex-col ${
        isIPhoneMode
          ? 'py-4 px-2 items-center justify-center'
          : ''
      }`}
    >
      <div
        className={`w-full flex flex-col ${
          isIPhoneMode
            ? 'max-w-[390px] h-[820px] bg-[#19191E] rounded-[48px] border-[8px] border-[#222229] overflow-hidden shadow-2xl'
            : 'min-h-screen'
        }`}
      >
        {isIPhoneMode && (
          <div className="h-8 bg-[#0B0B0D] flex items-center justify-center shrink-0">
            <div className="w-28 h-5 bg-[#222229] rounded-b-xl" />
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
          isIPhoneMode={
            isIPhoneMode
          }
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
              ? 'max-h-[740px]'
              : ''
          }`}
        >
          {/* CUSTOMER */}
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
                    setActiveTab(
                      'ai'
                    )
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
                />
              )}
            </>
          )}

          {/* COURIER */}
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
                />
              )}
            </>
          )}

          {/* ADMIN */}
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

      {/* NEW ORDER */}
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
          setActiveTab('orders');
          setSelectedOrderId(
            order.id
          );
        }}
      />

      {/* NOTIFICATIONS */}
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
        onSelectOrder={(orderId) => {
          setSelectedOrderId(
            orderId
          );
          setActiveTab('orders');
        }}
      />
    </div>
  );
}

export default App;