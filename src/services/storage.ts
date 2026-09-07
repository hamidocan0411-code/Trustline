import type {
  User,
  Order,
  Notification,
  CourierLocation,
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
};

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
  private users: User[];
  private orders: Order[];
  private notifications: Notification[];
  private locations: CourierLocation[];
  private currentUser: User | null;

  constructor() {
    const initialUsers = [
      ...SEED_CUSTOMERS,
      ...SEED_COURIERS,
      SEED_ADMIN,
    ] as User[];

    this.users = load<User[]>(
      KEYS.users,
      initialUsers
    );

    this.orders = load<Order[]>(
      KEYS.orders,
      SEED_ORDERS
    );

    this.notifications = load<Notification[]>(
      KEYS.notifications,
      []
    );

    this.locations = load<CourierLocation[]>(
      KEYS.locations,
      []
    );

    this.currentUser = load<User | null>(
      KEYS.currentUser,
      null
    );

    save(KEYS.users, this.users);
    save(KEYS.orders, this.orders);
    save(KEYS.notifications, this.notifications);
    save(KEYS.locations, this.locations);
  }

  // -------------------------
  // USERS
  // -------------------------

  getUsers(): User[] {
    return this.users;
  }

  getUserById(id: string): User | undefined {
    return this.users.find(
      (user) => user.id === id
    );
  }

  getUserByEmail(email: string): User | undefined {
    return this.users.find(
      (user) =>
        user.email?.toLowerCase() ===
        email.toLowerCase()
    );
  }

  saveUser(user: User): User {
    const index = this.users.findIndex(
      (u) => u.id === user.id
    );

    if (index >= 0) {
      this.users[index] = user;
    } else {
      this.users.push(user);
    }

    save(KEYS.users, this.users);

    return user;
  }

  deleteUser(id: string): void {
    this.users = this.users.filter(
      (user) => user.id !== id
    );

    save(KEYS.users, this.users);
  }

  // -------------------------
  // CURRENT USER
  // -------------------------

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  setCurrentUser(user: User | null): void {
    this.currentUser = user;

    save(
      KEYS.currentUser,
      user
    );
  }

  logout(): void {
    this.currentUser = null;

    localStorage.removeItem(
      KEYS.currentUser
    );
  }

  // -------------------------
  // ORDERS
  // -------------------------

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

  saveOrder(order: Order): Order {
    const index = this.orders.findIndex(
      (o) => o.id === order.id
    );

    if (index >= 0) {
      this.orders[index] = order;
    } else {
      this.orders.unshift(order);
    }

    save(KEYS.orders, this.orders);

    return order;
  }

  updateOrder(
    id: string,
    updates: Partial<Order>
  ): Order | undefined {
    const order = this.getOrderById(id);

    if (!order) {
      return undefined;
    }

    const updatedOrder = {
      ...order,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    this.saveOrder(updatedOrder);

    return updatedOrder;
  }

  deleteOrder(id: string): void {
    this.orders = this.orders.filter(
      (order) => order.id !== id
    );

    save(KEYS.orders, this.orders);
  }

  // -------------------------
  // CREATE ORDER
  // -------------------------

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

    const calculatedPrice =
      calculateOrderPrice(
        distanceKm,
        courierType,
        DEFAULT_PRICING
      );

    const price =
      typeof data.price === "number"
        ? data.price
        : calculatedPrice.finalPrice;

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

      updatedAt:
        data.updatedAt ||
        now,
    } as Order;

    this.orders.unshift(order);

    save(
      KEYS.orders,
      this.orders
    );

    return order;
  }

  // -------------------------
  // NOTIFICATIONS
  // -------------------------

  getNotifications(
    userId?: string
  ): Notification[] {
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
    notification: Notification
  ): void {
    this.notifications.unshift(
      notification
    );

    save(
      KEYS.notifications,
      this.notifications
    );
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
  }

  markAllNotificationsRead(
    userId: string
  ): void {
    this.notifications =
      this.notifications.map(
        (notification) =>
          notification.userId === userId ||
          notification.userId === "all"
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
  }

  // -------------------------
  // COURIER LOCATIONS
  // -------------------------

  getCourierLocations(): CourierLocation[] {
    return this.locations;
  }

  getCourierLocation(
    courierId: string
  ): CourierLocation | undefined {
    return this.locations.find(
      (location) =>
        location.courierId === courierId
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
  }

  // -------------------------
  // ASSIGN COURIER
  // -------------------------

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

      status:
        "Kurye Atandı",

      updatedAt:
        new Date().toISOString(),
    } as Order;

    this.saveOrder(
      updatedOrder
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
        `Yeni bir teslimat görevi size atandı. Sipariş: ${orderId}`,

      read: false,

      createdAt:
        new Date().toISOString(),
    } as Notification);

    return updatedOrder;
  }

  // -------------------------
  // DELIVER ORDER
  // -------------------------

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

    this.saveOrder(
      updatedOrder
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
      } as Notification);
    }

    return updatedOrder;
  }

  // -------------------------
  // RESET
  // -------------------------

  reset(): void {
    const initialUsers = [
      ...SEED_CUSTOMERS,
      ...SEED_COURIERS,
      SEED_ADMIN,
    ] as User[];

    this.users = [
      ...initialUsers,
    ];

    this.orders = [
      ...SEED_ORDERS,
    ];

    this.notifications = [];

    this.locations = [];

    this.currentUser = null;

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

    localStorage.removeItem(
      KEYS.currentUser
    );
  }
}

export const storage =
  new StorageService();