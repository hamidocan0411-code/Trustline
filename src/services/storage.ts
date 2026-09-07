import type {
  UserProfile,
  Order,
  NotificationItem,
  CourierLocation,
  PricingConfig,
} from "../types";

import {
  SEED_CUSTOMERS,
  SEED_COURIERS,
  SEED_ADMIN,
  SEED_ORDERS,
} from "../data/seedData";

import {
  calculateOrderPrice,
  DEFAULT_PRICING,
} from "../utils/pricing";

import {
  db,
  ensureFirebaseAuth,
} from "./firebase";

import {
  collection,
  doc,
  deleteDoc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";

type Listener = () => void;

type FirestoreTimestampLike = {
  toDate?: () => Date;
};

function normalizeDate(value: unknown): string {
  if (!value) {
    return new Date().toISOString();
  }

  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value
  ) {
    const timestamp = value as FirestoreTimestampLike;

    if (typeof timestamp.toDate === "function") {
      return timestamp.toDate().toISOString();
    }
  }

  return new Date().toISOString();
}

function normalizeUser(
  data: Partial<UserProfile>
): UserProfile {
  return {
    id: String(data.id || ""),
    name: String(data.name || ""),
    email: String(data.email || ""),
    phone: String(data.phone || ""),
    role: data.role || "customer",
    avatar: data.avatar,
    vehicle: data.vehicle,
    plate: data.plate,
    courierStatus: data.courierStatus,
    totalDeliveries:
      typeof data.totalDeliveries === "number"
        ? data.totalDeliveries
        : 0,
    rating:
      typeof data.rating === "number"
        ? data.rating
        : undefined,
    createdAt: normalizeDate(data.createdAt),
  };
}

function normalizeOrder(
  data: Partial<Order>
): Order {
  return {
    id: String(data.id || ""),
    customerId: String(data.customerId || ""),
    customerName: String(data.customerName || ""),
    customerPhone: String(data.customerPhone || ""),

    courierId:
      data.courierId === undefined
        ? null
        : data.courierId,

    courierName: data.courierName,
    courierPhone: data.courierPhone,

    pickupAddress: String(
      data.pickupAddress || ""
    ),

    deliveryAddress: String(
      data.deliveryAddress || ""
    ),

    packageType:
      data.packageType || "Diğer",

    courierType:
      data.courierType || "Standart Kurye",

    urgency:
      data.urgency || "Normal",

    distanceKm:
      typeof data.distanceKm === "number"
        ? data.distanceKm
        : 0,

    packageCount:
      typeof data.packageCount === "number"
        ? data.packageCount
        : undefined,

    price:
      typeof data.price === "number"
        ? data.price
        : 0,

    status:
      data.status || "Kurye Bekleniyor",

    note:
      typeof data.note === "string"
        ? data.note
        : "",

    estimatedDeliveryMinutes:
      typeof data.estimatedDeliveryMinutes === "number"
        ? data.estimatedDeliveryMinutes
        : undefined,

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
        ? normalizeDate(data.deliveredAt)
        : undefined,

    createdAt:
      normalizeDate(data.createdAt),

    updatedAt:
      normalizeDate(data.updatedAt),
  };
}

function normalizeNotification(
  data: Partial<NotificationItem>
): NotificationItem {
  return {
    id: String(data.id || ""),
    userId: String(data.userId || ""),
    orderId: data.orderId,

    title:
      String(data.title || ""),

    message:
      String(data.message || ""),

    type:
      data.type || "info",

    read:
      Boolean(data.read),

    createdAt:
      normalizeDate(data.createdAt),
  };
}

function normalizeLocation(
  data: Partial<CourierLocation>
): CourierLocation {
  return {
    courierId:
      String(data.courierId || ""),

    latitude:
      typeof data.latitude === "number"
        ? data.latitude
        : 0,

    longitude:
      typeof data.longitude === "number"
        ? data.longitude
        : 0,

    updatedAt:
      normalizeDate(data.updatedAt),

    isSharing:
      Boolean(data.isSharing),
  };
}

function normalizePricing(
  data: Partial<PricingConfig>
): PricingConfig {
  return {
    perKmPrice:
      typeof data.perKmPrice === "number"
        ? data.perKmPrice
        : DEFAULT_PRICING.perKmPrice,

    minPrice:
      typeof data.minPrice === "number"
        ? data.minPrice
        : DEFAULT_PRICING.minPrice,

    urgentMultiplier:
      typeof data.urgentMultiplier === "number"
        ? data.urgentMultiplier
        : DEFAULT_PRICING.urgentMultiplier,

    vipMultiplier:
      typeof data.vipMultiplier === "number"
        ? data.vipMultiplier
        : DEFAULT_PRICING.vipMultiplier,

    requireDeliveryPhoto:
      Boolean(
        data.requireDeliveryPhoto ??
        DEFAULT_PRICING.requireDeliveryPhoto
      ),

    updatedAt:
      normalizeDate(data.updatedAt),
  };
}

function generateId(
  prefix: string
): string {
  return (
    prefix +
    "-" +
    Date.now().toString(36).toUpperCase() +
    "-" +
    Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()
  );
}

class StorageService {
  private users: UserProfile[] = [];

  private orders: Order[] = [];

  private notifications: NotificationItem[] = [];

  private locations: CourierLocation[] = [];

  private currentUser: UserProfile;

  private pricing: PricingConfig =
    normalizePricing(DEFAULT_PRICING);

  private listeners: Listener[] = [];

  private firestoreUnsubscribers: Array<
    () => void
  > = [];

  private initialized = false;

  constructor() {
    const initialUsers: UserProfile[] = [
      ...SEED_CUSTOMERS,
      ...SEED_COURIERS,
      SEED_ADMIN,
    ].map(normalizeUser);

    this.users = initialUsers;

    this.orders =
      SEED_ORDERS.map(normalizeOrder);

    this.currentUser =
      this.users.find(
        (user) =>
          user.role === "customer"
      ) ||
      this.users[0];

    this.startFirebaseSync();
  }

  // =====================================================
  // FIREBASE INITIALIZATION
  // =====================================================

  private async startFirebaseSync(): Promise<void> {
    try {
      await ensureFirebaseAuth();

      if (this.initialized) {
        return;
      }

      this.initialized = true;

      this.attachRealtimeListeners();

      await this.ensurePricingDocument();

    } catch (error) {
      console.warn(
        "Trustline Firebase sync başlatılamadı:",
        error
      );
    }
  }

  private attachRealtimeListeners(): void {
    this.detachRealtimeListeners();

    const usersUnsubscribe =
      onSnapshot(
        collection(db, "users"),
        (snapshot) => {
          const users =
            snapshot.docs.map((item) =>
              normalizeUser({
                id: item.id,
                ...item.data(),
              } as UserProfile)
            );

          if (users.length > 0) {
            this.users = users;

            const current =
              this.users.find(
                (user) =>
                  user.id ===
                  this.currentUser?.id
              );

            if (current) {
              this.currentUser = current;
            } else {
              const customer =
                this.users.find(
                  (user) =>
                    user.role === "customer"
                );

              if (customer) {
                this.currentUser =
                  customer;
              }
            }

            this.notify();
          }
        },
        (error) => {
          console.warn(
            "Firestore users listener:",
            error
          );
        }
      );

    const ordersUnsubscribe =
      onSnapshot(
        collection(db, "orders"),
        (snapshot) => {
          this.orders =
            snapshot.docs
              .map((item) =>
                normalizeOrder({
                  id: item.id,
                  ...item.data(),
                } as Order)
              )
              .sort(
                (a, b) =>
                  new Date(
                    b.createdAt
                  ).getTime() -
                  new Date(
                    a.createdAt
                  ).getTime()
              );

          this.notify();
        },
        (error) => {
          console.warn(
            "Firestore orders listener:",
            error
          );
        }
      );

    const notificationsUnsubscribe =
      onSnapshot(
        collection(
          db,
          "notifications"
        ),
        (snapshot) => {
          this.notifications =
            snapshot.docs
              .map((item) =>
                normalizeNotification({
                  id: item.id,
                  ...item.data(),
                } as NotificationItem)
              )
              .sort(
                (a, b) =>
                  new Date(
                    b.createdAt
                  ).getTime() -
                  new Date(
                    a.createdAt
                  ).getTime()
              );

          this.notify();
        },
        (error) => {
          console.warn(
            "Firestore notifications listener:",
            error
          );
        }
      );

    const locationsUnsubscribe =
      onSnapshot(
        collection(
          db,
          "courierLocations"
        ),
        (snapshot) => {
          this.locations =
            snapshot.docs.map((item) =>
              normalizeLocation({
                courierId: item.id,
                ...item.data(),
              } as CourierLocation)
            );

          this.notify();
        },
        (error) => {
          console.warn(
            "Firestore courier locations listener:",
            error
          );
        }
      );

    const pricingUnsubscribe =
      onSnapshot(
        doc(
          db,
          "pricing",
          "current"
        ),
        (snapshot) => {
          if (snapshot.exists()) {
            this.pricing =
              normalizePricing(
                snapshot.data() as PricingConfig
              );

            this.notify();
          }
        },
        (error) => {
          console.warn(
            "Firestore pricing listener:",
            error
          );
        }
      );

    this.firestoreUnsubscribers = [
      usersUnsubscribe,
      ordersUnsubscribe,
      notificationsUnsubscribe,
      locationsUnsubscribe,
      pricingUnsubscribe,
    ];
  }

  private detachRealtimeListeners(): void {
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
  }

  private async ensurePricingDocument(): Promise<void> {
    try {
      const pricingRef =
        doc(
          db,
          "pricing",
          "current"
        );

      const snapshot =
        await getDoc(pricingRef);

      if (!snapshot.exists()) {
        await setDoc(
          pricingRef,
          normalizePricing(
            DEFAULT_PRICING
          )
        );
      }
    } catch (error) {
      console.warn(
        "Pricing document oluşturulamadı:",
        error
      );
    }
  }

  // =====================================================
  // SUBSCRIBE
  // =====================================================

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
        } catch {
          // Bir listener hata verse bile
          // diğerleri çalışmaya devam eder.
        }
      }
    );
  }

  // =====================================================
  // USERS
  // =====================================================

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

  getUserByEmail(
    email: string
  ): UserProfile | undefined {
    return this.users.find(
      (user) =>
        user.email?.toLowerCase() ===
        email.toLowerCase()
    );
  }

  // =====================================================
  // COURIERS
  // =====================================================

  getCouriers(): UserProfile[] {
    return this.users.filter(
      (user) =>
        user.role === "courier"
    );
  }

  // =====================================================
  // CUSTOMERS
  // =====================================================

  getCustomers(): UserProfile[] {
    return this.users.filter(
      (user) =>
        user.role === "customer"
    );
  }

  // =====================================================
  // SAVE USER
  // =====================================================

  saveUser(
    user: UserProfile
  ): UserProfile {
    const normalized =
      normalizeUser(user);

    const index =
      this.users.findIndex(
        (item) =>
          item.id ===
          normalized.id
      );

    if (index >= 0) {
      this.users[index] = {
        ...this.users[index],
        ...normalized,
      };
    } else {
      this.users.push(normalized);
    }

    if (
      this.currentUser &&
      this.currentUser.id ===
        normalized.id
    ) {
      this.currentUser = {
        ...this.currentUser,
        ...normalized,
      };
    }

    void this.writeUserToFirestore(
      normalized
    );

    this.notify();

    return normalized;
  }

  private async writeUserToFirestore(
    user: UserProfile
  ): Promise<void> {
    try {
      await ensureFirebaseAuth();

      await setDoc(
        doc(
          db,
          "users",
          user.id
        ),
        user,
        {
          merge: true,
        }
      );
    } catch (error) {
      console.warn(
        "Kullanıcı Firestore'a yazılamadı:",
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

    void this.deleteUserFromFirestore(
      id
    );

    this.notify();
  }

  private async deleteUserFromFirestore(
    id: string
  ): Promise<void> {
    try {
      await ensureFirebaseAuth();

      await deleteDoc(
        doc(
          db,
          "users",
          id
        )
      );
    } catch (error) {
      console.warn(
        "Kullanıcı silinemedi:",
        error
      );
    }
  }

  // =====================================================
  // CURRENT USER
  // =====================================================

  getCurrentUser(): UserProfile {
    return this.currentUser;
  }

  setCurrentUser(
    user: UserProfile
  ): void {
    this.currentUser =
      normalizeUser(user);

    const existingIndex =
      this.users.findIndex(
        (item) =>
          item.id ===
          user.id
      );

    if (existingIndex >= 0) {
      this.users[
        existingIndex
      ] = {
        ...this.users[
          existingIndex
        ],
        ...this.currentUser,
      };
    } else {
      this.users.push(
        this.currentUser
      );
    }

    this.notify();
  }

  logout(): void {
    const defaultUser =
      this.users.find(
        (user) =>
          user.role ===
          "customer"
      ) ||
      this.users[0];

    if (defaultUser) {
      this.currentUser =
        defaultUser;
    }

    this.notify();
  }

  // =====================================================
  // COURIER STATUS
  // =====================================================

  updateCourierStatus(
    courierId: string,
    status: UserProfile["courierStatus"]
  ): UserProfile | undefined {
    const index =
      this.users.findIndex(
        (user) =>
          user.id ===
            courierId &&
          user.role ===
            "courier"
      );

    if (index < 0) {
      return undefined;
    }

    const updatedCourier =
      normalizeUser({
        ...this.users[index],
        courierStatus:
          status,
      });

    this.users[index] =
      updatedCourier;

    if (
      this.currentUser &&
      this.currentUser.id ===
        courierId
    ) {
      this.currentUser =
        updatedCourier;
    }

    void this.writeUserToFirestore(
      updatedCourier
    );

    this.notify();

    return updatedCourier;
  }

  // =====================================================
  // PRICING
  // =====================================================

  getPricing(): PricingConfig {
    return {
      ...this.pricing,
    };
  }

  setPricing(
    pricing: PricingConfig
  ): void {
    this.pricing =
      normalizePricing({
        ...pricing,
        updatedAt:
          new Date().toISOString(),
      });

    void this.writePricingToFirestore(
      this.pricing
    );

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

  private async writePricingToFirestore(
    pricing: PricingConfig
  ): Promise<void> {
    try {
      await ensureFirebaseAuth();

      await setDoc(
        doc(
          db,
          "pricing",
          "current"
        ),
        pricing,
        {
          merge: true,
        }
      );
    } catch (error) {
      console.warn(
        "Fiyatlandırma Firestore'a yazılamadı:",
        error
      );
    }
  }

  // =====================================================
  // ORDERS
  // =====================================================

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
    const normalized =
      normalizeOrder({
        ...order,
        updatedAt:
          new Date().toISOString(),
      });

    const index =
      this.orders.findIndex(
        (item) =>
          item.id ===
          normalized.id
      );

    if (index >= 0) {
      this.orders[index] =
        normalized;
    } else {
      this.orders.unshift(
        normalized
      );
    }

    void this.writeOrderToFirestore(
      normalized
    );

    this.notify();

    return normalized;
  }

  private async writeOrderToFirestore(
    order: Order
  ): Promise<void> {
    try {
      await ensureFirebaseAuth();

      await setDoc(
        doc(
          db,
          "orders",
          order.id
        ),
        order,
        {
          merge: true,
        }
      );
    } catch (error) {
      console.warn(
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
    } as Order);
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

    void this.deleteOrderFromFirestore(
      id
    );

    this.notify();
  }

  private async deleteOrderFromFirestore(
    id: string
  ): Promise<void> {
    try {
      await ensureFirebaseAuth();

      await deleteDoc(
        doc(
          db,
          "orders",
          id
        )
      );
    } catch (error) {
      console.warn(
        "Sipariş silinemedi:",
        error
      );
    }
  }

  // =====================================================
  // CREATE ORDER
  // =====================================================

  createOrder(
    data: Partial<Order>
  ): Order {
    const id =
      "ORD-" +
      Date.now()
        .toString(36)
        .toUpperCase() +
      "-" +
      Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase();

    const distanceKm =
      typeof data.distanceKm ===
      "number"
        ? data.distanceKm
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

    /*
     * V1 NOTU:
     *
     * Frontend'den gelen fiyatı doğrudan
     * güvenilir kabul etmiyoruz.
     *
     * Fiyatlandırma sisteminin hesapladığı
     * değer ana değer olarak kullanılıyor.
     */
    const price =
      calculated.finalPrice;

    const now =
      new Date().toISOString();

    const order =
      normalizeOrder({
        ...data,

        id,

        distanceKm,

        courierType,

        price,

        status:
          data.status ||
          "Kurye Bekleniyor",

        createdAt:
          data.createdAt ||
          now,

        updatedAt: now,
      });

    this.orders.unshift(
      order
    );

    void this.writeOrderToFirestore(
      order
    );

    this.notify();

    return order;
  }

  // =====================================================
  // NOTIFICATIONS
  // =====================================================

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
          userId ||
        notification.userId ===
          "all"
    );
  }

  addNotification(
    notification: NotificationItem
  ): void {
    const normalized =
      normalizeNotification(
        notification
      );

    this.notifications.unshift(
      normalized
    );

    void this.writeNotificationToFirestore(
      normalized
    );

    this.notify();
  }

  private async writeNotificationToFirestore(
    notification: NotificationItem
  ): Promise<void> {
    try {
      await ensureFirebaseAuth();

      await setDoc(
        doc(
          db,
          "notifications",
          notification.id
        ),
        notification,
        {
          merge: true,
        }
      );
    } catch (error) {
      console.warn(
        "Bildirim Firestore'a yazılamadı:",
        error
      );
    }
  }

  markNotificationRead(
    id: string
  ): void {
    this.notifications =
      this.notifications.map(
        (notification) =>
          notification.id ===
          id
            ? {
                ...notification,
                read: true,
              }
            : notification
      );

    void this.updateNotificationInFirestore(
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
              userId ||
          notification.userId ===
              "all"
            ? {
                ...notification,
                read: true,
              }
            : notification
      );

    const affected =
      this.notifications.filter(
        (notification) =>
          notification.userId ===
            userId ||
          notification.userId ===
            "all"
      );

    affected.forEach(
      (notification) => {
        void this.updateNotificationInFirestore(
          notification.id,
          {
            read: true,
          }
        );
      }
    );

    this.notify();
  }

  private async updateNotificationInFirestore(
    id: string,
    updates: Partial<NotificationItem>
  ): Promise<void> {
    try {
      await ensureFirebaseAuth();

      await updateDoc(
        doc(
          db,
          "notifications",
          id
        ),
        updates
      );
    } catch (error) {
      console.warn(
        "Bildirim güncellenemedi:",
        error
      );
    }
  }

  // =====================================================
  // COURIER LOCATIONS
  // =====================================================

  getCourierLocations(): CourierLocation[] {
    return [
      ...this.locations,
    ];
  }

  getCourierLocation(
    courierId: string
  ): CourierLocation | undefined {
    return this.locations.find(
      (location) =>
        location.courierId ===
        courierId
    );
  }

  updateCourierLocation(
    location: CourierLocation
  ): void {
    const normalized =
      normalizeLocation(
        location
      );

    const index =
      this.locations.findIndex(
        (item) =>
          item.courierId ===
          normalized.courierId
      );

    if (index >= 0) {
      this.locations[
        index
      ] = {
        ...this.locations[
          index
        ],
        ...normalized,
      };
    } else {
      this.locations.push(
        normalized
      );
    }

    void this.writeCourierLocationToFirestore(
      normalized
    );

    this.notify();
  }

  private async writeCourierLocationToFirestore(
    location: CourierLocation
  ): Promise<void> {
    try {
      await ensureFirebaseAuth();

      await setDoc(
        doc(
          db,
          "courierLocations",
          location.courierId
        ),
        location,
        {
          merge: true,
        }
      );
    } catch (error) {
      console.warn(
        "Kurye konumu Firestore'a yazılamadı:",
        error
      );
    }
  }

  // =====================================================
  // ASSIGN COURIER
  // =====================================================

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
      courier.role !==
        "courier"
    ) {
      return undefined;
    }

    const updatedOrder =
      normalizeOrder({
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
      });

    this.orders =
      this.orders.map(
        (item) =>
          item.id ===
          orderId
            ? updatedOrder
            : item
      );

    void this.writeOrderToFirestore(
      updatedOrder
    );

    const notification: NotificationItem =
      {
        id: generateId(
          "NOT"
        ),

        userId:
          courierId,

        orderId,

        title:
          "Yeni Görev",

        message:
          `Yeni teslimat görevi atandı. Sipariş: ${orderId}`,

        type:
          "assignment",

        read: false,

        createdAt:
          new Date().toISOString(),
      };

    this.addNotification(
      notification
    );

    this.notify();

    return updatedOrder;
  }

  // =====================================================
  // DELIVER ORDER
  // =====================================================

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

    const now =
      new Date().toISOString();

    const updatedOrder =
      normalizeOrder({
        ...order,

        status:
          "Teslim Edildi",

        deliveredAt:
          now,

        deliveryProof:
          proof
            ? {
                ...(order.deliveryProof ||
                  {
                    receiverName:
                      "",
                    signature:
                      "",
                    deliveredAt:
                      now,
                  }),

                deliveryPhoto:
                  proof,

                deliveredAt:
                  now,
              }
            : order.deliveryProof,

        deliveryPhoto:
          proof ||
          order.deliveryPhoto,

        updatedAt:
          now,
      });

    this.orders =
      this.orders.map(
        (item) =>
          item.id ===
          orderId
            ? updatedOrder
            : item
      );

    void this.writeOrderToFirestore(
      updatedOrder
    );

    if (order.customerId) {
      this.addNotification(
        {
          id: generateId(
            "NOT"
          ),

          userId:
            order.customerId,

          orderId,

          title:
            "Teslimat Tamamlandı",

          message:
            "Siparişiniz başarıyla teslim edildi.",

          type:
            "order_status",

          read: false,

          createdAt:
            now,
        }
      );
    }

    this.notify();

    return updatedOrder;
  }

  // =====================================================
  // ADD COURIER
  // =====================================================

  addCourier(data: {
    name: string;
    phone: string;
    email?: string;
  }): UserProfile {
    const courier =
      normalizeUser({
        id:
          "COURIER-" +
          Date.now()
            .toString(36)
            .toUpperCase(),

        name:
          data.name,

        phone:
          data.phone,

        email:
          data.email ||
          `courier${Date.now()}@trustlineexpress.com`,

        role:
          "courier",

        courierStatus:
          "Müsait",

        totalDeliveries:
          0,

        createdAt:
          new Date().toISOString(),
      });

    this.users.push(
      courier
    );

    void this.writeUserToFirestore(
      courier
    );

    this.notify();

    return courier;
  }

  // =====================================================
  // RESET
  // =====================================================

  reset(): void {
    /*
     * RESET artık yalnızca demo verisini
     * bellekte sıfırlamak için kullanılır.
     *
     * Production Firestore verilerini
     * yanlışlıkla silmemek için
     * toplu delete yapılmaz.
     */

    this.users = [
      ...SEED_CUSTOMERS,
      ...SEED_COURIERS,
      SEED_ADMIN,
    ].map(normalizeUser);

    this.orders =
      SEED_ORDERS.map(
        normalizeOrder
      );

    this.notifications = [];

    this.locations = [];

    this.pricing =
      normalizePricing({
        ...DEFAULT_PRICING,
        updatedAt:
          new Date().toISOString(),
      });

    this.currentUser =
      this.users.find(
        (user) =>
          user.role ===
          "customer"
      ) ||
      this.users[0];

    this.notify();
  }

  resetDemoData(): void {
    this.reset();
  }

  // =====================================================
  // CLEANUP
  // =====================================================

  destroy(): void {
    this.detachRealtimeListeners();

    this.listeners = [];

    this.initialized =
      false;
  }
}

export const storage =
  new StorageService();