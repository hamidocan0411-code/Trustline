import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  getApps,
  initializeApp,
} from "firebase/app";

import {
  db,
  auth,
  waitForAuthState,
} from "./firebase";

import type {
  CourierAvailability,
  CourierLocation,
  NotificationItem,
  Order,
  OrderStatus,
  PricingConfig,
  UserProfile,
} from "../types";

import {
  DEFAULT_PRICING,
} from "../utils/pricing";

/* ============================================================
   TYPES
============================================================ */

type Subscriber = () => void;

/* ============================================================
   CONSTANTS
============================================================ */

const ADMIN_EMAIL =
  "hamidocan0411@gmail.com";

const SECONDARY_APP_NAME =
  "TrustlineCourierCreator";

/* ============================================================
   STORAGE SERVICE
============================================================ */

class StorageService {
  /* ----------------------------------------------------------
     STATE
  ---------------------------------------------------------- */

  private currentUser:
    | UserProfile
    | null = null;

  private users: UserProfile[] = [];

  private orders: Order[] = [];

  private notifications:
    NotificationItem[] = [];

  private courierLocations:
    CourierLocation[] = [];

  private pricing:
    PricingConfig = {
      ...DEFAULT_PRICING,
    };

  /* ----------------------------------------------------------
     LISTENERS
  ---------------------------------------------------------- */

  private subscribers =
    new Set<Subscriber>();

  private firestoreUnsubscribers:
    Unsubscribe[] = [];

  private authUnsubscribe:
    | Unsubscribe
    | null = null;

  /* ----------------------------------------------------------
     INIT STATE
  ---------------------------------------------------------- */

  private initialized = false;

  private initializing = false;

  private activeUserId:
    | string
    | null = null;

  private activeRole:
    | string
    | null = null;

  /* ==========================================================
     INIT
  ========================================================== */

  async init(): Promise<void> {
    /*
     * Aynı anda birden fazla init çağrılmasını engelle.
     */
    if (this.initializing) {
      return;
    }

    /*
     * Auth listener zaten aktifse tekrar oluşturma.
     */
    if (this.initialized) {
      return;
    }

    this.initializing = true;

    try {
      console.log(
        "🔥 Storage init başlıyor..."
      );

      /*
       * Firebase Auth başlangıç durumunu bekle.
       */
      await waitForAuthState();

      /*
       * Global Auth listener.
       *
       * Login / Logout / Session restore durumlarını
       * merkezi olarak buradan yönetiyoruz.
       */
      this.authUnsubscribe =
        onAuthStateChanged(
          auth,
          async (firebaseUser) => {
            try {
              if (!firebaseUser) {
                console.log(
                  "🔒 Firebase kullanıcı yok. Storage temizleniyor."
                );

                this.handleLogout();

                return;
              }

              console.log(
                "🔐 Firebase kullanıcı bulundu:",
                firebaseUser.uid
              );

              await this.loadUserProfile(
                firebaseUser.uid
              );
            } catch (error) {
              console.error(
                "❌ Auth state işleme hatası:",
                error
              );
            }
          },
          (error) => {
            console.error(
              "❌ Auth listener hatası:",
              error
            );

            this.handleLogout();
          }
        );

      this.initialized = true;

      console.log(
        "🔥 Trustline Storage sistemi hazır."
      );
    } catch (error) {
      console.error(
        "❌ Storage init hatası:",
        error
      );
    } finally {
      this.initializing = false;

      this.emit();
    }
  }

  /* ==========================================================
     USER PROFILE LOAD
  ========================================================== */

  private async loadUserProfile(
    uid: string
  ): Promise<void> {
    try {
      const profileRef =
        doc(
          db,
          "users",
          uid
        );

      const profileSnapshot =
        await getDoc(profileRef);

      /*
       * Firebase Auth kullanıcısı var fakat
       * Firestore profili yoksa listener başlatma.
       */
      if (!profileSnapshot.exists()) {
        console.warn(
          "⚠️ Firebase Auth kullanıcısı var fakat users koleksiyonunda profil bulunamadı:",
          uid
        );

        this.cleanupFirestoreListeners();

        this.currentUser = null;

        this.activeUserId = null;
        this.activeRole = null;

        this.emit();

        return;
      }

      const profile: UserProfile = {
        ...(profileSnapshot.data() as UserProfile),
        id: profileSnapshot.id,
      };

      /*
       * Aynı kullanıcı ve aynı rol zaten aktifse
       * listener'ları yeniden oluşturma.
       */
      if (
        this.activeUserId === profile.id &&
        this.activeRole === profile.role &&
        this.currentUser
      ) {
        this.currentUser = profile;

        this.updateUserLocal(profile);

        this.emit();

        return;
      }

      console.log(
        "👤 Kullanıcı profili yüklendi:",
        {
          id: profile.id,
          email: profile.email,
          role: profile.role,
        }
      );

      this.currentUser = profile;

      this.activeUserId = profile.id;

      this.activeRole = profile.role;

      /*
       * Kullanıcı değiştiyse eski verileri temizle.
       */
      this.resetRealtimeData();

      /*
       * Aktif kullanıcıyı local listeye ekle.
       */
      this.updateUserLocal(
        profile
      );

      /*
       * Yeni kullanıcı listener'larını başlat.
       */
      this.startListeners(
        profile
      );

      this.emit();
    } catch (error) {
      console.error(
        "❌ Kullanıcı profili yüklenemedi:",
        error
      );

      throw error;
    }
  }

  /* ==========================================================
     START LISTENERS
  ========================================================== */

  private startListeners(
    profile: UserProfile
  ): void {
    /*
     * Her zaman önce eski listener'ları kapat.
     */
    this.cleanupFirestoreListeners();

    const uid =
      profile.id;

    const role =
      profile.role;

    console.log(
      "🔥 Firestore listener sistemi başlatılıyor:",
      {
        uid,
        role,
        email: profile.email,
      }
    );

    /* ========================================================
       USER LISTENER
    ======================================================== */

    this.startUserListener(
      profile
    );

    /* ========================================================
       ORDER LISTENER
    ======================================================== */

    this.startOrderListener(
      uid,
      role
    );

    /* ========================================================
       NOTIFICATION LISTENER
    ======================================================== */

    this.startNotificationListener(
      uid
    );

    /* ========================================================
       PRICING LISTENER
    ======================================================== */

    this.startPricingListener();

    /* ========================================================
       COURIER LOCATION LISTENER
    ======================================================== */

    this.startCourierLocationListener(
      uid,
      role
    );
  }

  /* ==========================================================
     USER LISTENER
  ========================================================== */

  private startUserListener(
    profile: UserProfile
  ): void {
    const uid =
      profile.id;

    const role =
      profile.role;

    /*
     * ADMIN:
     * Tüm kullanıcıları canlı dinler.
     */
    if (role === "admin") {
      const unsubscribe =
        onSnapshot(
          collection(
            db,
            "users"
          ),
          (snapshot) => {
            try {
              this.users =
                snapshot.docs.map(
                  (item) => ({
                    ...(item.data() as UserProfile),
                    id: item.id,
                  })
                );

              /*
               * currentUser'ı canlı güncel tut.
               */
              const updatedCurrentUser =
                this.users.find(
                  (user) =>
                    user.id === uid
                );

              if (updatedCurrentUser) {
                this.currentUser =
                  updatedCurrentUser;
              }

              console.log(
                "👑 ADMIN kullanıcılar güncellendi:",
                this.users.length
              );

              this.emit();
            } catch (error) {
              console.error(
                "❌ Admin users snapshot işleme hatası:",
                error
              );
            }
          },
          (error) => {
            console.error(
              "❌ Admin users listener hatası:",
              error
            );
          }
        );

      this.firestoreUnsubscribers.push(
        unsubscribe
      );

      return;
    }

    /*
     * CUSTOMER / COURIER:
     * Sadece kendi profilini dinler.
     */
    const unsubscribe =
      onSnapshot(
        doc(
          db,
          "users",
          uid
        ),
        (snapshot) => {
          try {
            /*
             * Kullanıcı profili silinmişse
             * güvenli şekilde logout state.
             */
            if (!snapshot.exists()) {
              console.warn(
                "⚠️ Kullanıcı profili artık mevcut değil:",
                uid
              );

              this.currentUser = null;

              this.emit();

              return;
            }

            const liveUser:
              UserProfile = {
                ...(snapshot.data() as UserProfile),
                id: snapshot.id,
              };

            const previousRole =
              this.currentUser?.role;

            /*
             * Rol değişmişse listener sistemini
             * yeni role göre yeniden başlat.
             */
            if (
              previousRole &&
              previousRole !== liveUser.role
            ) {
              console.log(
                "🔄 Kullanıcı rolü değişti:",
                {
                  oldRole:
                    previousRole,
                  newRole:
                    liveUser.role,
                  uid:
                    liveUser.id,
                }
              );

              this.currentUser =
                liveUser;

              this.activeRole =
                liveUser.role;

              this.updateUserLocal(
                liveUser
              );

              this.resetRealtimeData();

              this.startListeners(
                liveUser
              );

              this.emit();

              return;
            }

            /*
             * Normal profil güncellemesi.
             */
            this.currentUser =
              liveUser;

            this.updateUserLocal(
              liveUser
            );

            this.emit();
          } catch (error) {
            console.error(
              "❌ Kullanıcı snapshot işleme hatası:",
              error
            );
          }
        },
        (error) => {
          console.error(
            "❌ Kullanıcı profil listener hatası:",
            error
          );
        }
      );

    this.firestoreUnsubscribers.push(
      unsubscribe
    );
  }

  /* ==========================================================
     ORDER LISTENER
  ========================================================== */

  private startOrderListener(
    uid: string,
    role: string
  ): void {
    let ordersQuery;

    if (role === "admin") {
      ordersQuery =
        query(
          collection(
            db,
            "orders"
          )
        );

      console.log(
        "👑 ADMIN tüm siparişleri dinliyor."
      );
    } else if (
      role === "courier"
    ) {
      ordersQuery =
        query(
          collection(
            db,
            "orders"
          ),
          where(
            "courierId",
            "==",
            uid
          )
        );

      console.log(
        "🚴 KURYE siparişleri dinliyor."
      );
    } else {
      ordersQuery =
        query(
          collection(
            db,
            "orders"
          ),
          where(
            "customerId",
            "==",
            uid
          )
        );

      console.log(
        "👤 MÜŞTERİ siparişleri dinliyor."
      );
    }

    const unsubscribe =
      onSnapshot(
        ordersQuery,
        (snapshot) => {
          try {
            this.orders =
              snapshot.docs.map(
                (item) => ({
                  ...(item.data() as Order),
                  id: item.id,
                })
              );

            console.log(
              "📦 Siparişler güncellendi:",
              {
                count:
                  this.orders.length,
                role,
              }
            );

            this.emit();
          } catch (error) {
            console.error(
              "❌ Orders snapshot işleme hatası:",
              error
            );
          }
        },
        (error) => {
          console.error(
            "❌ Orders listener hatası:",
            error
          );
        }
      );

    this.firestoreUnsubscribers.push(
      unsubscribe
    );
  }

  /* ==========================================================
     NOTIFICATION LISTENER
  ========================================================== */

  private startNotificationListener(
    uid: string
  ): void {
    const notificationsQuery =
      query(
        collection(
          db,
          "notifications"
        ),
        where(
          "userId",
          "==",
          uid
        )
      );

    const unsubscribe =
      onSnapshot(
        notificationsQuery,
        (snapshot) => {
          try {
            this.notifications =
              snapshot.docs.map(
                (item) => ({
                  ...(item.data() as NotificationItem),
                  id: item.id,
                })
              );

            this.emit();
          } catch (error) {
            console.error(
              "❌ Notification snapshot işleme hatası:",
              error
            );
          }
        },
        (error) => {
          console.error(
            "❌ Notifications listener hatası:",
            error
          );
        }
      );

    this.firestoreUnsubscribers.push(
      unsubscribe
    );
  }

  /* ==========================================================
     PRICING LISTENER
  ========================================================== */

  private startPricingListener(): void {
    const unsubscribe =
      onSnapshot(
        doc(
          db,
          "settings",
          "pricing"
        ),
        (snapshot) => {
          try {
            if (
              snapshot.exists()
            ) {
              this.pricing = {
                ...DEFAULT_PRICING,
                ...(snapshot.data() as PricingConfig),
              };
            } else {
              this.pricing = {
                ...DEFAULT_PRICING,
              };
            }

            this.emit();
          } catch (error) {
            console.error(
              "❌ Pricing snapshot işleme hatası:",
              error
            );
          }
        },
        (error) => {
          console.error(
            "❌ Pricing listener hatası:",
            error
          );
        }
      );

    this.firestoreUnsubscribers.push(
      unsubscribe
    );
  }

  /* ==========================================================
     COURIER LOCATION LISTENER
  ========================================================== */

  private startCourierLocationListener(
    uid: string,
    role: string
  ): void {
    /*
     * ADMIN:
     * Tüm kurye konumlarını dinler.
     */
    if (role === "admin") {
      const unsubscribe =
        onSnapshot(
          collection(
            db,
            "courierLocations"
          ),
          (snapshot) => {
            try {
              this.courierLocations =
                snapshot.docs.map(
                  (item) => {
                    const data =
                      item.data() as CourierLocation;

                    return {
                      ...data,
                      courierId:
                        data.courierId ||
                        item.id,
                    };
                  }
                );

              this.emit();
            } catch (error) {
              console.error(
                "❌ Courier location snapshot işleme hatası:",
                error
              );
            }
          },
          (error) => {
            console.error(
              "❌ Courier locations listener hatası:",
              error
            );
          }
        );

      this.firestoreUnsubscribers.push(
        unsubscribe
      );

      return;
    }

    /*
     * COURIER:
     * Sadece kendi konumunu dinler.
     */
    if (
      role === "courier"
    ) {
      const unsubscribe =
        onSnapshot(
          doc(
            db,
            "courierLocations",
            uid
          ),
          (snapshot) => {
            try {
              if (
                snapshot.exists()
              ) {
                const data =
                  snapshot.data() as CourierLocation;

                const location:
                  CourierLocation = {
                    ...data,
                    courierId:
                      data.courierId ||
                      uid,
                  };

                this.courierLocations =
                  [
                    ...this.courierLocations.filter(
                      (item) =>
                        item.courierId !== uid
                    ),
                    location,
                  ];
              } else {
                this.courierLocations =
                  this.courierLocations.filter(
                    (item) =>
                      item.courierId !== uid
                  );
              }

              this.emit();
            } catch (error) {
              console.error(
                "❌ Kurye konum snapshot işleme hatası:",
                error
              );
            }
          },
          (error) => {
            console.error(
              "❌ Kurye konum listener hatası:",
              error
            );
          }
        );

      this.firestoreUnsubscribers.push(
        unsubscribe
      );
    }
  }

  /* ==========================================================
     CLEANUP FIRESTORE LISTENERS
  ========================================================== */

  private cleanupFirestoreListeners(): void {
    for (
      const unsubscribe of
      this.firestoreUnsubscribers
    ) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn(
          "⚠️ Listener kapatma hatası:",
          error
        );
      }
    }

    this.firestoreUnsubscribers =
      [];
  }

  /* ==========================================================
     RESET REALTIME DATA
  ========================================================== */

  private resetRealtimeData(): void {
    this.users = [];
    this.orders = [];
    this.notifications = [];
    this.courierLocations = [];

    this.pricing = {
      ...DEFAULT_PRICING,
    };
  }

  /* ==========================================================
     LOGOUT HANDLER
  ========================================================== */

  private handleLogout(): void {
    this.cleanupFirestoreListeners();

    this.currentUser = null;

    this.activeUserId = null;

    this.activeRole = null;

    this.resetRealtimeData();

    this.emit();

    console.log(
      "🧹 Storage logout temizliği tamamlandı."
    );
  }

  /* ==========================================================
     LOCAL USER UPDATE
  ========================================================== */

  private updateUserLocal(
    user: UserProfile
  ): void {
    const exists =
      this.users.some(
        (item) =>
          item.id === user.id
      );

    if (exists) {
      this.users =
        this.users.map(
          (item) =>
            item.id === user.id
              ? user
              : item
        );
    } else {
      this.users = [
        ...this.users,
        user,
      ];
    }
  }

  /* ==========================================================
     SUBSCRIBERS
  ========================================================== */

  subscribe(
    callback: Subscriber
  ): () => void {
    this.subscribers.add(
      callback
    );

    try {
      callback();
    } catch (error) {
      console.error(
        "❌ Storage subscriber ilk çağrı hatası:",
        error
      );
    }

    return () => {
      this.subscribers.delete(
        callback
      );
    };
  }

  private emit(): void {
    for (
      const callback of
      this.subscribers
    ) {
      try {
        callback();
      } catch (error) {
        console.error(
          "❌ Storage subscriber emit hatası:",
          error
        );
      }
    }
  }

  /* ==========================================================
     CURRENT USER
  ========================================================== */

  setCurrentUser(
    user: UserProfile | null
  ): void {
    /*
     * Manuel setCurrentUser çağrısı
     * eski component yapılarıyla uyumluluk için tutuldu.
     *
     * Asıl kaynak Firebase Auth + Firestore'dur.
     */

    if (!user) {
      this.handleLogout();
      return;
    }

    const userChanged =
      this.activeUserId !== user.id ||
      this.activeRole !== user.role;

    this.currentUser =
      user;

    this.activeUserId =
      user.id;

    this.activeRole =
      user.role;

    this.updateUserLocal(
      user
    );

    if (userChanged) {
      this.resetRealtimeData();

      this.updateUserLocal(
        user
      );

      this.startListeners(
        user
      );
    }

    this.emit();
  }

  getCurrentUser():
    | UserProfile
    | null {
    return this.currentUser;
  }

  /* ==========================================================
     USERS
  ========================================================== */

  getUsers(): UserProfile[] {
    return [
      ...this.users,
    ];
  }

  getUserById(
    id: string
  ):
    | UserProfile
    | undefined {
    return this.users.find(
      (user) =>
        user.id === id
    );
  }

  getCouriers():
    UserProfile[] {
    return this.users.filter(
      (user) =>
        user.role === "courier"
    );
  }

  getCustomers():
    UserProfile[] {
    return this.users.filter(
      (user) =>
        user.role === "customer"
    );
  }

  async updateUser(
    id: string,
    data: Partial<UserProfile>
  ): Promise<void> {
    await updateDoc(
      doc(
        db,
        "users",
        id
      ),
      {
        ...data,
        updatedAt:
          new Date().toISOString(),
      }
    );
  }

  /* ==========================================================
     CREATE COURIER
  ========================================================== */

  async createCourier(data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }): Promise<UserProfile> {
    const name =
      data.name.trim();

    const email =
      data.email
        .trim()
        .toLowerCase();

    const phone =
      data.phone?.trim() ||
      "";

    if (!name) {
      throw new Error(
        "Kurye adı gerekli."
      );
    }

    if (!email) {
      throw new Error(
        "Kurye e-postası gerekli."
      );
    }

    if (
      !data.password ||
      data.password.length < 6
    ) {
      throw new Error(
        "Şifre en az 6 karakter olmalıdır."
      );
    }

    const adminUser =
      auth.currentUser;

    if (!adminUser) {
      throw new Error(
        "Admin oturumu bulunamadı."
      );
    }

    if (
      adminUser.email
        ?.trim()
        .toLowerCase() !==
      ADMIN_EMAIL.toLowerCase()
    ) {
      throw new Error(
        "Bu işlemi sadece yetkili admin yapabilir."
      );
    }

    /*
     * Secondary Firebase App.
     *
     * Yeni kullanıcı oluşturulduğunda
     * ana admin oturumunun değişmesini engeller.
     */
    const existingApp =
      getApps().find(
        (app) =>
          app.name ===
          SECONDARY_APP_NAME
      );

    const secondaryApp =
      existingApp ??
      initializeApp(
        auth.app.options,
        SECONDARY_APP_NAME
      );

    const secondaryAuth =
      getAuth(
        secondaryApp
      );

    let createdUserId:
      | string
      | null = null;

    try {
      const credential =
        await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          data.password
        );

      const courierUser =
        credential.user;

      createdUserId =
        courierUser.uid;

      const now =
        new Date().toISOString();

      const profile:
        UserProfile = {
          id:
            courierUser.uid,

          name,

          email:
            courierUser.email ||
            email,

          phone,

          role:
            "courier",

          courierStatus:
            "Çevrimdışı",

          totalDeliveries:
            0,

          rating:
            5,

          createdAt:
            now,
        };

      /*
       * Firestore profil oluştur.
       */
      await setDoc(
        doc(
          db,
          "users",
          courierUser.uid
        ),
        {
          ...profile,
          updatedAt:
            now,
        }
      );

      /*
       * Secondary auth oturumunu kapat.
       * Ana admin auth etkilenmez.
       */
      await signOut(
        secondaryAuth
      );

      return profile;
    } catch (error: any) {
      console.error(
        "❌ Kurye oluşturma hatası:",
        error
      );

      /*
       * Yarım kalmış kullanıcı varsa
       * mümkün olduğunca temizlemeye çalış.
       */
      try {
        if (
          secondaryAuth.currentUser
        ) {
          await secondaryAuth.currentUser.delete();
        }
      } catch {
        // ignore cleanup error
      }

      try {
        await signOut(
          secondaryAuth
        );
      } catch {
        // ignore cleanup error
      }

      if (
        error?.code ===
        "auth/email-already-in-use"
      ) {
        throw new Error(
          "Bu e-posta adresi zaten kayıtlı."
        );
      }

      if (
        error?.code ===
        "auth/invalid-email"
      ) {
        throw new Error(
          "Geçerli bir e-posta adresi girin."
        );
      }

      if (
        error?.code ===
        "auth/weak-password"
      ) {
        throw new Error(
          "Şifre en az 6 karakter olmalıdır."
        );
      }

      throw error;
    }
  }

  /* ==========================================================
     COURIER STATUS
  ========================================================== */

  async updateCourierStatus(
    courierId: string,
    status: CourierAvailability
  ):
    Promise<
      UserProfile | undefined
    > {
    const existing =
      this.getUserById(
        courierId
      );

    await updateDoc(
      doc(
        db,
        "users",
        courierId
      ),
      {
        courierStatus:
          status,

        updatedAt:
          new Date().toISOString(),
      }
    );

    /*
     * Optimistic local update.
     * Snapshot geldiğinde tekrar doğrulanır.
     */
    if (existing) {
      const updatedUser = {
        ...existing,
        courierStatus:
          status,
      };

      this.updateUserLocal(
        updatedUser
      );

      this.emit();

      return updatedUser;
    }

    return existing;
  }

  /* ==========================================================
     ORDERS
  ========================================================== */

  getOrders(): Order[] {
    return [
      ...this.orders,
    ];
  }

  getOrderById(
    id: string
  ):
    | Order
    | undefined {
    return this.orders.find(
      (order) =>
        order.id === id
    );
  }

  async createOrder(
    order: Order
  ): Promise<Order> {
    if (!order.id) {
      throw new Error(
        "Sipariş ID gerekli."
      );
    }

    const now =
      new Date().toISOString();

    const finalOrder:
      Order = {
        ...order,

        createdAt:
          order.createdAt ||
          now,

        updatedAt:
          now,
      };

    await setDoc(
      doc(
        db,
        "orders",
        finalOrder.id
      ),
      finalOrder
    );

    return finalOrder;
  }

  async updateOrder(
    id: string,
    data: Partial<Order>
  ): Promise<Order> {
    if (!id) {
      throw new Error(
        "Sipariş ID gerekli."
      );
    }

    const updatedAt =
      new Date().toISOString();

    await updateDoc(
      doc(
        db,
        "orders",
        id
      ),
      {
        ...data,
        updatedAt,
      }
    );

    const current =
      this.getOrderById(
        id
      );

    const updatedOrder:
      Order = {
        ...(current || {
          id,
        }),

        ...data,

        id,

        updatedAt,
      } as Order;

    /*
     * Local optimistic update.
     */
    const exists =
      this.orders.some(
        (order) =>
          order.id === id
      );

    if (exists) {
      this.orders =
        this.orders.map(
          (order) =>
            order.id === id
              ? updatedOrder
              : order
        );
    } else {
      this.orders = [
        ...this.orders,
        updatedOrder,
      ];
    }

    this.emit();

    return updatedOrder;
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<Order> {
    return this.updateOrder(
      orderId,
      {
        status,
      }
    );
  }

  async assignCourier(
    orderId: string,
    courierId: string
  ): Promise<Order> {
    const courier =
      this.getUserById(
        courierId
      );

    if (!courier) {
      throw new Error(
        "Kurye bulunamadı."
      );
    }

    if (
      courier.role !==
      "courier"
    ) {
      throw new Error(
        "Seçilen kullanıcı kurye değil."
      );
    }

    return this.updateOrder(
      orderId,
      {
        courierId,

        courierName:
          courier.name || "",

        courierPhone:
          courier.phone || "",

        status:
          "Kurye Atandı",
      }
    );
  }

  async deleteOrder(
    orderId: string
  ): Promise<void> {
    if (!orderId) {
      throw new Error(
        "Sipariş ID gerekli."
      );
    }

    await deleteDoc(
      doc(
        db,
        "orders",
        orderId
      )
    );

    this.orders =
      this.orders.filter(
        (order) =>
          order.id !== orderId
      );

    this.emit();
  }

  /* ==========================================================
     PRICING
  ========================================================== */

  getPricing():
    PricingConfig {
    return {
      ...this.pricing,
    };
  }

  async updatePricing(
    pricing: PricingConfig
  ): Promise<void> {
    const finalPricing = {
      ...DEFAULT_PRICING,
      ...pricing,

      updatedAt:
        new Date().toISOString(),
    };

    await setDoc(
      doc(
        db,
        "settings",
        "pricing"
      ),
      finalPricing,
      {
        merge: true,
      }
    );

    this.pricing =
      finalPricing;

    this.emit();
  }

  async setPricing(
    pricing: PricingConfig
  ): Promise<void> {
    return this.updatePricing(
      pricing
    );
  }

  /* ==========================================================
     NOTIFICATIONS
  ========================================================== */

  getNotifications(
    userId: string
  ):
    NotificationItem[] {
    return [
      ...this.notifications
        .filter(
          (notification) =>
            notification.userId ===
            userId
        )
        .sort(
          (a, b) => {
            const dateA =
              new Date(
                a.createdAt || 0
              ).getTime();

            const dateB =
              new Date(
                b.createdAt || 0
              ).getTime();

            return (
              dateB -
              dateA
            );
          }
        ),
    ];
  }

  async createNotification(
    notification:
      NotificationItem
  ): Promise<void> {
    if (!notification.id) {
      throw new Error(
        "Bildirim ID gerekli."
      );
    }

    const now =
      new Date().toISOString();

    await setDoc(
      doc(
        db,
        "notifications",
        notification.id
      ),
      {
        ...notification,

        createdAt:
          notification.createdAt ||
          now,
      }
    );
  }

  async markNotificationAsRead(
    notificationId: string
  ): Promise<void> {
    await updateDoc(
      doc(
        db,
        "notifications",
        notificationId
      ),
      {
        read: true,
      }
    );

    /*
     * Local update.
     */
    this.notifications =
      this.notifications.map(
        (notification) =>
          notification.id ===
          notificationId
            ? {
                ...notification,
                read: true,
              }
            : notification
      );

    this.emit();
  }

  /* ==========================================================
     COURIER LOCATION
  ========================================================== */

  getCourierLocation(
    courierId: string
  ):
    | CourierLocation
    | undefined {
    return this.courierLocations.find(
      (location) =>
        location.courierId ===
        courierId
    );
  }

  async updateCourierLocation(
    location: CourierLocation
  ):
    Promise<CourierLocation> {
    if (!location.courierId) {
      throw new Error(
        "Kurye ID gerekli."
      );
    }

    const finalLocation:
      CourierLocation = {
        ...location,

        updatedAt:
          new Date().toISOString(),
      };

    await setDoc(
      doc(
        db,
        "courierLocations",
        location.courierId
      ),
      finalLocation,
      {
        merge: true,
      }
    );

    /*
     * Local update.
     */
    this.courierLocations = [
      ...this.courierLocations.filter(
        (item) =>
          item.courierId !==
          location.courierId
      ),
      finalLocation,
    ];

    this.emit();

    return finalLocation;
  }

  /* ==========================================================
     DESTROY
  ========================================================== */

  destroy(): void {
    console.log(
      "🧹 Storage destroy başlatıldı."
    );

    this.cleanupFirestoreListeners();

    if (
      this.authUnsubscribe
    ) {
      try {
        this.authUnsubscribe();
      } catch {
        // ignore
      }

      this.authUnsubscribe =
        null;
    }

    this.initialized =
      false;

    this.initializing =
      false;

    this.currentUser =
      null;

    this.activeUserId =
      null;

    this.activeRole =
      null;

    this.resetRealtimeData();

    this.emit();
  }
}

/* ============================================================
   SINGLETON EXPORT
============================================================ */

export const storage =
  new StorageService();

/*
 * Uygulama açıldığında Storage sistemini başlat.
 */
void storage
  .init()
  .catch(
    (error) => {
      console.error(
        "❌ Storage başlangıç hatası:",
        error
      );
    }
  );