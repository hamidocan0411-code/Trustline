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

const KEYS = {
  users: "trustline_users",
  orders: "trustline_orders",
  notifications: "trustline_notifications",
  locations: "trustline_locations",
  currentUser: "trustline_current_user",
  pricing: "trustline_pricing",
};

type Listener = () => void;

function load<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);

    if (!value) {
      return fallback;
    }

    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

class StorageService {
  private users: UserProfile[];
  private orders: Order[];
  private notifications: NotificationItem[];
  private locations: CourierLocation[];
  private currentUser: UserProfile;
  private pricing: PricingConfig;
  private listeners: Listener[] = [];

  constructor() {
    const initialUsers: UserProfile[] = [
      ...SEED_CUSTOMERS,
      ...SEED_COURIERS,
      SEED_ADMIN,
    ];

    this.users = load<UserProfile[]>(
      KEYS.users,
      initialUsers
    );

    this.orders = load<Order[]>(
      KEYS.orders,
      [...SEED_ORDERS]
    );

    this.notifications = load<NotificationItem[]>(
      KEYS.notifications,
      []
    );

    this.locations = load<CourierLocation[]>(
      KEYS.locations,
      []
    );

    this.pricing = load<PricingConfig>(
      KEYS.pricing,
      DEFAULT_PRICING
    );

    const savedUser = load<UserProfile | null>(
      KEYS.currentUser,
      null
    );

    this.currentUser =
      savedUser ||
      this.users.find(
        (user) => user.role === "customer"
      ) ||
      this.users[0];

    save(KEYS.users, this.users);
    save(KEYS.orders, this.orders);
    save(KEYS.notifications, this.notifications);
    save(KEYS.locations, this.locations);
    save(KEYS.pricing, this.pricing);
    save(KEYS.currentUser, this.currentUser);
  }

  // =====================================================
  // SUBSCRIBE
  // =====================================================

  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);

    return () => {
      this.listeners =
        this.listeners.filter(
          (item) => item !== listener
        );
    };
  }

  private notify(): void {
    this.listeners.forEach(
      (listener) => {
        try {
          listener();
        } catch {
          // Listener hatası uygulamayı durdurmasın.
        }
      }
    );
  }

  // =====================================================
  // USERS
  // =====================================================

  getUsers(): UserProfile[] {
    return this.users;
  }

  getUserById(
    id: string
  ): UserProfile | undefined {
    return this.users.find(
      (user) => user.id === id
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

  saveUser(
    user: UserProfile
  ): UserProfile {
    const index =
      this.users.findIndex(
        (item) => item.id === user.id
      );

    if (index >= 0) {
      this.users[index] = user;
    } else {
      this.users.push(user);
    }

    save(KEYS.users, this.users);

    if (
      this.currentUser &&
      this.currentUser.id === user.id
    ) {
      this.currentUser = user;

      save(
        KEYS.currentUser,
        this.currentUser
      );
    }

    this.notify();

    return user;
  }

  deleteUser(id: string): void {
    this.users =
      this.users.filter(
        (user) => user.id !== id
      );

    save(KEYS.users, this.users);

    this.notify();
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
    this.currentUser = user;

    const existingIndex =
      this.users.findIndex(
        (item) => item.id === user.id
      );

    if (existingIndex >= 0) {
      this.users[existingIndex] = user;
    } else {
      this.users.push(user);
    }

    save(
      KEYS.currentUser,
      this.currentUser
    );

    save(
      KEYS.users,
      this.users
    );

    this.notify();
  }

  logout(): void {
    const defaultUser =
      this.users.find(
        (user) => user.role === "customer"
      ) ||
      this.users[0];

    this.currentUser = defaultUser;

    save(
      KEYS.currentUser,
      this.currentUser
    );

    this.notify();
  }

  // =====================================================
  // PRICING
  // =====================================================

  getPricing(): PricingConfig {
    return this.pricing;
  }

  setPricing(
    pricing: PricingConfig
  ): void {
    this.pricing = {
      ...pricing,
      updatedAt:
        new Date().toISOString(),
    };

    save(
      KEYS.pricing,
      this.pricing
    );

    this.notify();
  }

  // =====================================================
  // ORDERS
  // =====================================================

  getOrders(): Order[] {
    return this.orders;
  }

  getOrderById(
    id: string
  ): Order | undefined {
    return this.orders.find(
      (order) => order.id === id
    );
  }

  getOrdersByCustomer(
    customerId: string
  ): Order[] {
    return this.orders.filter(
      (order) =>
        order.customerId === customerId
    );
  }

  getOrdersByCourier(
    courierId: string
  ): Order[] {
    return this.orders.filter(
      (order) =>
        order.courierId === courierId
    );
  }

  saveOrder(
    order: Order
  ): Order {
    const index =
      this.orders.findIndex(
        (item) => item.id === order.id
      );

    const updatedOrder = {
      ...order,
      updatedAt:
        new Date().toISOString(),
    } as Order;

    if (index >= 0) {
      this.orders[index] =
        updatedOrder;
    } else {
      this.orders.unshift(
        updatedOrder
      );
    }

    save(
      KEYS.orders,
      this.orders
    );

    this.notify();

    return updatedOrder;
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

  deleteOrder(
    id: string
  ): void {
    this.orders =
      this.orders.filter(
        (order) => order.id !== id
      );

    save(
      KEYS.orders,
      this.orders
    );

    this.notify();
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
      typeof data.distanceKm === "number"
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

    const price =
      typeof data.price === "number"
        ? data.price
        : calculated.finalPrice;

    const now =
      new Date().toISOString();

    const order = {
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
    } as Order;

    this.orders.unshift(order);

    save(
      KEYS.orders,
      this.orders
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
      return this.notifications;
    }

    return this.notifications.filter(
      (notification) =>
        notification.userId === userId ||
        notification.userId === "all"
    );
  }

  addNotification(
    notification: NotificationItem
  ): void {
    this.notifications.unshift(
      notification
    );

    save(
      KEYS.notifications,
      this.notifications
    );

    this.notify();
  }

  markNotificationRead(
    id: string
  ): void {
    this.notifications =
      this.notifications.map(
        (notification) =>
          notification.id === id
            ? {
                ...notification,
                read: true,
              }
            : notification
      );

    save(
      KEYS.notifications,
      this.notifications
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

    save(
      KEYS.notifications,
      this.notifications
    );

    this.notify();
  }

  // =====================================================
  // COURIER LOCATIONS
  // =====================================================

  getCourierLocations(): CourierLocation[] {
    return this.locations;
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
    const index =
      this.locations.findIndex(
        (item) =>
          item.courierId ===
          location.courierId
      );

    if (index >= 0) {
      this.locations[index] =
        location;
    } else {
      this.locations.push(
        location
      );
    }

    save(
      KEYS.locations,
      this.locations
    );

    this.notify();
  }

  // =====================================================
  // ASSIGN COURIER
  // =====================================================

  assignCourier(
    orderId: string,
    courierId: string
  ): Order | undefined {
    const order =
      this.getOrderById(orderId);

    if (!order) {
      return undefined;
    }

    const courier =
      this.getUserById(courierId);

    const updatedOrder = {
      ...order,

      courierId,

      courierName:
        courier?.name ||
        order.courierName,

      courierPhone:
        courier?.phone ||
        order.courierPhone,

      status:
        "Kurye Atandı",

      updatedAt:
        new Date().toISOString(),
    } as Order;

    this.orders =
      this.orders.map(
        (item) =>
          item.id === orderId
            ? updatedOrder
            : item
      );

    save(
      KEYS.orders,
      this.orders
    );

    this.addNotification({
      id:
        "NOT-" +
        Date.now(),

      userId:
        courierId,

      title:
        "Yeni Görev",

      message:
        `Yeni teslimat görevi atandı. Sipariş: ${orderId}`,

      read: false,

      createdAt:
        new Date().toISOString(),
    } as NotificationItem);

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
      this.getOrderById(orderId);

    if (!order) {
      return undefined;
    }

    const updatedOrder = {
      ...order,

      status:
        "Teslim Edildi",

      deliveredAt:
        new Date().toISOString(),

      deliveryProof:
        proof,

      updatedAt:
        new Date().toISOString(),
    } as Order;

    this.orders =
      this.orders.map(
        (item) =>
          item.id === orderId
            ? updatedOrder
            : item
      );

    save(
      KEYS.orders,
      this.orders
    );

    if (order.customerId) {
      this.addNotification({
        id:
          "NOT-" +
          Date.now(),

        userId:
          order.customerId,

        title:
          "Teslimat Tamamlandı",

        message:
          "Siparişiniz başarıyla teslim edildi.",

        read: false,

        createdAt:
          new Date().toISOString(),
      } as NotificationItem);
    }

    this.notify();

    return updatedOrder;
  }

  // =====================================================
  // RESET
  // =====================================================

  reset(): void {
    const initialUsers: UserProfile[] = [
      ...SEED_CUSTOMERS,
      ...SEED_COURIERS,
      SEED_ADMIN,
    ];

    this.users = [
      ...initialUsers,
    ];

    this.orders = [
      ...SEED_ORDERS,
    ];

    this.notifications = [];

    this.locations = [];

    this.pricing = {
      ...DEFAULT_PRICING,
      updatedAt:
        new Date().toISOString(),
    };

    this.currentUser =
      this.users.find(
        (user) =>
          user.role === "customer"
      ) ||
      this.users[0];

    save(
      KEYS.users,
      this.users
    );

    save(
      KEYS.orders,
      this.orders
    );

    save(
      KEYS.notifications,
      this.notifications
    );

    save(
      KEYS.locations,
      this.locations
    );

    save(
      KEYS.pricing,
      this.pricing
    );

    save(
      KEYS.currentUser,
      this.currentUser
    );

    this.notify();
  }
}

export const storage =
  new StorageService();