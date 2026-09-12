import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import { storage } from "./services/storage";

import {
  subscribeToAuth,
  handleGoogleRedirectResult,
  ensureUserProfile,
} from "./services/auth";

import { auth } from "./services/firebase";
import { signOut } from "firebase/auth";

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
import { LiveSupport } from "./components/LiveSupport";

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
        "Orders yÃ¼klenemedi:",
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
          "Pricing yÃ¼klenemedi:",
          error
        );

        return {
          perKmPrice: 36,
          minPrice: 250,
          urgentMultiplier: 1.3,
          vipMultiplier: 1.6,
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

  const [inactiveAccount, setInactiveAccount] =
    useState(false);

  const authResolved =
    useRef(false);

  const authStateResolved =
    useRef(false);

  const redirectCheckFinished =
    useRef(false);

  const mountedRef =
    useRef(true);

  const applyUserProfile = async (
    profile: UserProfile
  ) => {
    if (!mountedRef.current) {
      return;
    }

    const courierProfile =
      profile as UserProfile & {
        employmentStatus?:
          | "active"
          | "inactive";
      };

    if (
      profile.role === "courier" &&
      courierProfile.employmentStatus ===
        "inactive"
    ) {
      console.warn(
        "ğŸš« Pasif kurye hesabÄ± giriÅŸ yapmaya Ã§alÄ±ÅŸtÄ±:",
        {
          uid: profile.id,
          email: profile.email,
        }
      );

      try {
        storage.setCurrentUser(null);
      } catch (error) {
        console.warn(
          "âš ï¸ Pasif hesap iÃ§in storage temizlenemedi:",
          error
        );
      }

      setCurrentUser(null);
      setNotifications([]);
      setProfileLoading(false);
      setAuthLoading(false);
      setAppError(null);
      setInactiveAccount(true);

      try {
        await signOut(auth);
      } catch (error) {
        console.warn(
          "âš ï¸ Pasif kurye Firebase oturumu kapatÄ±lamadÄ±:",
          error
        );
      }

      return;
    }

    setInactiveAccount(false);

    console.log(
      "ğŸ‘¤ Trustline kullanÄ±cÄ± profili uygulanÄ±yor:",
      {
        uid: profile.id,
        email: profile.email,
        role: profile.role,
      }
    );

    try {
      storage.setCurrentUser(
        profile
      );
    } catch (error) {
      console.warn(
        "âš ï¸ Storage kullanÄ±cÄ± ayarlanamadÄ±:",
        error
      );
    }

    setCurrentUser(
      profile
    );

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
    } catch (error) {
      console.warn(
        "âš ï¸ Bildirimler yÃ¼klenemedi:",
        error
      );

      setNotifications([]);
    }

    if (
      profile.role ===
      "customer"
    ) {
      setActiveTab("home");
    } else if (
      profile.role ===
      "courier"
    ) {
      setActiveTab(
        "courier_panel"
      );
    } else if (
      profile.role ===
      "admin"
    ) {
      setActiveTab(
        "admin_panel"
      );
    }

    setProfileLoading(false);
    setAuthLoading(false);
    setAppError(null);

    authResolved.current =
      true;

    console.log(
      "ğŸš€ TRUSTLINE DASHBOARD HAZIR."
    );
  };

  useEffect(() => {
    mountedRef.current = true;

    let unsubscribe:
      | (() => void)
      | undefined;

    unsubscribe =
      subscribeToAuth(
        async (
          firebaseUser
        ) => {
          if (
            !mountedRef.current
          ) {
            return;
          }

          console.log(
            "ğŸ”„ App Auth callback:",
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

          if (!firebaseUser) {
            authStateResolved.current =
              true;

            console.log(
              "â„¹ï¸ Firebase Auth kullanÄ±cÄ±sÄ± yok. Login ekranÄ±na geÃ§iliyor."
            );

            if (
              authResolved.current &&
              currentUser !== null
            ) {
              console.log(
                "âš ï¸ KullanÄ±cÄ± zaten doÄŸrulandÄ±. Auth null geÃ§ici olarak yok sayÄ±lÄ±yor."
              );

              return;
            }

            if (
              inactiveAccount
            ) {
              setAuthLoading(false);
              setProfileLoading(false);
              setCurrentUser(null);
              setNotifications([]);
              setAppError(null);

              return;
            }

            try {
              storage.setCurrentUser(
                null
              );
            } catch {
              // ignore
            }

            setCurrentUser(
              null
            );

            setNotifications(
              []
            );

            setProfileLoading(
              false
            );

            setAuthLoading(
              false
            );

            setAppError(
              null
            );

            return;
          }

          authResolved.current =
            true;

          authStateResolved.current =
            true;

          console.log(
            "ğŸŸ¢ Firebase Authentication kullanÄ±cÄ±sÄ± bulundu:",
            {
              uid:
                firebaseUser.uid,

              email:
                firebaseUser.email,

              verified:
                firebaseUser.emailVerified,

              providers:
                firebaseUser.providerData.map(
                  (
                    provider
                  ) =>
                    provider.providerId
                ),
            }
          );

          const isGoogleUser =
            firebaseUser.providerData.some(
              (
                provider
              ) =>
                provider.providerId ===
                "google.com"
            );

          if (
            !isGoogleUser &&
            !firebaseUser.emailVerified
          ) {
            console.warn(
              "âš ï¸ E-posta doÄŸrulanmamÄ±ÅŸ."
            );

            try {
              storage.setCurrentUser(
                null
              );
            } catch {
              // ignore
            }

            setCurrentUser(
              null
            );

            setNotifications(
              []
            );

            setProfileLoading(
              false
            );

            setAuthLoading(
              false
            );

            setAppError(
              null
            );

            return;
          }

          setAuthLoading(
            false
          );

          setProfileLoading(
            true
          );

          setAppError(
            null
          );

          try {
            console.log(
              "ğŸ‘¤ Firestore kullanÄ±cÄ± profili hazÄ±rlanÄ±yor:",
              {
                uid:
                  firebaseUser.uid,

                email:
                  firebaseUser.email,

                google:
                  isGoogleUser,
              }
            );

            const profile =
              await ensureUserProfile(
                firebaseUser
              );

            if (
              !mountedRef.current
            ) {
              return;
            }

            console.log(
              "âœ… Firestore kullanÄ±cÄ± profili hazÄ±r:",
              {
                uid:
                  profile.id,

                email:
                  profile.email,

                role:
                  profile.role,

                employmentStatus:
                  (
                    profile as UserProfile & {
                      employmentStatus?:
                        | "active"
                        | "inactive";
                    }
                  )
                    .employmentStatus ??
                  "active",
              }
            );

            await applyUserProfile(
              profile
            );
          } catch (error) {
            if (
              !mountedRef.current
            ) {
              return;
            }

            console.error(
              "âŒ KullanÄ±cÄ± profili hazÄ±rlanamadÄ±:",
              error
            );

            setProfileLoading(
              false
            );

            setAuthLoading(
              false
            );

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

            if (
              code ===
                "auth/email-not-verified" ||
              code ===
                "auth/email-verification-required"
            ) {
              try {
                storage.setCurrentUser(
                  null
                );
              } catch {
                // ignore
              }

              setCurrentUser(
                null
              );

              setNotifications(
                []
              );

              setAppError(
                null
              );

              return;
            }

            if (
              code ===
              "permission-denied"
            ) {
              setCurrentUser(
                null
              );

              setAppError(
                "KullanÄ±cÄ± hesabÄ± bulundu ancak Firestore kullanÄ±cÄ± profiline eriÅŸilemiyor. Firebase Firestore Rules kontrol edilmeli."
              );

              return;
            }

            setCurrentUser(
              null
            );

            setAppError(
              "KullanÄ±cÄ± profili hazÄ±rlanÄ±rken bir hata oluÅŸtu. LÃ¼tfen tekrar deneyin."
            );
          }
        }
      );

    const initializeRedirect =
      async () => {
        console.log(
          "ğŸš€ Trustline Google redirect kontrolÃ¼ baÅŸlatÄ±lÄ±yor..."
        );

        try {
          const redirectProfile =
            await handleGoogleRedirectResult();

          if (
            !mountedRef.current
          ) {
            return;
          }

          if (
            redirectProfile
          ) {
            console.log(
              "ğŸŸ¢ GOOGLE REDIRECT PROFÄ°LÄ° BULUNDU:",
              {
                uid:
                  redirectProfile.id,

                email:
                  redirectProfile.email,

                role:
                  redirectProfile.role,

                employmentStatus:
                  (
                    redirectProfile as UserProfile & {
                      employmentStatus?:
                        | "active"
                        | "inactive";
                    }
                  )
                    .employmentStatus ??
                  "active",
              }
            );

            authResolved.current =
              true;

            await applyUserProfile(
              redirectProfile
            );
          } else {
            console.log(
              "â„¹ï¸ Google redirect sonucu bulunamadÄ±."
            );
          }
        } catch (error) {
          if (
            !mountedRef.current
          ) {
            return;
          }

          console.error(
            "âŒ Google redirect iÅŸlemi baÅŸarÄ±sÄ±z:",
            error
          );
        } finally {
          if (
            mountedRef.current
          ) {
            redirectCheckFinished.current =
              true;

            console.log(
              "ğŸ Google redirect kontrolÃ¼ tamamlandÄ±."
            );

            if (
              authStateResolved.current &&
              !auth.currentUser &&
              !authResolved.current &&
              !inactiveAccount
            ) {
              console.log(
                "ğŸ”’ Redirect kullanÄ±cÄ± bulamadÄ± ve Firebase Auth kullanÄ±cÄ±sÄ± yok."
              );

              setCurrentUser(
                null
              );

              setNotifications(
                []
              );

              setProfileLoading(
                false
              );

              setAuthLoading(
                false
              );

              setAppError(
                null
              );
            }
          }
        }
      };

    void initializeRedirect();

    return () => {
      mountedRef.current =
        false;

      try {
        unsubscribe?.();
      } catch (error) {
        console.warn(
          "Auth listener kapatÄ±lamadÄ±:",
          error
        );
      }
    };
  }, []);

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
              "Orders listener hatasÄ±:",
              error
            );
          }

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
              "Pricing listener hatasÄ±:",
              error
            );
          }

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
                "Notification listener hatasÄ±:",
                error
              );
            }
          } else {
            setNotifications([]);
          }
        });
    } catch (error) {
      console.error(
        "Storage listener baÅŸlatÄ±lamadÄ±:",
        error
      );
    }

    return () => {
      mounted = false;

      try {
        unsubscribe?.();
      } catch (error) {
        console.warn(
          "Storage listener kapatÄ±lamadÄ±:",
          error
        );
      }
    };
  }, [currentUser?.id]);

  const handleOpenNewOrder = (
    prefill?: Partial<Order>
  ) => {
    setNewOrderPrefill(
      prefill
    );

    setIsNewOrderOpen(
      true
    );
  };

  const handleTransferFromAI = (
    draft: Partial<Order>
  ) => {
    handleOpenNewOrder(
      draft
    );

    setActiveTab(
      "home"
    );
  };

  if (
    authLoading &&
    !inactiveAccount
  ) {
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
            GÃ¼venli baÄŸlantÄ± kuruluyor...
          </p>
        </div>
      </div>
    );
  }

  if (
    profileLoading &&
    !currentUser &&
    !inactiveAccount
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
            Hesap hazÄ±rlanÄ±yor
          </h2>

          <p className="mt-2 text-xs text-[#999999]">
            Hesap bilgileriniz yÃ¼kleniyor...
          </p>

          <div className="mx-auto mt-5 h-1.5 w-32 overflow-hidden rounded-full bg-[#303036]">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[#D6A84F]" />
          </div>
        </div>
      </div>
    );
  }

  if (
    inactiveAccount
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0B0B0D] px-5 text-white">
        <div className="w-full max-w-md rounded-3xl border border-[#D6A84F]/30 bg-[#19191E] p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#D6A84F]/15">
            <span className="text-2xl font-black text-[#D6A84F]">
              T
            </span>
          </div>

          <div className="mt-5 text-sm font-black tracking-[0.2em] text-[#D6A84F]">
            TRUSTLINE
          </div>

          <div className="mt-1 text-[10px] tracking-[0.3em] text-[#888888]">
            EXPRESS
          </div>

          <h2 className="mt-7 text-xl font-black text-white">
            HesabÄ±nÄ±z pasife alÄ±nmÄ±ÅŸtÄ±r
          </h2>

          <p className="mt-3 text-sm leading-6 text-[#999999]">
            Kurye hesabÄ±nÄ±z ÅŸu anda aktif deÄŸildir.
            <br />
            LÃ¼tfen yÃ¶netici ile iletiÅŸime geÃ§in.
          </p>

          <button
            type="button"
            onClick={() => {
              setInactiveAccount(false);
              setAppError(null);
              setCurrentUser(null);
              setActiveTab("home");
            }}
            className="mt-7 w-full rounded-2xl bg-[#D6A84F] px-6 py-3 text-sm font-black text-[#0B0B0D] transition hover:opacity-90"
          >
            GiriÅŸ EkranÄ±na DÃ¶n
          </button>
        </div>
      </div>
    );
  }

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
            BaÄŸlantÄ± HatasÄ±
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

  if (!currentUser) {
    return (
      <AuthScreen
        onLogin={(
          profile
        ) => {
          console.log(
            "ğŸŸ¢ AuthScreen Google profili App'e ulaÅŸtÄ±:",
            {
              uid:
                profile.id,

              email:
                profile.email,

              role:
                profile.role,

              employmentStatus:
                (
                  profile as UserProfile & {
                    employmentStatus?:
                      | "active"
                      | "inactive";
                  }
                )
                  .employmentStatus ??
                "active",
            }
          );

          authResolved.current =
            true;

          redirectCheckFinished.current =
            true;

          void applyUserProfile(
            profile
          );
        }}
      />
    );
  }

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
          "Ä°ptal Edildi"
    );

  const unreadNotificationsCount =
    notifications.filter(
      (notification) =>
        !notification.read
    ).length;

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
            setIsNotificationsOpen(
              true
            )
          }
          isIPhoneMode={
            isIPhoneMode
          }
          onToggleIPhoneMode={() =>
            setIsIPhoneMode(
              (value) => !value
            )
          }
          activeTab={
            activeTab
          }
        />

        <main
          className={`flex-1 overflow-y-auto px-4 py-5 ${
            isIPhoneMode
              ? "max-h-[740px]"
              : "lg:pl-60"
          }`}
        >
          {currentUser.role ===
            "customer" && (
            <>
              {activeTab ===
                "home" && (
                <>
                  <CustomerHome
                    onOpenNewOrder={
                      handleOpenNewOrder
                    }
                    onOpenAI={() =>
                      setActiveTab(
                        "ai"
                      )
                    }
                    onGoToOrders={() =>
                      setActiveTab(
                        "orders"
                      )
                    }
                    activeOrders={
                      activeOrders
                    }
                    pricing={
                      pricing
                    }
                  />

                  <LiveSupport embedded />
                </>
              )}

              {activeTab ===
                "orders" && (
                <CustomerOrders
                  orders={
                    myOrders
                  }
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
                  orders={
                    myOrders
                  }
                  pricing={
                    pricing
                  }
                />
              )}

              {activeTab ===
                "profile" && (
                <ProfileView
                  currentUser={
                    currentUser
                  }
                  onProfileUpdated={
                    setCurrentUser
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
                  orders={
                    safeOrders
                  }
                />
              )}

              {activeTab ===
                "profile" && (
                <ProfileView
                  currentUser={
                    currentUser
                  }
                  onProfileUpdated={
                    setCurrentUser
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
                  orders={
                    safeOrders
                  }
                  pricing={
                    pricing
                  }
                />
              )}

              {activeTab ===
                "profile" && (
                <ProfileView
                  currentUser={
                    currentUser
                  }
                  onProfileUpdated={
                    setCurrentUser
                  }
                />
              )}
            </>
          )}
        </main>

        <BottomNavigation
          role={
            currentUser.role
          }
          activeTab={
            activeTab
          }
          onTabChange={(
            tab
          ) => {
            setActiveTab(
              tab
            );

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
          isIPhoneMode={
            isIPhoneMode
          }
        />
      </div>

      <NewOrderModal
        isOpen={
          isNewOrderOpen
        }
        onClose={() => {
          setIsNewOrderOpen(
            false
          );

          setNewOrderPrefill(
            undefined
          );
        }}
        currentUser={
          currentUser
        }
        pricing={
          pricing
        }
        prefillData={
          newOrderPrefill
        }
        onOrderCreated={(
          order
        ) => {
          setActiveTab(
            "orders"
          );

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

