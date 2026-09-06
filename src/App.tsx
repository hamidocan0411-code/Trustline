import React, { useEffect, useState } from 'react';
import { storage } from './services/storage';
import { NotificationItem, Order, PricingConfig, UserProfile } from './types';
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
  const [currentUser, setCurrentUser] = useState<UserProfile>(storage.getCurrentUser());
  const [orders, setOrders] = useState<Order[]>(storage.getOrders());
  const [pricing, setPricing] = useState<PricingConfig>(storage.getPricing());
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    storage.getNotifications(currentUser.id)
  );

  // Active View Tab
  const [activeTab, setActiveTab] = useState<string>('home');

  // Modals & Drawers
  const [isNewOrderOpen, setIsNewOrderOpen] = useState<boolean>(false);
  const [newOrderPrefill, setNewOrderPrefill] = useState<Partial<Order> | undefined>(undefined);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState<boolean>(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  // iPhone Preview Frame Mode
  const [isIPhoneMode, setIsIPhoneMode] = useState<boolean>(false);

  // Subscribe to storage changes for real-time reactivity
  useEffect(() => {
    const unsubscribe = storage.subscribe(() => {
      setOrders(storage.getOrders());
      setPricing(storage.getPricing());
      const updatedUser = storage.getCurrentUser();
      setCurrentUser(updatedUser);
      setNotifications(storage.getNotifications(updatedUser.id));
    });
    return () => unsubscribe();
  }, []);

  // Update notifications when currentUser changes
  useEffect(() => {
    setNotifications(storage.getNotifications(currentUser.id));
    // Reset to default role tab when role changes
    if (currentUser.role === 'customer') {
      setActiveTab('home');
    } else if (currentUser.role === 'courier') {
      setActiveTab('courier_panel');
    } else {
      setActiveTab('admin_panel');
    }
  }, [currentUser.id, currentUser.role]);

  const handleSwitchUser = (user: UserProfile) => {
    storage.setCurrentUser(user);
  };

  const handleOpenNewOrder = (prefill?: Partial<Order>) => {
    setNewOrderPrefill(prefill);
    setIsNewOrderOpen(true);
  };

  const handleTransferFromAI = (draft: Partial<Order>) => {
    handleOpenNewOrder(draft);
    setActiveTab('home');
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  const myOrders =
    currentUser.role === 'customer'
      ? orders.filter((o) => o.customerId === currentUser.id)
      : currentUser.role === 'courier'
      ? orders.filter((o) => o.courierId === currentUser.id)
      : orders;

  const activeOrders = myOrders.filter(
    (o) => !['Teslim Edildi', 'İptal Edildi'].includes(o.status)
  );

  return (
    <div
      className={`min-h-screen bg-[#0B0B0D] text-white flex flex-col font-sans transition-all ${
        isIPhoneMode ? 'py-4 sm:py-8 px-2 sm:px-4 items-center justify-center bg-zinc-950' : ''
      }`}
    >
      {/* Device wrapper if iPhone mode is active */}
      <div
        className={`w-full flex flex-col transition-all ${
          isIPhoneMode
            ? 'w-full max-w-[390px] h-[820px] bg-[#19191E] rounded-[48px] border-[8px] border-[#222229] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden relative'
            : 'min-h-screen'
        }`}
      >
        {/* iPhone status bar & notch from Elegant Dark Design */}
        {isIPhoneMode && (
          <>
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-[#222229] rounded-b-2xl z-50 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-black/60 border border-[#303036]/60" />
            </div>
            <div className="h-9 bg-[#0B0B0D] flex items-center justify-between px-7 text-[11px] text-[#999999] shrink-0 font-medium select-none z-40 border-b border-[#303036]/30">
              <span className="font-semibold text-white">09:41</span>
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-[10px]">5G</span>
                <div className="w-4 h-2 border border-[#999999] rounded-xs p-0.5">
                  <div className="w-full h-full bg-[#999999]" />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Global Navigation Header */}
        <Navbar
          currentUser={currentUser}
          onSwitchUser={handleSwitchUser}
          unreadNotificationsCount={unreadNotificationsCount}
          onOpenNotifications={() => setIsNotificationsOpen(true)}
          isIPhoneMode={isIPhoneMode}
          onToggleIPhoneMode={() => setIsIPhoneMode(!isIPhoneMode)}
          activeTab={activeTab}
        />

        {/* Dynamic Main View */}
        <main
          className={`flex-1 overflow-y-auto px-4 py-5 max-w-7xl w-full mx-auto ${
            isIPhoneMode ? 'overflow-y-auto max-h-[740px]' : ''
          }`}
        >
          {/* CUSTOMER VIEWS */}
          {currentUser.role === 'customer' && (
            <>
              {activeTab === 'home' && (
                <CustomerHome
                  onOpenNewOrder={handleOpenNewOrder}
                  onOpenAI={() => setActiveTab('ai')}
                  onGoToOrders={() => setActiveTab('orders')}
                  activeOrders={activeOrders}
                  pricing={pricing}
                />
              )}

              {activeTab === 'orders' && (
                <CustomerOrders
                  orders={myOrders}
                  onOpenNewOrder={handleOpenNewOrder}
                  selectedOrderId={selectedOrderId}
                />
              )}

              {activeTab === 'ai' && (
                <TrustlineAI onTransferToOrder={handleTransferFromAI} orders={myOrders} />
              )}

              {activeTab === 'profile' && (
                <ProfileView currentUser={currentUser} onSwitchUser={handleSwitchUser} />
              )}
            </>
          )}

          {/* COURIER VIEWS */}
          {currentUser.role === 'courier' && (
            <>
              {activeTab === 'courier_panel' && (
                <CourierPanel currentCourier={currentUser} orders={orders} />
              )}
              {activeTab === 'profile' && (
                <ProfileView currentUser={currentUser} onSwitchUser={handleSwitchUser} />
              )}
            </>
          )}

          {/* ADMIN VIEWS */}
          {currentUser.role === 'admin' && (
            <>
              {activeTab === 'admin_panel' && (
                <AdminPanel orders={orders} pricing={pricing} />
              )}
              {activeTab === 'profile' && (
                <ProfileView currentUser={currentUser} onSwitchUser={handleSwitchUser} />
              )}
            </>
          )}
        </main>

        {/* Bottom Mobile Navigation */}
        <BottomNavigation
          role={currentUser.role}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setSelectedOrderId(null);
          }}
          onOpenNewOrder={() => handleOpenNewOrder()}
          activeOrdersCount={activeOrders.length}
        />
      </div>

      {/* New Order Modal */}
      <NewOrderModal
        isOpen={isNewOrderOpen}
        onClose={() => {
          setIsNewOrderOpen(false);
          setNewOrderPrefill(undefined);
        }}
        currentUser={currentUser}
        pricing={pricing}
        prefillData={newOrderPrefill}
        onOrderCreated={(newOrder) => {
          setActiveTab('orders');
          setSelectedOrderId(newOrder.id);
        }}
      />

      {/* Notifications Drawer */}
      <NotificationDrawer
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        userId={currentUser.id}
        onSelectOrder={(orderId) => {
          setSelectedOrderId(orderId);
          setActiveTab('orders');
        }}
      />
    </div>
  );
}

export default App;
