import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";

import {
  getApps,
  initializeApp,
} from "firebase/app";

import {
  db,
  auth,
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

type Subscriber = () => void;

const ADMIN_EMAIL =
  "hamidocan0411@gmail.com";

const SECONDARY_APP_NAME =
  "TrustlineCourierCreator";

class StorageService {
  private currentUser:
    | UserProfile
    | null = null;

  private users: UserProfile[] = [];

  private orders: Order[] = [];

  private notifications:
    NotificationItem[] = [];

  private courierLocations:
    CourierLocation[] = [];

  private pricing: PricingConfig =
    DEFAULT_PRICING;

  private subscribers =
    new Set<Subscriber>();

  private unsubscribers:
    (() => void)[] = [];

  private authUnsubscribe:
    | (() => void)
    | null = null;

  private initialized = false;

  private initializing = false;

  private activeUserId:
    | string
    | null = null;

  // =========================================================
  // INITIALIZE
  // =========================================================

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializing) {
      return;
    }

    this.initializing = true;

    try {
      /*
       * Auth değişikliklerini sürekli dinle.
       *
       * Bu sayede:
       * - Sayfa ilk açıldığında
       * - Login yapıldığında
       * - Logout yapıldığında
       * - Kullanıcı admin yapıldığında
       *
       * Storage otomatik güncellenir.
       */

      this.authUnsubscribe =
        onAuthStateChanged(
          auth,
          async (firebaseUser) => {
            try {
              await this.handleAuthChange(
                firebaseUser
              );
            } catch (error) {
              console.error(
                "Auth değişimi işlenemedi:",
                error
              );
            }
          }
        );

      this.initialized = true;

      console.log(
        "🔥 Trustline Storage hazır"
      );
    } catch (error) {
      console.error(
        "Storage init hatası:",
        error
      );
    } finally {
      this.initializing = false;
    }
  }

  // =========================================================
  // AUTH CHANGE
  // =========================================================

  private async handleAuthChange(
    firebaseUser: User | null
  ): Promise<void> {
    /*
     * Kullanıcı çıkış yaptıysa
     */

    if (!firebaseUser) {
      this.cleanupListeners();

      this.currentUser = null;
      this.activeUserId = null;

      this.users = [];
      this.orders = [];
      this.notifications = [];
      this.courierLocations = [];

      this.pricing =
        DEFAULT_PRICING;

      this.emit();

      console.log(
        "👋 Storage: kullanıcı çıkış yaptı"
      );

      return;
    }

    /*
     * Aynı kullanıcı zaten aktifse
     * gereksiz listener oluşturma.
     */

    if (
      this.activeUserId ===
      firebaseUser.uid
    ) {
      return;
    }

    this.activeUserId =
      firebaseUser.uid;

    this.cleanupListeners();

    console.log(
      "🔐 Storage auth kullanıcı:",
      firebaseUser.uid,
      firebaseUser.email
    );

    let profile:
      | UserProfile
      | null = null;

    try {
      const profileRef =
        doc(
          db,
          "users",
          firebaseUser.uid
        );

      const profileSnap =
        await getDoc(
          profileRef
        );

      if (profileSnap.exists()) {
        profile = {
          ...(profileSnap.data() as UserProfile),
          id: profileSnap.id,
        };
      } else {
        /*
         * Firestore profil belgesi yoksa
         * fallback profil oluştur.
         */

        const email =
          firebaseUser.email
            ?.toLowerCase()
            .trim() || "";

        const isPrimaryAdmin =
          email ===
          ADMIN_EMAIL.toLowerCase();

        const now =
          new Date().toISOString();

        profile = {
          id: firebaseUser.uid,
          name:
            firebaseUser.displayName ||
            email ||
            "Kullanıcı",
          email,
          phone:
            firebaseUser.phoneNumber ||
            "",
          role:
            isPrimaryAdmin
              ? "admin"
              : "customer",
          createdAt: now,
        };

        /*
         * Ana admin veya eksik profil için
         * belgeyi güvenli şekilde oluştur.
         */

        try {
          await setDoc(
            profileRef,
            {
              ...profile,
              updatedAt: now,
            },
            {
              merge: true,
            }
          );
        } catch (error) {
          console.error(
            "Eksik kullanıcı profili oluşturulamadı:",
            error
          );
        }
      }
    } catch (error) {
      console.error(
        "Kullanıcı profili okunamadı:",
        error
      );

      /*
       * Firestore okunamasa bile
       * uygulama siyah ekran vermesin.
       */

      const email =
        firebaseUser.email
          ?.toLowerCase()
          .trim() || "";

      profile = {
        id: firebaseUser.uid,
        name:
          firebaseUser.displayName ||
          email ||
          "Kullanıcı",
        email,
        phone:
          firebaseUser.phoneNumber ||
          "",
        role:
          email ===
          ADMIN_EMAIL.toLowerCase()
            ? "admin"
            : "customer",
        createdAt:
          new Date().toISOString(),
      };
    }

    /*
     * Ana admin e-postası her durumda admin.
     */

    if (
      profile.email
        ?.toLowerCase()
        .trim() ===
      ADMIN_EMAIL.toLowerCase()
    ) {
      profile = {
        ...profile,
        role: "admin",
      };

      try {
        await setDoc(
          doc(
            db,
            "users",
            profile.id
          ),
          {
            role: "admin",
            updatedAt:
              new Date().toISOString(),
          },
          {
            merge: true,
          }
        );
      } catch (error) {
        console.error(
          "Ana admin rolü güncellenemedi:",
          error
        );
      }
    }

    this.currentUser =
      profile;

    this.users = [
      profile,
    ];

    this.startListeners(
      profile
    );

    this.emit();

    console.log(
      "🔥 Storage kullanıcı hazır:",
      {
        uid: profile.id,
        email: profile.email,
        role: profile.role,
      }
    );
  }

  // =========================================================
  // LISTENERS
  // =========================================================

  private startListeners(
    profile: UserProfile
  ): void {
    this.cleanupListeners();

    const uid =
      profile.id;

    const role =
      profile.role;

    console.log(
      "🔥 Storage listeners başlatılıyor:",
      {
        uid,
        email:
          profile.email,
        role,
      }
    );

    // =======================================================
    // USERS LISTENER
    // =======================================================

    if (
      role === "admin"
    ) {
      const unsubscribeUsers =
        onSnapshot(
          collection(
            db,
            "users"
          ),
          (snapshot) => {
            const liveUsers =
              snapshot.docs.map(
                (item) => ({
                  ...(item.data() as UserProfile),
                  id: item.id,
                })
              );

            /*
             * Ana admin Firestore listesinde
             * görünmese bile listeye ekle.
             */

            const hasCurrentUser =
              liveUsers.some(
                (user) =>
                  user.id === uid
              );

            if (
              !hasCurrentUser
            ) {
              liveUsers.push(
                this.currentUser ||
                  profile
              );
            }

            this.users =
              liveUsers;

            console.log(
              "👑 ADMIN users:",
              {
                total:
                  liveUsers.length,
                customers:
                  liveUsers.filter(
                    (user) =>
                      user.role ===
                      "customer"
                  ).length,
                couriers:
                  liveUsers.filter(
                    (user) =>
                      user.role ===
                      "courier"
                  ).length,
                admins:
                  liveUsers.filter(
                    (user) =>
                      user.role ===
                      "admin"
                  ).length,
              }
            );

            this.emit();
          },
          (error) => {
            console.error(
              "❌ Users listener hatası:",
              error
            );
          }
        );

      this.unsubscribers.push(
        unsubscribeUsers
      );
    } else {
      const unsubscribeOwnUser =
        onSnapshot(
          doc(
            db,
            "users",
            uid
          ),
          (snapshot) => {
            if (
              !snapshot.exists()
            ) {
              return;
            }

            const liveUser: UserProfile =
              {
                ...(snapshot.data() as UserProfile),
                id: snapshot.id,
              };

            const previousRole =
              this.currentUser
                ?.role;

            this.currentUser =
              liveUser;

            this.users = [
              liveUser,
            ];

            this.emit();

            /*
             * Kullanıcı sonradan admin yapıldıysa
             * listener'ları role göre yeniden kur.
             */

            if (
              previousRole &&
              previousRole !==
                liveUser.role
            ) {
              console.log(
                "🔄 Rol değişti:",
                previousRole,
                "→",
                liveUser.role
              );

              this.startListeners(
                liveUser
              );
            }
          },
          (error) => {
            console.error(
              "❌ Own user listener hatası:",
              error
            );
          }
        );

      this.unsubscribers.push(
        unsubscribeOwnUser
      );
    }

    // =======================================================
    // ORDERS LISTENER
    // =======================================================

    let ordersQuery;

    if (
      role === "admin"
    ) {
      ordersQuery =
        query(
          collection(
            db,
            "orders"
          )
        );

      console.log(
        "👑 Admin tüm siparişleri dinliyor"
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
    }

    const unsubscribeOrders =
      onSnapshot(
        ordersQuery,
        (snapshot) => {
          this.orders =
            snapshot.docs.map(
              (item) => ({
                ...(item.data() as Order),
                id: item.id,
              })
            );

          console.log(
            "📦 Siparişler:",
            this.orders.length
          );

          this.emit();
        },
        (error) => {
          console.error(
            "❌ Orders listener hatası:",
            error
          );

          /*
           * Hata olsa bile uygulama çalışmaya devam eder.
           */
          this.orders = [];

          this.emit();
        }
      );

    this.unsubscribers.push(
      unsubscribeOrders
    );

    // =======================================================
    // NOTIFICATIONS LISTENER
    // =======================================================

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

    const unsubscribeNotifications =
      onSnapshot(
        notificationsQuery,
        (snapshot) => {
          this.notifications =
            snapshot.docs.map(
              (item) => ({
                ...(item.data() as NotificationItem),
                id: item.id,
              })
            );

          this.emit();
        },
        (error) => {
          console.error(
            "❌ Notifications listener hatası:",
            error
          );
        }
      );

    this.unsubscribers.push(
      unsubscribeNotifications
    );

    // =======================================================
    // PRICING LISTENER
    // =======================================================

    const unsubscribePricing =
      onSnapshot(
        doc(
          db,
          "settings",
          "pricing"
        ),
        (snapshot) => {
          if (
            snapshot.exists()
          ) {
            this.pricing = {
              ...DEFAULT_PRICING,
              ...(snapshot.data() as PricingConfig),
            };
          } else {
            this.pricing =
              DEFAULT_PRICING;
          }

          this.emit();
        },
        (error) => {
          console.error(
            "❌ Pricing listener hatası:",
            error
          );

          this.pricing =
            DEFAULT_PRICING;

          this.emit();
        }
      );

    this.unsubscribers.push(
      unsubscribePricing
    );

    // =======================================================
    // COURIER LOCATIONS
    // =======================================================

    if (
      role === "admin"
    ) {
      const unsubscribeLocations =
        onSnapshot(
          collection(
            db,
            "courierLocations"
          ),
          (snapshot) => {
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
          },
          (error) => {
            console.error(
              "❌ Courier locations listener hatası:",
              error
            );
          }
        );

      this.unsubscribers.push(
        unsubscribeLocations
      );
    } else if (
      role === "courier"
    ) {
      const unsubscribeLocation =
        onSnapshot(
          doc(
            db,
            "courierLocations",
            uid
          ),
          (snapshot) => {
            if (
              snapshot.exists()
            ) {
              const data =
                snapshot.data() as CourierLocation;

              const location = {
                ...data,
                courierId:
                  data.courierId ||
                  uid,
              };

              this.courierLocations = [
                ...this.courierLocations.filter(
                  (item) =>
                    item.courierId !==
                    uid
                ),
                location,
              ];
            }

            this.emit();
          },
          (error) => {
            console.error(
              "❌ Courier location listener hatası:",
              error
            );
          }
        );

      this.unsubscribers.push(
        unsubscribeLocation
      );
    }
  }

  // =========================================================
  // CLEANUP LISTENERS
  // =========================================================

  private cleanupListeners(): void {
    this.unsubscribers.forEach(
      (unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          console.warn(
            "Listener kapatma hatası:",
            error
          );
        }
      }
    );

    this.unsubscribers = [];
  }

  // =========================================================
  // SUBSCRIBE
  // =========================================================

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
        "Storage subscriber callback hatası:",
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
    this.subscribers.forEach(
      (callback) => {
        try {
          callback();
        } catch (error) {
          console.error(
            "Storage emit callback hatası:",
            error
          );
        }
      }
    );
  }

  // =========================================================
  // CURRENT USER
  // =========================================================

  setCurrentUser(
    user: UserProfile | null
  ): void {
    if (!user) {
      this.currentUser =
        null;

      this.activeUserId =
        null;

      this.cleanupListeners();

      this.users = [];
      this.orders = [];
      this.notifications = [];
      this.courierLocations = [];

      this.emit();

      return;
    }

    this.currentUser =
      user;

    this.activeUserId =
      user.id;

    this.startListeners(
      user
    );

    this.emit();
  }

  getCurrentUser():
    | UserProfile
    | null {
    return this.currentUser;
  }

  // =========================================================
  // USERS
  // =========================================================

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

  getCouriers(): UserProfile[] {
    return this.users.filter(
      (user) =>
        user.role ===
        "courier"
    );
  }

  getCustomers(): UserProfile[] {
    return this.users.filter(
      (user) =>
        user.role ===
        "customer"
    );
  }

  async updateUser(
    id: string,
    data: Partial<UserProfile>
  ): Promise<void> {
    await setDoc(
      doc(
        db,
        "users",
        id
      ),
      {
        ...data,
        updatedAt:
          new Date().toISOString(),
      },
      {
        merge: true,
      }
    );
  }

  // =========================================================
  // CREATE COURIER
  // =========================================================

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

    const password =
      data.password;

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
      !password ||
      password.length < 6
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

    const currentProfile =
      this.currentUser;

    const isPrimaryAdmin =
      adminUser.email
        ?.trim()
        .toLowerCase() ===
      ADMIN_EMAIL.toLowerCase();

    const isAdmin =
      isPrimaryAdmin ||
      currentProfile?.role ===
        "admin";

    if (!isAdmin) {
      throw new Error(
        "Bu işlemi sadece yönetici yapabilir."
      );
    }

    const existingApp =
      getApps().find(
        (app) =>
          app.name ===
          SECONDARY_APP_NAME
      );

    const secondaryApp =
      existingApp ||
      initializeApp(
        auth.app.options,
        SECONDARY_APP_NAME
      );

    const secondaryAuth =
      getAuth(
        secondaryApp
      );

    let createdUser:
      | User
      | null = null;

    try {
      /*
       * Secondary Auth kullanıyoruz.
       *
       * Böylece admin oturumu
       * değişmeden kurye hesabı oluşturulur.
       */

      const credential =
        await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          password
        );

      createdUser =
        credential.user;

      const now =
        new Date().toISOString();

      const profile: UserProfile =
        {
          id:
            createdUser.uid,
          name,
          email:
            createdUser.email ||
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

      await setDoc(
        doc(
          db,
          "users",
          createdUser.uid
        ),
        {
          ...profile,
          updatedAt:
            now,
        },
        {
          merge: true,
        }
      );

      this.users = [
        ...this.users.filter(
          (user) =>
            user.id !==
            profile.id
        ),
        profile,
      ];

      this.emit();

      return profile;
    } catch (error: any) {
      /*
       * Firestore profil yazılamazsa
       * oluşturulan auth hesabını temizle.
       */

      if (
        createdUser
      ) {
        try {
          await createdUser.delete();
        } catch (deleteError) {
          console.error(
            "Oluşturulan kullanıcı temizlenemedi:",
            deleteError
          );
        }
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
          "Şifre çok zayıf."
        );
      }

      throw error;
    } finally {
      try {
        await signOut(
          secondaryAuth
        );
      } catch {
        // ignore
      }
    }
  }

  // =========================================================
  // COURIER STATUS
  // =========================================================

  async updateCourierStatus(
    courierId: string,
    status: CourierAvailability
  ):
    Promise<
      | UserProfile
      | undefined
    > {
    await setDoc(
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
      },
      {
        merge: true,
      }
    );

    const existing =
      this.getUserById(
        courierId
      );

    if (
      existing
    ) {
      const updatedUser = {
        ...existing,
        courierStatus:
          status,
      };

      this.users =
        this.users.map(
          (user) =>
            user.id ===
            courierId
              ? updatedUser
              : user
        );

      this.emit();

      return updatedUser;
    }

    return undefined;
  }

  // =========================================================
  // ORDERS
  // =========================================================

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
    const now =
      new Date().toISOString();

    const finalOrder: Order =
      {
        ...order,
        id:
          String(
            order.id
          ),
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
      finalOrder,
      {
        merge: true,
      }
    );

    return finalOrder;
  }

  async updateOrder(
    id: string,
    data: Partial<Order>
  ): Promise<Order> {
    const updatedAt =
      new Date().toISOString();

    const current =
      this.getOrderById(
        id
      );

    const updatedOrder =
      {
        ...(current ||
          {
            id,
          }),
        ...data,
        id,
        updatedAt,
      } as Order;

    await setDoc(
      doc(
        db,
        "orders",
        id
      ),
      updatedOrder,
      {
        merge: true,
      }
    );

    const existsInMemory =
      this.orders.some(
        (order) =>
          order.id === id
      );

    if (
      existsInMemory
    ) {
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

    if (
      !courier
    ) {
      throw new Error(
        "Seçilen kurye bulunamadı."
      );
    }

    return this.updateOrder(
      orderId,
      {
        courierId,
        courierName:
          courier.name ||
          "",
        courierPhone:
          courier.phone ||
          "",
        status:
          "Kurye Atandı",
      }
    );
  }

  async deleteOrder(
    orderId: string
  ): Promise<void> {
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
          order.id !==
          orderId
      );

    this.emit();
  }

  // =========================================================
  // PRICING
  // =========================================================

  getPricing():
    PricingConfig {
    return {
      ...this.pricing,
    };
  }

  async updatePricing(
    pricing: PricingConfig
  ): Promise<void> {
    const finalPricing:
      PricingConfig =
        {
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

  // =========================================================
  // NOTIFICATIONS
  // =========================================================

  getNotifications(
    userId: string
  ): NotificationItem[] {
    return [
      ...this.notifications
        .filter(
          (
            notification
          ) =>
            notification.userId ===
            userId
        )
        .sort(
          (a, b) =>
            new Date(
              b.createdAt ||
                0
            ).getTime() -
            new Date(
              a.createdAt ||
                0
            ).getTime()
        ),
    ];
  }

  async createNotification(
    notification: NotificationItem
  ): Promise<void> {
    const id =
      notification.id;

    if (!id) {
      throw new Error(
        "Bildirim ID gerekli."
      );
    }

    await setDoc(
      doc(
        db,
        "notifications",
        id
      ),
      {
        ...notification,
        createdAt:
          notification.createdAt ||
          new Date().toISOString(),
      },
      {
        merge: true,
      }
    );
  }

  async markNotificationAsRead(
    notificationId: string
  ): Promise<void> {
    await setDoc(
      doc(
        db,
        "notifications",
        notificationId
      ),
      {
        read: true,
        updatedAt:
          new Date().toISOString(),
      },
      {
        merge: true,
      }
    );
  }

  // =========================================================
  // COURIER LOCATION
  // =========================================================

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

  getCourierLocations():
    CourierLocation[] {
    return [
      ...this.courierLocations,
    ];
  }

  async updateCourierLocation(
    location: CourierLocation
  ): Promise<CourierLocation> {
    if (
      !location.courierId
    ) {
      throw new Error(
        "Kurye ID gerekli."
      );
    }

    const finalLocation =
      {
        ...location,
        updatedAt:
          location.updatedAt ||
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

  // =========================================================
  // FORCE REFRESH USERS
  // =========================================================

  async refreshUsers(): Promise<void> {
    try {
      const snapshot =
        await getDocs(
          collection(
            db,
            "users"
          )
        );

      this.users =
        snapshot.docs.map(
          (item) => ({
            ...(item.data() as UserProfile),
            id: item.id,
          })
        );

      this.emit();
    } catch (error) {
      console.error(
        "Users manuel yenileme hatası:",
        error
      );
    }
  }

  // =========================================================
  // DESTROY
  // =========================================================

  destroy(): void {
    this.cleanupListeners();

    if (
      this.authUnsubscribe
    ) {
      try {
        this.authUnsubscribe();
      } catch {
        // ignore
      }
    }

    this.authUnsubscribe =
      null;

    this.initialized =
      false;

    this.initializing =
      false;

    this.activeUserId =
      null;

    this.currentUser =
      null;

    this.users = [];

    this.orders = [];

    this.notifications =
      [];

    this.courierLocations =
      [];

    this.pricing =
      DEFAULT_PRICING;

    this.emit();
  }
}

/*
 * ===========================================================
 * GLOBAL STORAGE INSTANCE
 * ===========================================================
 *
 * AdminPanel dahil tüm componentler:
 *
 * import { storage } from "../services/storage";
 *
 * şeklinde güvenli olarak kullanabilir.
 */

export const storage =
  new StorageService();

/*
 * Storage uygulama açılır açılmaz başlatılır.
 *
 * Hata oluşursa uygulamanın tamamı çökmez.
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