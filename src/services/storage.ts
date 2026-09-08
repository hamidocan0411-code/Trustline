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
} from "firebase/firestore";

import {
  createUserWithEmailAndPassword,
  getAuth,
  getApps,
  initializeApp,
  signOut,
} from "firebase/auth";

import { db, auth } from "./firebase";

import type {
  CourierAvailability,
  CourierLocation,
  NotificationItem,
  Order,
  OrderStatus,
  PricingConfig,
  UserProfile,
} from "../types";

import { DEFAULT_PRICING } from "../utils/pricing";

type Subscriber = () => void;

const ADMIN_EMAIL = "hamidocan0411@gmail.com";

class StorageService {
  private currentUser: UserProfile | null = null;

  private users: UserProfile[] = [];
  private orders: Order[] = [];
  private notifications: NotificationItem[] = [];
  private courierLocations: CourierLocation[] = [];

  private pricing: PricingConfig = DEFAULT_PRICING;

  private subscribers = new Set<Subscriber>();
  private unsubscribers: (() => void)[] = [];

  private initialized = false;
  private initializing = false;

  /*
   * =========================================================
   * INIT
   * =========================================================
   */

  async init(): Promise<void> {
    if (this.initializing) {
      return;
    }

    this.initializing = true;

    try {
      const firebaseUser = await this.waitForAuth();

      if (!firebaseUser) {
        this.cleanupListeners();

        this.initialized = true;
        this.initializing = false;

        return;
      }

      let profile: UserProfile | null = null;

      try {
        const profileSnap = await getDoc(
          doc(db, "users", firebaseUser.uid)
        );

        if (profileSnap.exists()) {
          profile = {
            ...(profileSnap.data() as UserProfile),
            id: profileSnap.id,
          };
        }
      } catch (error) {
        console.error(
          "Storage kullanıcı profili okunamadı:",
          error
        );
      }

      if (profile) {
        this.currentUser = profile;
        this.startListeners(profile);
      }

      this.initialized = true;
      this.initializing = false;

      this.emit();

      console.log(
        "🔥 Trustline Storage Firebase canlı sistem hazır"
      );
    } catch (error) {
      this.initializing = false;

      console.error(
        "Storage init hatası:",
        error
      );
    }
  }

  private async waitForAuth() {
    if (auth.currentUser) {
      return auth.currentUser;
    }

    return new Promise<ReturnType<typeof getAuth>["currentUser"]>(
      (resolve) => {
        const unsubscribe = auth.onAuthStateChanged(
          (user) => {
            unsubscribe();
            resolve(user);
          }
        );
      }
    );
  }

  /*
   * =========================================================
   * LIVE LISTENERS
   * =========================================================
   */

  private startListeners(
    profile: UserProfile
  ) {
    this.cleanupListeners();

    const uid = profile.id;
    const role = profile.role;

    console.log(
      "🔥 Storage listener başlatılıyor:",
      {
        uid,
        email: profile.email,
        role,
      }
    );

    /*
     * =======================================================
     * USERS
     * =======================================================
     *
     * ADMIN:
     * Bütün users koleksiyonunu canlı dinler.
     *
     * CUSTOMER / COURIER:
     * Sadece kendi profilini dinler.
     */

    if (role === "admin") {
      const unsubscribeUsers = onSnapshot(
        collection(db, "users"),
        (snapshot) => {
          const liveUsers: UserProfile[] =
            snapshot.docs.map((item) => ({
              ...(item.data() as UserProfile),
              id: item.id,
            }));

          this.users = liveUsers;

          console.log(
            "🔥 ADMIN canlı users:",
            liveUsers.length,
            "müşteri:",
            liveUsers.filter(
              (user) => user.role === "customer"
            ).length,
            "kurye:",
            liveUsers.filter(
              (user) => user.role === "courier"
            ).length
          );

          this.emit();
        },
        (error) => {
          console.error(
            "❌ Admin users onSnapshot hatası:",
            error
          );
        }
      );

      this.unsubscribers.push(
        unsubscribeUsers
      );
    } else {
      const unsubscribeOwnUser = onSnapshot(
        doc(db, "users", uid),
        (snapshot) => {
          if (!snapshot.exists()) {
            return;
          }

          const liveUser: UserProfile = {
            ...(snapshot.data() as UserProfile),
            id: snapshot.id,
          };

          this.users = [
            ...this.users.filter(
              (user) => user.id !== uid
            ),
            liveUser,
          ];

          this.currentUser = liveUser;

          this.emit();
        },
        (error) => {
          console.error(
            "❌ Kullanıcı profil listener hatası:",
            error
          );
        }
      );

      this.unsubscribers.push(
        unsubscribeOwnUser
      );
    }

    /*
     * =======================================================
     * ORDERS
     * =======================================================
     */

    let ordersQuery;

    if (role === "admin") {
      ordersQuery = query(
        collection(db, "orders")
      );
    } else if (role === "courier") {
      ordersQuery = query(
        collection(db, "orders"),
        where(
          "courierId",
          "==",
          uid
        )
      );
    } else {
      ordersQuery = query(
        collection(db, "orders"),
        where(
          "customerId",
          "==",
          uid
        )
      );
    }

    const unsubscribeOrders = onSnapshot(
      ordersQuery,
      (snapshot) => {
        this.orders = snapshot.docs.map(
          (item) => ({
            ...(item.data() as Order),
            id: item.id,
          })
        );

        this.emit();
      },
      (error) => {
        console.error(
          "❌ Orders listener hatası:",
          error
        );
      }
    );

    this.unsubscribers.push(
      unsubscribeOrders
    );

    /*
     * =======================================================
     * NOTIFICATIONS
     * =======================================================
     */

    const notificationsQuery = query(
      collection(db, "notifications"),
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

    /*
     * =======================================================
     * PRICING
     * =======================================================
     */

    const unsubscribePricing = onSnapshot(
      doc(
        db,
        "settings",
        "pricing"
      ),
      (snapshot) => {
        if (snapshot.exists()) {
          this.pricing = {
            ...DEFAULT_PRICING,
            ...(snapshot.data() as PricingConfig),
          };
        }

        this.emit();
      },
      (error) => {
        console.error(
          "❌ Pricing listener hatası:",
          error
        );
      }
    );

    this.unsubscribers.push(
      unsubscribePricing
    );

    /*
     * =======================================================
     * COURIER LOCATIONS
     * =======================================================
     */

    if (role === "admin") {
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
    } else if (role === "courier") {
      const unsubscribeLocation =
        onSnapshot(
          doc(
            db,
            "courierLocations",
            uid
          ),
          (snapshot) => {
            if (snapshot.exists()) {
              const data =
                snapshot.data() as CourierLocation;

              this.courierLocations = [
                ...this.courierLocations.filter(
                  (item) =>
                    item.courierId !== uid
                ),
                {
                  ...data,
                  courierId:
                    data.courierId ||
                    uid,
                },
              ];
            }

            this.emit();
          },
          (error) => {
            console.error(
              "❌ Kurye konum listener hatası:",
              error
            );
          }
        );

      this.unsubscribers.push(
        unsubscribeLocation
      );
    }
  }

  /*
   * =========================================================
   * CLEANUP
   * =========================================================
   */

  private cleanupListeners() {
    this.unsubscribers.forEach(
      (unsubscribe) => {
        try {
          unsubscribe();
        } catch {
          // ignore
        }
      }
    );

    this.unsubscribers = [];
  }

  /*
   * =========================================================
   * SUBSCRIBERS
   * =========================================================
   */

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
        "Storage subscriber hatası:",
        error
      );
    }

    return () => {
      this.subscribers.delete(
        callback
      );
    };
  }

  private emit() {
    this.subscribers.forEach(
      (callback) => {
        try {
          callback();
        } catch (error) {
          console.error(
            "Storage emit hatası:",
            error
          );
        }
      }
    );
  }

  /*
   * =========================================================
   * CURRENT USER
   * =========================================================
   */

  setCurrentUser(
    user: UserProfile | null
  ) {
    this.currentUser = user;

    if (user) {
      this.startListeners(user);
    } else {
      this.cleanupListeners();

      this.users = [];
      this.orders = [];
      this.notifications = [];
      this.courierLocations = [];
    }

    this.emit();
  }

  getCurrentUser():
    UserProfile | null {
    return this.currentUser;
  }

  /*
   * =========================================================
   * USERS
   * =========================================================
   */

  getUsers(): UserProfile[] {
    return [...this.users];
  }

  getUserById(
    id: string
  ): UserProfile | undefined {
    return this.users.find(
      (user) =>
        user.id === id
    );
  }

  getCouriers(): UserProfile[] {
    return this.users.filter(
      (user) =>
        user.role === "courier"
    );
  }

  getCustomers(): UserProfile[] {
    return this.users.filter(
      (user) =>
        user.role === "customer"
    );
  }

  async updateUser(
    id: string,
    data: Partial<UserProfile>
  ) {
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

  /*
   * =========================================================
   * COURIER
   * =========================================================
   */

  async createCourier(data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }): Promise<UserProfile> {
    const name =
      data.name.trim();

    const email =
      data.email.trim().toLowerCase();

    const phone =
      data.phone?.trim() || "";

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
        "Bu işlemi sadece admin yapabilir."
      );
    }

    const secondaryAppName =
      "TrustlineCourierCreator";

    const existingApp =
      getApps().find(
        (app) =>
          app.name ===
          secondaryAppName
      );

    const secondaryApp =
      existingApp ??
      initializeApp(
        adminUser.auth.app.options,
        secondaryAppName
      );

    const secondaryAuth =
      getAuth(
        secondaryApp
      );

    try {
      const credential =
        await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          data.password
        );

      const courierUser =
        credential.user;

      const now =
        new Date().toISOString();

      const profile: UserProfile = {
        id: courierUser.uid,
        name,
        email:
          courierUser.email ||
          email,
        phone,
        role: "courier",
        courierStatus:
          "Çevrimdışı",
        totalDeliveries: 0,
        rating: 5,
        createdAt: now,
      };

      /*
       * NOT:
       * Firestore Rules admin kontrolüne göre
       * bu yazma işlemi mevcut projede permission
       * hatası verebilir. Bu işlem daha sonra
       * server tarafına taşınmalıdır.
       */

      await setDoc(
        doc(
          db,
          "users",
          courierUser.uid
        ),
        {
          ...profile,
          updatedAt: now,
        }
      );

      await signOut(
        secondaryAuth
      );

      return profile;
    } catch (error: any) {
      try {
        if (
          secondaryAuth.currentUser
        ) {
          await secondaryAuth.currentUser.delete();
        }
      } catch {
        // ignore
      }

      try {
        await signOut(
          secondaryAuth
        );
      } catch {
        // ignore
      }

      if (
        error?.code ===
        "auth/email-already-in-use"
      ) {
        throw new Error(
          "Bu e-posta adresi zaten Firebase'de kayıtlı."
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
    }
  }

  async updateCourierStatus(
    courierId: string,
    status: CourierAvailability
  ) {
    await updateDoc(
      doc(
        db,
        "users",
        courierId
      ),
      {
        courierStatus: status,
        updatedAt:
          new Date().toISOString(),
      }
    );

    const existing =
      this.getUserById(
        courierId
      );

    if (existing) {
      this.users =
        this.users.map(
          (user) =>
            user.id === courierId
              ? {
                  ...user,
                  courierStatus:
                    status,
                }
              : user
        );

      this.emit();
    }

    return existing;
  }

  /*
   * =========================================================
   * ORDERS
   * =========================================================
   */

  getOrders(): Order[] {
    return [...this.orders];
  }

  getOrderById(
    id: string
  ): Order | undefined {
    return this.orders.find(
      (order) =>
        order.id === id
    );
  }

  async createOrder(
    order: Order
  ): Promise<Order> {
    const finalOrder: Order = {
      ...order,
      createdAt:
        order.createdAt ||
        new Date().toISOString(),
      updatedAt:
        new Date().toISOString(),
    };

    await setDoc(
      doc(
        db,
        "orders",
        order.id
      ),
      finalOrder
    );

    return finalOrder;
  }

  async updateOrder(
    id: string,
    data: Partial<Order>
  ): Promise<Order> {
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
      this.getOrderById(id);

    const updatedOrder =
      {
        ...(current || {
          id,
        }),
        ...data,
        id,
        updatedAt,
      } as Order;

    this.orders =
      this.orders.map(
        (order) =>
          order.id === id
            ? updatedOrder
            : order
      );

    this.emit();

    return updatedOrder;
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ) {
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
  ) {
    const courier =
      this.getUserById(
        courierId
      );

    return this.updateOrder(
      orderId,
      {
        courierId,
        courierName:
          courier?.name || "",
        courierPhone:
          courier?.phone || "",
        status:
          "Kurye Atandı",
      }
    );
  }

  async deleteOrder(
    orderId: string
  ) {
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

  /*
   * =========================================================
   * PRICING
   * =========================================================
   */

  getPricing():
    PricingConfig {
    return this.pricing;
  }

  async updatePricing(
    pricing: PricingConfig
  ) {
    const finalPricing =
      {
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
  ) {
    return this.updatePricing(
      pricing
    );
  }

  /*
   * =========================================================
   * NOTIFICATIONS
   * =========================================================
   */

  getNotifications(
    userId: string
  ): NotificationItem[] {
    return [
      ...this.notifications
        .filter(
          (notification) =>
            notification.userId ===
            userId
        )
        .sort(
          (a, b) =>
            new Date(
              b.createdAt || 0
            ).getTime() -
            new Date(
              a.createdAt || 0
            ).getTime()
        ),
    ];
  }

  async createNotification(
    notification: NotificationItem
  ) {
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
          new Date().toISOString(),
      }
    );
  }

  async markNotificationAsRead(
    notificationId: string
  ) {
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
  }

  /*
   * =========================================================
   * COURIER LOCATION
   * =========================================================
   */

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
  ): Promise<CourierLocation> {
    const finalLocation = {
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

  /*
   * =========================================================
   * DESTROY
   * =========================================================
   */

  destroy() {
    this.cleanupListeners();

    this.initialized = false;
    this.initializing = false;

    this.currentUser = null;

    this.users = [];
    this.orders = [];
    this.notifications = [];
    this.courierLocations = [];

    this.pricing =
      DEFAULT_PRICING;

    this.emit();
  }
}

export const storage =
  new StorageService();

/*
 * Uygulama başlarken Storage'ı hazırla.
 */

void storage.init().catch(
  (error) => {
    console.error(
      "Storage başlangıç hatası:",
      error
    );
  }
);