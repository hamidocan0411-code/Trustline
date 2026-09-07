import type {
  UserProfile,
  Order,
  NotificationItem,
  CourierLocation,
  PricingConfig,
} from "../types";

import {
  calculateOrderPrice,
  DEFAULT_PRICING,
} from "../utils/pricing";

import {
  auth,
  db,
} from "./firebase";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";

import {
  onAuthStateChanged,
} from "firebase/auth";

/* =====================================================
   FIRESTORE COLLECTIONS
===================================================== */

const COLLECTIONS = {
  users: "users",
  orders: "orders",
  notifications: "notifications",
  courierLocations: "courierLocations",
  pricing: "pricing",
} as const;

/* =====================================================
   LOCAL CACHE
   UI'ın mevcut senkron storage API'sini kırmamak için
   yalnızca cache olarak kullanılır.
===================================================== */

const CACHE_KEYS = {
  users: "trustline_cache_users",
  orders: "trustline_cache_orders",
  notifications: "trustline_cache_notifications",
  locations: "trustline_cache_locations",
  pricing: "trustline_cache_pricing",
  currentUser: "trustline_cache_current_user",
};

/* =====================================================
   HELPERS
===================================================== */

type Listener = () => void;

function loadCache<T>(
  key: string,
  fallback: T
): T {
  try {
    const raw =
      localStorage.getItem(key);

    if (!raw) {
      return fallback;
    }

    const parsed =
      JSON.parse(raw);

    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function saveCache<T>(
  key: string,
  value: T
): void {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(value)
    );
  } catch {
    // Cache hatası uygulamayı düşürmez.
  }
}

function generateId(
  prefix: string
): string {
  return (
    `${prefix}-${Date.now().toString(36).toUpperCase()}-` +
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()
  );
}

function normalizeTimestamp(
  value: any
): string {
  if (
    value &&
    typeof value.toDate === "function"
  ) {
    return value
      .toDate()
      .toISOString();
  }

  if (
    typeof value === "string"
  ) {
    return value;
  }

  if (
    value instanceof Date
  ) {
    return value.toISOString();
  }

  return new Date().toISOString();
}

/* =====================================================
   STORAGE SERVICE
===================================================== */

class StorageService {
  private users: UserProfile[] = [];

  private orders: Order[] = [];

  private notifications:
    NotificationItem[] = [];

  private locations:
    CourierLocation[] = [];

  private pricing:
    PricingConfig = {
      ...DEFAULT_PRICING,
    };

  private currentUser:
    UserProfile | null = null;

  private listeners:
    Listener[] = [];

  private firestoreUnsubscribers:
    Unsubscribe[] = [];

  private initialized = false;

  private authUnsubscribe:
    Unsubscribe | null = null;

  constructor() {
    this.loadLocalCache();

    this.authUnsubscribe =
      onAuthStateChanged(
        auth,
        (firebaseUser) => {
          if (!firebaseUser) {
            this.clearFirestoreListeners();
            this.currentUser = null;

            saveCache(
              CACHE_KEYS.currentUser,
              null
            );

            this.notify();

            return;
          }

          void this.initializeForUser(
            firebaseUser.uid
          );
        }
      );
  }

  /* ===================================================
     CACHE
  =================================================== */

  private loadLocalCache(): void {
    this.users =
      loadCache<UserProfile[]>(
        CACHE_KEYS.users,
        []
      );

    this.orders =
      loadCache<Order[]>(
        CACHE_KEYS.orders,
        []
      );

    this.notifications =
      loadCache<NotificationItem[]>(
        CACHE_KEYS.notifications,
        []
      );

    this.locations =
      loadCache<CourierLocation[]>(
        CACHE_KEYS.locations,
        []
      );

    this.pricing =
      loadCache<PricingConfig>(
        CACHE_KEYS.pricing,
        {
          ...DEFAULT_PRICING,
        }
      );

    this.currentUser =
      loadCache<UserProfile | null>(
        CACHE_KEYS.currentUser,
        null
      );
  }

  private persistCache(): void {
    saveCache(
      CACHE_KEYS.users,
      this.users
    );

    saveCache(
      CACHE_KEYS.orders,
      this.orders
    );

    saveCache(
      CACHE_KEYS.notifications,
      this.notifications
    );

    saveCache(
      CACHE_KEYS.locations,
      this.locations
    );

    saveCache(
      CACHE_KEYS.pricing,
      this.pricing
    );

    saveCache(
      CACHE_KEYS.currentUser,
      this.currentUser
    );
  }

  /* ===================================================
     LISTENERS
  =================================================== */

  subscribe(
    listener: Listener
  ): () => void {
    this.listeners.push(listener);

    return () => {
      this.listeners =
        this.listeners.filter(
          (item) =>
            item !== listener
        );
    };
  }

  private notify(): void {
    [...this.listeners].forEach(
      (listener) => {
        try {
          listener();
        } catch (error) {
          console.warn(
            "Storage listener hatası:",
            error
          );
        }
      }
    );
  }

  /* ===================================================
     FIRESTORE INITIALIZATION
  =================================================== */

  private async initializeForUser(
    uid: string
  ): Promise<void> {
    if (
      this.initialized &&
      this.currentUser?.id === uid
    ) {
      return;
    }

    this.clearFirestoreListeners();

    try {
      const userSnapshot =
        await getDoc(
          doc(
            db,
            COLLECTIONS.users,
            uid
          )
        );

      if (
        !userSnapshot.exists()
      ) {
        console.warn(
          "Firebase kullanıcı profili bulunamadı:",
          uid
        );

        return;
      }

      const profile =
        this.mapUserProfile(
          userSnapshot.id,
          userSnapshot.data()
        );

      this.currentUser =
        profile;

      saveCache(
        CACHE_KEYS.currentUser,
        profile
      );

      await this.loadPricing();

      this.setupUserListener();

      this.setupOrderListener(
        profile
      );

      this.setupNotificationListener(
        profile.id
      );

      this.setupLocationListener(
        profile
      );

      this.initialized = true;

      this.notify();
    } catch (error) {
      console.error(
        "Firestore başlatma hatası:",
        error
      );
    }
  }

  private clearFirestoreListeners(): void {
    this.firestoreUnsubscribers.forEach(
      (unsubscribe) => {
        try {
          unsubscribe();
        } catch {
          // ignore
        }
      }
    );

    this.firestoreUnsubscribers = [];

    this.initialized = false;
  }

  /* ===================================================
     USER LISTENER
  =================================================== */

  private setupUserListener(): void {
    const user = auth.currentUser;

    if (!user) {
      return;
    }

    const unsubscribe =
      onSnapshot(
        doc(
          db,
          COLLECTIONS.users,
          user.uid
        ),
        (snapshot) => {
          if (
            !snapshot.exists()
          ) {
            return;
          }

          const profile =
            this.mapUserProfile(
              snapshot.id,
              snapshot.data()
            );

          this.currentUser =
            profile;

          this.upsertUser(
            profile
          );

          saveCache(
            CACHE_KEYS.currentUser,
            profile
          );

          this.notify();
        },
        (error) => {
          console.error(
            "Kullanıcı listener hatası:",
            error
          );
        }
      );

    this.firestoreUnsubscribers.push(
      unsubscribe
    );
  }

  /* ===================================================
     ORDER LISTENER
  =================================================== */

  private setupOrderListener(
    profile: UserProfile
  ): void {
    if (
      profile.role === "admin"
    ) {
      const unsubscribe =
        onSnapshot(
          collection(
            db,
            COLLECTIONS.orders
          ),
          (snapshot) => {
            this.orders =
              snapshot.docs.map(
                (item) =>
                  this.mapOrder(
                    item.id,
                    item.data()
                  )
              );

            this.orders.sort(
              (a, b) =>
                new Date(
                  b.createdAt
                ).getTime() -
                new Date(
                  a.createdAt
                ).getTime()
            );

            saveCache(
              CACHE_KEYS.orders,
              this.orders
            );

            this.notify();
          },
          (error) => {
            console.error(
              "Admin sipariş listener hatası:",
              error
            );
          }
        );

      this.firestoreUnsubscribers.push(
        unsubscribe
      );

      return;
    }

    if (
      profile.role === "customer"
    ) {
      const ordersQuery =
        query(
          collection(
            db,
            COLLECTIONS.orders
          ),
          where(
            "customerId",
            "==",
            profile.id
          )
        );

      const unsubscribe =
        onSnapshot(
          ordersQuery,
          (snapshot) => {
            const incoming =
              snapshot.docs.map(
                (item) =>
                  this.mapOrder(
                    item.id,
                    item.data()
                  )
              );

            this.mergeOrders(
              incoming
            );

            this.notify();
          },
          (error) => {
            console.error(
              "Müşteri sipariş listener hatası:",
              error
            );
          }
        );

      this.firestoreUnsubscribers.push(
        unsubscribe
      );

      return;
    }

    if (
      profile.role === "courier"
    ) {
      const assignedQuery =
        query(
          collection(
            db,
            COLLECTIONS.orders
          ),
          where(
            "courierId",
            "==",
            profile.id
          )
        );

      const pendingQuery =
        query(
          collection(
            db,
            COLLECTIONS.orders
          ),
          where(
            "status",
            "==",
            "Kurye Bekleniyor"
          )
        );

      const assignedUnsubscribe =
        onSnapshot(
          assignedQuery,
          (snapshot) => {
            const incoming =
              snapshot.docs.map(
                (item) =>
                  this.mapOrder(
                    item.id,
                    item.data()
                  )
              );

            this.mergeOrders(
              incoming
            );

            this.notify();
          },
          (error) => {
            console.error(
              "Kurye sipariş listener hatası:",
              error
            );
          }
        );

      const pendingUnsubscribe =
        onSnapshot(
          pendingQuery,
          (snapshot) => {
            const incoming =
              snapshot.docs.map(
                (item) =>
                  this.mapOrder(
                    item.id,
                    item.data()
                  )
              );

            this.mergeOrders(
              incoming
            );

            this.notify();
          },
          (error) => {
            console.error(
              "Bekleyen sipariş listener hatası:",
              error
            );
          }
        );

      this.firestoreUnsubscribers.push(
        assignedUnsubscribe,
        pendingUnsubscribe
      );
    }
  }

  private mergeOrders(
    incoming: Order[]
  ): void {
    const map =
      new Map<string, Order>();

    this.orders.forEach(
      (order) => {
        map.set(
          order.id,
          order
        );
      }
    );

    incoming.forEach(
      (order) => {
        map.set(
          order.id,
          order
        );
      }
    );

    this.orders =
      Array.from(
        map.values()
      ).sort(
        (a, b) =>
          new Date(
            b.createdAt
          ).getTime() -
          new Date(
            a.createdAt
          ).getTime()
      );

    saveCache(
      CACHE_KEYS.orders,
      this.orders
    );
  }

  /* ===================================================
     NOTIFICATION LISTENER
  =================================================== */

  private setupNotificationListener(
    userId: string
  ): void {
    const notificationQuery =
      query(
        collection(
          db,
          COLLECTIONS.notifications
        ),
        where(
          "userId",
          "==",
          userId
        )
      );

    const unsubscribe =
      onSnapshot(
        notificationQuery,
        (snapshot) => {
          this.notifications =
            snapshot.docs.map(
              (item) =>
                this.mapNotification(
                  item.id,
                  item.data()
                )
            );

          this.notifications.sort(
            (a, b) =>
              new Date(
                b.createdAt
              ).getTime() -
              new Date(
                a.createdAt
              ).getTime()
          );

          saveCache(
            CACHE_KEYS.notifications,
            this.notifications
          );

          this.notify();
        },
        (error) => {
          console.error(
            "Bildirim listener hatası:",
            error
          );
        }
      );

    this.firestoreUnsubscribers.push(
      unsubscribe
    );
  }

  /* ===================================================
     LOCATION LISTENER
  =================================================== */

  private setupLocationListener(
    profile: UserProfile
  ): void {
    if (
      profile.role !== "admin" &&
      profile.role !== "customer"
    ) {
      return;
    }

    const unsubscribe =
      onSnapshot(
        collection(
          db,
          COLLECTIONS.courierLocations
        ),
        (snapshot) => {
          this.locations =
            snapshot.docs.map(
              (item) => {
                const data =
                  item.data();

                return {
                  courierId:
                    data.courierId ||
                    item.id,
                  latitude:
                    Number(
                      data.latitude ||
                      0
                    ),
                  longitude:
                    Number(
                      data.longitude ||
                      0
                    ),
                  updatedAt:
                    normalizeTimestamp(
                      data.updatedAt
                    ),
                  isSharing:
                    Boolean(
                      data.isSharing
                    ),
                };
              }
            );

          saveCache(
            CACHE_KEYS.locations,
            this.locations
          );

          this.notify();
        },
        (error) => {
          console.error(
            "Konum listener hatası:",
            error
          );
        }
      );

    this.firestoreUnsubscribers.push(
      unsubscribe
    );
  }

  /* ===================================================
     PRICING
  =================================================== */

  private async loadPricing(): Promise<void> {
    try {
      const snapshot =
        await getDoc(
          doc(
            db,
            COLLECTIONS.pricing,
            "current"
          )
        );

      if (
        snapshot.exists()
      ) {
        this.pricing =
          {
            ...DEFAULT_PRICING,
            ...snapshot.data(),
            updatedAt:
              normalizeTimestamp(
                snapshot.data()
                  .updatedAt
              ),
          };

        saveCache(
          CACHE_KEYS.pricing,
          this.pricing
        );

        return;
      }

      this.pricing =
        {
          ...DEFAULT_PRICING,
          updatedAt:
            new Date().toISOString(),
        };

      saveCache(
        CACHE_KEYS.pricing,
        this.pricing
      );
    } catch (error) {
      console.error(
        "Fiyatlandırma alınamadı:",
        error
      );
    }
  }

  getPricing(): PricingConfig {
    return {
      ...this.pricing,
    };
  }

  setPricing(
    pricing: PricingConfig
  ): void {
    this.pricing = {
      ...pricing,
      updatedAt:
        new Date().toISOString(),
    };

    saveCache(
      CACHE_KEYS.pricing,
      this.pricing
    );

    void this.writePricing();

    this.notify();
  }

  updatePricing(
    pricing: Partial<PricingConfig>
  ): void {
    this.setPricing({
      ...this.pricing,
      ...pricing,
    });
  }

  private async writePricing(): Promise<void> {
    const user =
      auth.currentUser;

    if (!user) {
      return;
    }

    try {
      await setDoc(
        doc(
          db,
          COLLECTIONS.pricing,
          "current"
        ),
        this.pricing,
        {
          merge: true,
        }
      );
    } catch (error) {
      console.error(
        "Fiyatlandırma kaydedilemedi:",
        error
      );
    }
  }

  /* ===================================================
     USERS
  =================================================== */

  getUsers(): UserProfile[] {
    return [
      ...this.users,
    ];
  }

  getUserById(
    id: string
  ): UserProfile | undefined {
    return this.users.find(
      (user) =>
        user.id === id
    );
  }

  getUserByEmail(
    email: string
  ): UserProfile | undefined {
    return this.users.find(
      (user) =>
        user.email
          ?.toLowerCase() ===
        email
          .trim()
          .toLowerCase()
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

  private upsertUser(
    user: UserProfile
  ): void {
    const index =
      this.users.findIndex(
        (item) =>
          item.id === user.id
      );

    if (index >= 0) {
      this.users[index] = {
        ...this.users[index],
        ...user,
      };
    } else {
      this.users.push(user);
    }

    saveCache(
      CACHE_KEYS.users,
      this.users
    );
  }

  saveUser(
    user: UserProfile
  ): UserProfile {
    this.upsertUser(
      user
    );

    void this.writeUser(
      user
    );

    this.notify();

    return user;
  }

  private async writeUser(
    user: UserProfile
  ): Promise<void> {
    if (!auth.currentUser) {
      return;
    }

    try {
      await setDoc(
        doc(
          db,
          COLLECTIONS.users,
          user.id
        ),
        user,
        {
          merge: true,
        }
      );
    } catch (error) {
      console.error(
        "Kullanıcı kaydedilemedi:",
        error
      );
    }
  }

  deleteUser(
    id: string
  ): void {
    this.users =
      this.users.filter(
        (user) =>
          user.id !== id
      );

    saveCache(
      CACHE_KEYS.users,
      this.users
    );

    void this.deleteFirestoreUser(
      id
    );

    this.notify();
  }

  private async deleteFirestoreUser(
    id: string
  ): Promise<void> {
    if (!auth.currentUser) {
      return;
    }

    try {
      await deleteDoc(
        doc(
          db,
          COLLECTIONS.users,
          id
        )
      );
    } catch (error) {
      console.error(
        "Kullanıcı silinemedi:",
        error
      );
    }
  }

  /* ===================================================
     CURRENT USER
  =================================================== */

  getCurrentUser():
    UserProfile | null {
    return this.currentUser;
  }

  setCurrentUser(
    user: UserProfile
  ): void {
    this.currentUser =
      user;

    this.upsertUser(
      user
    );

    saveCache(
      CACHE_KEYS.currentUser,
      user
    );

    this.notify();
  }

  logout(): void {
    this.currentUser =
      null;

    saveCache(
      CACHE_KEYS.currentUser,
      null
    );

    this.notify();
  }

  /* ===================================================
     COURIER STATUS
  =================================================== */

  updateCourierStatus(
    courierId: string,
    status:
      UserProfile["courierStatus"]
  ): UserProfile | undefined {
    const courier =
      this.getUserById(
        courierId
      );

    if (
      !courier ||
      courier.role !== "courier"
    ) {
      return undefined;
    }

    const updatedCourier:
      UserProfile = {
        ...courier,
        courierStatus:
          status,
      };

    this.upsertUser(
      updatedCourier
    );

    if (
      this.currentUser?.id ===
      courierId
    ) {
      this.currentUser =
        updatedCourier;

      saveCache(
        CACHE_KEYS.currentUser,
        this.currentUser
      );
    }

    void this.writeUser(
      updatedCourier
    );

    this.notify();

    return updatedCourier;
  }

  /* ===================================================
     ORDERS
  =================================================== */

  getOrders(): Order[] {
    return [
      ...this.orders,
    ];
  }

  getOrderById(
    id: string
  ): Order | undefined {
    return this.orders.find(
      (order) =>
        order.id === id
    );
  }

  getOrdersByCustomer(
    customerId: string
  ): Order[] {
    return this.orders.filter(
      (order) =>
        order.customerId ===
        customerId
    );
  }

  getOrdersByCourier(
    courierId: string
  ): Order[] {
    return this.orders.filter(
      (order) =>
        order.courierId ===
        courierId
    );
  }

  saveOrder(
    order: Order
  ): Order {
    const updatedOrder:
      Order = {
      ...order,
      updatedAt:
        new Date().toISOString(),
    };

    const index =
      this.orders.findIndex(
        (item) =>
          item.id ===
          order.id
      );

    if (index >= 0) {
      this.orders[index] =
        updatedOrder;
    } else {
      this.orders.unshift(
        updatedOrder
      );
    }

    saveCache(
      CACHE_KEYS.orders,
      this.orders
    );

    void this.writeOrder(
      updatedOrder
    );

    this.notify();

    return updatedOrder;
  }

  private async writeOrder(
    order: Order
  ): Promise<void> {
    if (!auth.currentUser) {
      console.warn(
        "Sipariş kaydedilemedi: Firebase oturumu yok."
      );

      return;
    }

    try {
      await setDoc(
        doc(
          db,
          COLLECTIONS.orders,
          order.id
        ),
        {
          ...order,
        },
        {
          merge: true,
        }
      );
    } catch (error) {
      console.error(
        "Sipariş Firestore'a yazılamadı:",
        error
      );
    }
  }

  updateOrder(
    id: string,
    updates: Partial<Order>
  ): Order | undefined {
    const order =
      this.getOrderById(id);

    if (!order) {
      return undefined;
    }

    return this.saveOrder({
      ...order,
      ...updates,
    });
  }

  updateOrderStatus(
    id: string,
    status: Order["status"]
  ): Order | undefined {
    return this.updateOrder(
      id,
      {
        status,
      }
    );
  }

  updateOrderPrice(
    id: string,
    price: number
  ): Order | undefined {
    return this.updateOrder(
      id,
      {
        price,
      }
    );
  }

  deleteOrder(
    id: string
  ): void {
    this.orders =
      this.orders.filter(
        (order) =>
          order.id !== id
      );

    saveCache(
      CACHE_KEYS.orders,
      this.orders
    );

    void this.deleteFirestoreOrder(
      id
    );

    this.notify();
  }

  private async deleteFirestoreOrder(
    id: string
  ): Promise<void> {
    if (!auth.currentUser) {
      return;
    }

    try {
      await deleteDoc(
        doc(
          db,
          COLLECTIONS.orders,
          id
        )
      );
    } catch (error) {
      console.error(
        "Sipariş silinemedi:",
        error
      );
    }
  }

  /* ===================================================
     CREATE ORDER
  =================================================== */

  createOrder(
    data: Partial<Order>
  ): Order {
    const firebaseUser =
      auth.currentUser;

    const customerId =
      data.customerId ||
      firebaseUser?.uid ||
      this.currentUser?.id ||
      "";

    const customerName =
      data.customerName ||
      this.currentUser?.name ||
      firebaseUser?.displayName ||
      "";

    const customerPhone =
      data.customerPhone ||
      this.currentUser?.phone ||
      "";

    const distanceKm =
      typeof data.distanceKm ===
      "number"
        ? Math.max(
            0,
            data.distanceKm
          )
        : 0;

    const courierType =
      data.courierType ||
      "Standart Kurye";

    const calculated =
      calculateOrderPrice(
        distanceKm,
        courierType,
        this.pricing
      );

    const now =
      new Date().toISOString();

    const order: Order = {
      id: generateId("ORD"),

      customerId,

      customerName,

      customerPhone,

      courierId:
        data.courierId ||
        null,

      courierName:
        data.courierName,

      courierPhone:
        data.courierPhone,

      pickupAddress:
        data.pickupAddress ||
        "",

      deliveryAddress:
        data.deliveryAddress ||
        "",

      packageType:
        data.packageType ||
        "Evrak",

      courierType,

      urgency:
        data.urgency ||
        "Normal",

      distanceKm,

      packageCount:
        data.packageCount,

      price:
        calculated.finalPrice,

      status:
        data.status ||
        "Kurye Bekleniyor",

      note:
        data.note ||
        "",

      estimatedDeliveryMinutes:
        data.estimatedDeliveryMinutes,

      deliveryProof:
        data.deliveryProof,

      deliveryPhoto:
        data.deliveryPhoto,

      receiverName:
        data.receiverName,

      deliveryNote:
        data.deliveryNote,

      signature:
        data.signature,

      deliveredAt:
        data.deliveredAt,

      createdAt:
        data.createdAt ||
        now,

      updatedAt:
        now,
    };

    this.orders.unshift(
      order
    );

    saveCache(
      CACHE_KEYS.orders,
      this.orders
    );

    void this.writeOrder(
      order
    );

    this.notify();

    return order;
  }

  /* ===================================================
     NOTIFICATIONS
  =================================================== */

  getNotifications(
    userId?: string
  ): NotificationItem[] {
    if (!userId) {
      return [
        ...this.notifications,
      ];
    }

    return this.notifications.filter(
      (notification) =>
        notification.userId ===
        userId
    );
  }

  addNotification(
    notification: NotificationItem
  ): void {
    this.notifications.unshift(
      notification
    );

    saveCache(
      CACHE_KEYS.notifications,
      this.notifications
    );

    void this.writeNotification(
      notification
    );

    this.notify();
  }

  private async writeNotification(
    notification: NotificationItem
  ): Promise<void> {
    if (!auth.currentUser) {
      return;
    }

    try {
      await setDoc(
        doc(
          db,
          COLLECTIONS.notifications,
          notification.id
        ),
        notification,
        {
          merge: true,
        }
      );
    } catch (error) {
      console.error(
        "Bildirim kaydedilemedi:",
        error
      );
    }
  }

  markNotificationRead(
    id: string
  ): void {
    const notification =
      this.notifications.find(
        (item) =>
          item.id === id
      );

    if (!notification) {
      return;
    }

    notification.read =
      true;

    saveCache(
      CACHE_KEYS.notifications,
      this.notifications
    );

    void this.updateNotification(
      id,
      {
        read: true,
      }
    );

    this.notify();
  }

  markAllNotificationsRead(
    userId: string
  ): void {
    this.notifications =
      this.notifications.map(
        (notification) =>
          notification.userId ===
          userId
            ? {
                ...notification,
                read: true,
              }
            : notification
      );

    saveCache(
      CACHE_KEYS.notifications,
      this.notifications
    );

    this.notifications
      .filter(
        (notification) =>
          notification.userId ===
          userId
      )
      .forEach(
        (notification) => {
          void this.updateNotification(
            notification.id,
            {
              read: true,
            }
          );
        }
      );

    this.notify();
  }

  private async updateNotification(
    id: string,
    updates: Partial<NotificationItem>
  ): Promise<void> {
    if (!auth.currentUser) {
      return;
    }

    try {
      await updateDoc(
        doc(
          db,
          COLLECTIONS.notifications,
          id
        ),
        updates
      );
    } catch (error) {
      console.error(
        "Bildirim güncellenemedi:",
        error
      );
    }
  }

  /* ===================================================
     COURIER LOCATIONS
  =================================================== */

  getCourierLocations():
    CourierLocation[] {
    return [
      ...this.locations,
    ];
  }

  getCourierLocation(
    courierId: string
  ):
    CourierLocation | undefined {
    return this.locations.find(
      (location) =>
        location.courierId ===
        courierId
    );
  }

  updateCourierLocation(
    location: CourierLocation
  ): void {
    const index =
      this.locations.findIndex(
        (item) =>
          item.courierId ===
          location.courierId
      );

    if (index >= 0) {
      this.locations[index] = {
        ...this.locations[index],
        ...location,
      };
    } else {
      this.locations.push(
        location
      );
    }

    saveCache(
      CACHE_KEYS.locations,
      this.locations
    );

    void this.writeCourierLocation(
      location
    );

    this.notify();
  }

  private async writeCourierLocation(
    location: CourierLocation
  ): Promise<void> {
    if (!auth.currentUser) {
      return;
    }

    try {
      await setDoc(
        doc(
          db,
          COLLECTIONS.courierLocations,
          location.courierId
        ),
        location,
        {
          merge: true,
        }
      );
    } catch (error) {
      console.error(
        "Kurye konumu kaydedilemedi:",
        error
      );
    }
  }

  /* ===================================================
     ASSIGN COURIER
  =================================================== */

  assignCourier(
    orderId: string,
    courierId: string
  ): Order | undefined {
    const order =
      this.getOrderById(
        orderId
      );

    if (!order) {
      return undefined;
    }

    const courier =
      this.getUserById(
        courierId
      );

    if (
      !courier ||
      courier.role !== "courier"
    ) {
      return undefined;
    }

    const updatedOrder:
      Order = {
      ...order,

      courierId,

      courierName:
        courier.name,

      courierPhone:
        courier.phone,

      status:
        "Kurye Atandı",

      updatedAt:
        new Date().toISOString(),
    };

    this.orders =
      this.orders.map(
        (item) =>
          item.id === orderId
            ? updatedOrder
            : item
      );

    saveCache(
      CACHE_KEYS.orders,
      this.orders
    );

    void this.writeOrder(
      updatedOrder
    );

    const notification:
      NotificationItem = {
      id:
        generateId("NOT"),

      userId:
        courierId,

      orderId,

      title:
        "Yeni Görev",

      message:
        `Yeni teslimat görevi atandı. Sipariş: ${orderId}`,

      type:
        "assignment",

      read:
        false,

      createdAt:
        new Date().toISOString(),
    };

    this.notifications.unshift(
      notification
    );

    saveCache(
      CACHE_KEYS.notifications,
      this.notifications
    );

    void this.writeNotification(
      notification
    );

    this.notify();

    return updatedOrder;
  }

  /* ===================================================
     DELIVER ORDER
  =================================================== */

  markOrderDelivered(
    orderId: string,
    proof?: string
  ): Order | undefined {
    const order =
      this.getOrderById(
        orderId
      );

    if (!order) {
      return undefined;
    }

    const deliveredAt =
      new Date().toISOString();

    const updatedOrder:
      Order = {
      ...order,

      status:
        "Teslim Edildi",

      deliveredAt,

      deliveryPhoto:
        proof ||
        order.deliveryPhoto,

      updatedAt:
        deliveredAt,
    };

    this.orders =
      this.orders.map(
        (item) =>
          item.id === orderId
            ? updatedOrder
            : item
      );

    saveCache(
      CACHE_KEYS.orders,
      this.orders
    );

    void this.writeOrder(
      updatedOrder
    );

    if (
      order.customerId
    ) {
      const notification:
        NotificationItem = {
        id:
          generateId("NOT"),

        userId:
          order.customerId,

        orderId,

        title:
          "Teslimat Tamamlandı",

        message:
          "Siparişiniz başarıyla teslim edildi.",

        type:
          "order_status",

        read:
          false,

        createdAt:
          deliveredAt,
      };

      this.notifications.unshift(
        notification
      );

      saveCache(
        CACHE_KEYS.notifications,
        this.notifications
      );

      void this.writeNotification(
        notification
      );
    }

    this.notify();

    return updatedOrder;
  }

  /* ===================================================
     ADD COURIER
     
     Not:
     Firebase Authentication hesabı oluşturmaz.
     AdminPanel'deki eski API uyumluluğu için tutulur.
     Gerçek kurye hesabı Firebase Auth üzerinden
     ayrı onboarding akışıyla oluşturulacaktır.
  =================================================== */

  addCourier(data: {
    name: string;
    phone: string;
    email?: string;
  }): UserProfile {
    const courier:
      UserProfile = {
      id:
        generateId("COURIER"),

      name:
        data.name.trim(),

      phone:
        data.phone.trim(),

      email:
        data.email?.trim() ||
        "",

      role:
        "courier",

      courierStatus:
        "Müsait",

      totalDeliveries:
        0,

      rating:
        0,

      createdAt:
        new Date().toISOString(),
    };

    this.upsertUser(
      courier
    );

    void this.writeUser(
      courier
    );

    this.notify();

    return courier;
  }

  /* ===================================================
     FIRESTORE MAPPERS
  =================================================== */

  private mapUserProfile(
    id: string,
    data: any
  ): UserProfile {
    return {
      id,

      name:
        data.name ||
        "Kullanıcı",

      email:
        data.email ||
        "",

      phone:
        data.phone ||
        "",

      role:
        data.role ||
        "customer",

      avatar:
        data.avatar,

      vehicle:
        data.vehicle,

      plate:
        data.plate,

      courierStatus:
        data.courierStatus,

      totalDeliveries:
        data.totalDeliveries,

      rating:
        data.rating,

      createdAt:
        normalizeTimestamp(
          data.createdAt
        ),
    };
  }

  private mapOrder(
    id: string,
    data: any
  ): Order {
    return {
      id,

      customerId:
        data.customerId ||
        "",

      customerName:
        data.customerName ||
        "",

      customerPhone:
        data.customerPhone ||
        "",

      courierId:
        data.courierId ||
        null,

      courierName:
        data.courierName,

      courierPhone:
        data.courierPhone,

      pickupAddress:
        data.pickupAddress ||
        "",

      deliveryAddress:
        data.deliveryAddress ||
        "",

      packageType:
        data.packageType ||
        "Evrak",

      courierType:
        data.courierType ||
        "Standart Kurye",

      urgency:
        data.urgency ||
        "Normal",

      distanceKm:
        Number(
          data.distanceKm ||
          0
        ),

      packageCount:
        data.packageCount,

      price:
        Number(
          data.price ||
          0
        ),

      status:
        data.status ||
        "Kurye Bekleniyor",

      note:
        data.note ||
        "",

      estimatedDeliveryMinutes:
        data.estimatedDeliveryMinutes,

      deliveryProof:
        data.deliveryProof,

      deliveryPhoto:
        data.deliveryPhoto,

      receiverName:
        data.receiverName,

      deliveryNote:
        data.deliveryNote,

      signature:
        data.signature,

      deliveredAt:
        data.deliveredAt
          ? normalizeTimestamp(
              data.deliveredAt
            )
          : undefined,

      createdAt:
        normalizeTimestamp(
          data.createdAt
        ),

      updatedAt:
        normalizeTimestamp(
          data.updatedAt
        ),
    };
  }

  private mapNotification(
    id: string,
    data: any
  ): NotificationItem {
    return {
      id,

      userId:
        data.userId ||
        "",

      orderId:
        data.orderId,

      title:
        data.title ||
        "",

      message:
        data.message ||
        "",

      type:
        data.type ||
        "info",

      read:
        Boolean(
          data.read
        ),

      createdAt:
        normalizeTimestamp(
          data.createdAt
        ),
    };
  }

  /* ===================================================
     RESET
     
     V1'de reset artık demo verisi üretmez.
     Sadece local cache temizlenir.
  =================================================== */

  reset(): void {
    this.users = [];
    this.orders = [];
    this.notifications = [];
    this.locations = [];

    this.pricing = {
      ...DEFAULT_PRICING,
      updatedAt:
        new Date().toISOString(),
    };

    this.currentUser =
      null;

    this.persistCache();

    this.notify();
  }

  resetDemoData(): void {
    this.reset();
  }

  /* ===================================================
     CLEANUP
  =================================================== */

  destroy(): void {
    this.clearFirestoreListeners();

    if (
      this.authUnsubscribe
    ) {
      this.authUnsubscribe();

      this.authUnsubscribe =
        null;
    }

    this.listeners = [];
  }
}

/* =====================================================
   SINGLETON
===================================================== */

export const storage =
  new StorageService();