import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { storage } from "./services/storage";
import { subscribeToAuth, handleGoogleRedirectResult, ensureUserProfile } from "./services/auth";
import { auth } from "./services/firebase";
import { signOut } from "firebase/auth";
import type { NotificationItem, Order, PricingConfig, UserProfile } from "./types";

const Navbar = lazy(() => import("./components/Navbar").then((m) => ({ default: m.Navbar })));
const BottomNavigation = lazy(() => import("./components/BottomNavigation").then((m) => ({ default: m.BottomNavigation })));
const CustomerHome = lazy(() => import("./components/CustomerHome").then((m) => ({ default: m.CustomerHome })));
const CustomerOrders = lazy(() => import("./components/CustomerOrders").then((m) => ({ default: m.CustomerOrders })));
const TrustlineAI = lazy(() => import("./components/TrustlineAI").then((m) => ({ default: m.TrustlineAI })));
const CourierPanel = lazy(() => import("./components/CourierPanel").then((m) => ({ default: m.CourierPanel })));
const AdminPanel = lazy(() => import("./components/AdminPanel").then((m) => ({ default: m.AdminPanel })));
const ProfileView = lazy(() => import("./components/ProfileView").then((m) => ({ default: m.ProfileView })));
const NewOrderModal = lazy(() => import("./components/NewOrderModal").then((m) => ({ default: m.NewOrderModal })));
const PharmacyOrderPanel = lazy(() => import("./components/PharmacyOrderPanel").then((m) => ({ default: m.PharmacyOrderPanel })));
const NotificationDrawer = lazy(() => import("./components/NotificationDrawer").then((m) => ({ default: m.NotificationDrawer })));
const AuthScreen = lazy(() => import("./components/AuthScreen").then((m) => ({ default: m.AuthScreen })));
const LiveSupport = lazy(() => import("./components/LiveSupport").then((m) => ({ default: m.LiveSupport })));

export function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>(() => { try { const savedOrders = storage.getOrders(); return Array.isArray(savedOrders) ? savedOrders : []; } catch (error) { console.error("Orders yüklenemedi:", error); return []; } });
  const [pricing, setPricing] = useState<PricingConfig>(() => { try { return storage.getPricing(); } catch (error) { console.error("Pricing yüklenemedi:", error); return { perKmPrice: 20, minPrice: 100, urgentMultiplier: 1.5, vipMultiplier: 2, requireDeliveryPhoto: false, updatedAt: new Date().toISOString() }; } });
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("home");
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isPharmacyOrderOpen, setIsPharmacyOrderOpen] = useState(false);
  const [newOrderPrefill, setNewOrderPrefill] = useState<Partial<Order> | undefined>();
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [isIPhoneMode, setIsIPhoneMode] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [inactiveAccount, setInactiveAccount] = useState(false);
  const authResolved = useRef(false);
  const authStateResolved = useRef(false);
  const redirectCheckFinished = useRef(false);
  const mountedRef = useRef(true);

  const applyUserProfile = async (profile: UserProfile) => {
    if (!mountedRef.current) return;
    const courierProfile = profile as UserProfile & { employmentStatus?: "active" | "inactive" };
    if (profile.role === "courier" && courierProfile.employmentStatus === "inactive") {
      try { storage.setCurrentUser(null); } catch (error) { console.warn("⚠️ Pasif hesap için storage temizlenemedi:", error); }
      setCurrentUser(null); setNotifications([]); setProfileLoading(false); setAuthLoading(false); setAppError(null); setInactiveAccount(true);
      try { await signOut(auth); } catch (error) { console.warn("⚠️ Pasif kurye Firebase oturumu kapatılamadı:", error); }
      return;
    }
    setInactiveAccount(false);
    try { storage.setCurrentUser(profile); } catch (error) { console.warn("⚠️ Storage kullanıcı ayarlanamadı:", error); }
    setCurrentUser(profile);
    try { const userNotifications = storage.getNotifications(profile.id); setNotifications(Array.isArray(userNotifications) ? userNotifications : []); } catch (error) { console.warn("⚠️ Bildirimler yüklenemedi:", error); setNotifications([]); }
    if (profile.role === "customer") setActiveTab("home"); else if (profile.role === "courier") setActiveTab("courier_panel"); else if (profile.role === "admin") setActiveTab("admin_panel");
    setProfileLoading(false); setAuthLoading(false); setAppError(null); authResolved.current = true;
  };

  useEffect(() => {
    mountedRef.current = true;
    const unsubscribe = subscribeToAuth(async (firebaseUser) => {
      if (!mountedRef.current) return;
      if (!firebaseUser) {
        authStateResolved.current = true;
        if (authResolved.current && currentUser !== null) return;
        if (inactiveAccount) { setAuthLoading(false); setProfileLoading(false); setCurrentUser(null); setNotifications([]); setAppError(null); return; }
        try { storage.setCurrentUser(null); } catch {}
        setCurrentUser(null); setNotifications([]); setProfileLoading(false); setAuthLoading(false); setAppError(null); return;
      }
      authResolved.current = true; authStateResolved.current = true;
      const isGoogleUser = firebaseUser.providerData.some((provider) => provider.providerId === "google.com");
      if (!isGoogleUser && !firebaseUser.emailVerified) { try { storage.setCurrentUser(null); } catch {} setCurrentUser(null); setNotifications([]); setProfileLoading(false); setAuthLoading(false); setAppError(null); return; }
      setAuthLoading(false); setProfileLoading(true); setAppError(null);
      try { const profile = await ensureUserProfile(firebaseUser); if (!mountedRef.current) return; await applyUserProfile(profile); }
      catch (error) {
        if (!mountedRef.current) return;
        setProfileLoading(false); setAuthLoading(false);
        const code = typeof error === "object" && error !== null && "code" in error ? String((error as { code?: unknown }).code) : "";
        if (code === "auth/email-not-verified" || code === "auth/email-verification-required") { try { storage.setCurrentUser(null); } catch {} setCurrentUser(null); setNotifications([]); setAppError(null); return; }
        if (code === "permission-denied") { setCurrentUser(null); setAppError("Kullanıcı hesabı bulundu ancak Firestore kullanıcı profiline erişilemiyor. Firebase Firestore Rules kontrol edilmeli."); return; }
        setCurrentUser(null); setAppError("Kullanıcı profili hazırlanırken bir hata oluştu. Lütfen tekrar deneyin.");
      }
    });
    const initializeRedirect = async () => {
      try { const redirectProfile = await handleGoogleRedirectResult(); if (!mountedRef.current) return; if (redirectProfile) { authResolved.current = true; await applyUserProfile(redirectProfile); } }
      catch (error) { if (mountedRef.current) console.error("❌ Google redirect işlemi başarısız:", error); }
      finally { if (mountedRef.current) { redirectCheckFinished.current = true; if (authStateResolved.current && !auth.currentUser && !authResolved.current && !inactiveAccount) { setCurrentUser(null); setNotifications([]); setProfileLoading(false); setAuthLoading(false); setAppError(null); } } }
    };
    void initializeRedirect();
    return () => { mountedRef.current = false; try { unsubscribe?.(); } catch (error) { console.warn("Auth listener kapatılamadı:", error); } };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setOrders([]);
      setNotifications([]);
      return;
    }

    let mounted = true; let unsubscribe: (() => void) | undefined;
    try { unsubscribe = storage.subscribe(() => { if (!mounted) return; try { const nextOrders = storage.getOrders(); setOrders(Array.isArray(nextOrders) ? nextOrders : []); } catch (error) { console.error("Orders listener hatası:", error); } try { const nextPricing = storage.getPricing(); if (nextPricing) setPricing(nextPricing); } catch (error) { console.error("Pricing listener hatası:", error); } try { const nextNotifications = storage.getNotifications(currentUser.id); setNotifications(Array.isArray(nextNotifications) ? nextNotifications : []); } catch (error) { console.error("Notification listener hatası:", error); setNotifications([]); } }); } catch (error) { console.error("Storage listener başlatılamadı:", error); }
    return () => { mounted = false; try { unsubscribe?.(); } catch (error) { console.warn("Storage listener kapatılamadı:", error); } };
  }, [currentUser?.id]);

  const handleOpenNewOrder = (prefill?: Partial<Order>) => { setNewOrderPrefill(prefill); setIsNewOrderOpen(true); };
  const handleOpenPharmacyOrder = () => { if (currentUser?.role !== "customer") return; setIsPharmacyOrderOpen(true); };
  const handleTransferFromAI = (draft: Partial<Order>) => { handleOpenNewOrder(draft); setActiveTab("home"); };

  if (authLoading && !inactiveAccount) return <div className="flex min-h-screen items-center justify-center bg-[#0B0B0D] text-white"><div className="text-center"><div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D6A84F]"><span className="text-3xl font-black text-[#0B0B0D]">T</span></div><div className="text-sm font-black tracking-[0.2em] text-[#D6A84F]">TRUSTLINE</div><div className="mt-1 text-[10px] tracking-[0.3em] text-[#888888]">EXPRESS</div><p className="mt-4 text-xs text-[#666666]">Güvenli bağlantı kuruluyor...</p></div></div>;
  if (profileLoading && !currentUser && !inactiveAccount) return <div className="flex min-h-screen items-center justify-center bg-[#0B0B0D] text-white"><div className="w-full max-w-sm rounded-3xl border border-[#303036] bg-[#19191E] p-8 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D6A84F]/15"><span className="text-2xl font-black text-[#D6A84F]">T</span></div><h2 className="mt-5 text-lg font-bold text-white">Hesap hazırlanıyor</h2><p className="mt-2 text-xs text-[#999999]">Hesap bilgileriniz yükleniyor...</p><div className="mx-auto mt-5 h-1.5 w-32 overflow-hidden rounded-full bg-[#303036]"><div className="h-full w-1/2 animate-pulse rounded-full bg-[#D6A84F]" /></div></div></div>;
  if (inactiveAccount) return <div className="flex min-h-screen items-center justify-center bg-[#0B0B0D] px-5 text-white"><div className="w-full max-w-md rounded-3xl border border-[#D6A84F]/30 bg-[#19191E] p-8 text-center shadow-2xl"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D6A84F]/15"><span className="text-2xl font-black text-[#D6A84F]">T</span></div><div className="mt-5 text-sm font-black tracking-[0.2em] text-[#D6A84F]">TRUSTLINE</div><div className="mt-1 text-[10px] tracking-[0.3em] text-[#888888]">EXPRESS</div><h2 className="mt-7 text-xl font-black text-white">Hesabınız pasife alınmıştır</h2><p className="mt-3 text-sm leading-6 text-[#999999]">Kurye hesabınız şu anda aktif değildir.<br />Lütfen yönetici ile iletişime geçin.</p><button type="button" onClick={() => { setInactiveAccount(false); setAppError(null); setCurrentUser(null); setActiveTab("home"); }} className="mt-7 w-full rounded-2xl bg-[#D6A84F] px-6 py-3 text-sm font-black text-[#0B0B0D] transition hover:opacity-90">Giriş Ekranına Dön</button></div></div>;
  if (appError && !currentUser) return <div className="flex min-h-screen items-center justify-center bg-[#0B0B0D] px-5 text-white"><div className="w-full max-w-md rounded-3xl border border-red-500/30 bg-[#19191E] p-8 text-center"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-400">!</div><h2 className="mt-4 text-lg font-bold">Bağlantı Hatası</h2><p className="mt-2 text-sm text-[#999999]">{appError}</p><button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-2xl bg-[#D6A84F] px-6 py-3 text-sm font-black text-[#0B0B0D]">Tekrar Dene</button></div></div>;
  if (!currentUser) return <Suspense fallback={<div className="min-h-screen bg-[#0B0B0D]" />}><AuthScreen onLogin={(profile) => { authResolved.current = true; redirectCheckFinished.current = true; void applyUserProfile(profile); }} /></Suspense>;

  const safeOrders = Array.isArray(orders) ? orders : [];
  const myOrders = currentUser.role === "customer" ? safeOrders.filter((order) => order.customerId === currentUser.id) : currentUser.role === "courier" ? safeOrders.filter((order) => order.courierId === currentUser.id) : safeOrders;
  const activeOrders = myOrders.filter((order) => order.status !== "Teslim Edildi" && order.status !== "İptal Edildi");
  const unreadNotificationsCount = notifications.filter((notification) => !notification.read).length;

  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-[#0B0B0D] text-white"><div className="text-sm font-bold text-[#D6A84F]">TrustLine yükleniyor...</div></div>}><div className={`flex min-h-screen flex-col bg-[#0B0B0D] text-white ${isIPhoneMode ? "items-center justify-center px-2 py-4" : ""}`}><div className={`flex w-full flex-col ${isIPhoneMode ? "h-[820px] max-w-[390px] overflow-hidden rounded-[48px] border-[8px] border-[#222229] bg-[#19191E] shadow-2xl" : "min-h-screen"}`}>{isIPhoneMode && <div className="flex h-8 shrink-0 items-center justify-center bg-[#0B0B0D]"><div className="h-5 w-28 rounded-b-xl bg-[#222229]" /></div>}<Navbar currentUser={currentUser} unreadNotificationsCount={unreadNotificationsCount} onOpenNotifications={() => setIsNotificationsOpen(true)} isIPhoneMode={isIPhoneMode} onToggleIPhoneMode={() => setIsIPhoneMode((value) => !value)} activeTab={activeTab} /><main className={`flex-1 overflow-y-auto px-4 py-5 ${isIPhoneMode ? "max-h-[740px]" : "lg:pl-60"}`}>{currentUser.role === "customer" && <>{activeTab === "home" && <><CustomerHome onOpenNewOrder={handleOpenNewOrder} onOpenPharmacyOrder={handleOpenPharmacyOrder} onOpenAI={() => setActiveTab("ai")} onGoToOrders={() => setActiveTab("orders")} activeOrders={activeOrders} pricing={pricing} /><div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-3 right-3 z-30 lg:static lg:z-auto lg:left-auto lg:right-auto lg:bottom-auto"><LiveSupport embedded /></div></>}{activeTab === "orders" && <CustomerOrders orders={myOrders} onOpenNewOrder={handleOpenNewOrder} selectedOrderId={selectedOrderId} />}{activeTab === "ai" && <TrustlineAI onTransferToOrder={handleTransferFromAI} orders={myOrders} pricing={pricing} />}{activeTab === "profile" && <ProfileView currentUser={currentUser} onProfileUpdated={setCurrentUser} />}</>}{currentUser.role === "courier" && <>{activeTab === "courier_panel" && <CourierPanel currentCourier={currentUser} orders={safeOrders} />}{activeTab === "profile" && <ProfileView currentUser={currentUser} onProfileUpdated={setCurrentUser} />}</>}{currentUser.role === "admin" && <>{activeTab === "admin_panel" && <AdminPanel orders={safeOrders} pricing={pricing} />}{activeTab === "profile" && <ProfileView currentUser={currentUser} onProfileUpdated={setCurrentUser} />}</>}</main><BottomNavigation role={currentUser.role} activeTab={activeTab} onTabChange={(tab) => { setActiveTab(tab); setSelectedOrderId(null); }} onOpenNewOrder={() => handleOpenNewOrder()} activeOrdersCount={activeOrders.length} isIPhoneMode={isIPhoneMode} /></div><NewOrderModal isOpen={isNewOrderOpen} onClose={() => { setIsNewOrderOpen(false); setNewOrderPrefill(undefined); }} currentUser={currentUser} pricing={pricing} prefillData={newOrderPrefill} onOrderCreated={(order) => { setActiveTab("orders"); setSelectedOrderId(order.id); }} /><PharmacyOrderPanel isOpen={isPharmacyOrderOpen} onClose={() => setIsPharmacyOrderOpen(false)} currentUser={currentUser} pricing={pricing} onOrderCreated={(order) => { setActiveTab("orders"); setSelectedOrderId(order.id); }} /><NotificationDrawer isOpen={isNotificationsOpen} onClose={() => setIsNotificationsOpen(false)} notifications={notifications} userId={currentUser.id} onSelectOrder={(orderId) => { setSelectedOrderId(orderId); setActiveTab(currentUser.role === "courier" ? "courier_panel" : "orders"); }} /></div></Suspense>;
}
export default App;
