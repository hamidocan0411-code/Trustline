import type {
  User,
  Order,
  Notification,
  CourierLocation,
} from "../types";
import { calculatePrice } from "../utils/pricing";
import { seedCustomers, seedCouriers, seedAdmin, seedOrders } from "../data/seedData";

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
    return value ? JSON.parse(value) : fallback;
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
    this.users = load<User[]>(KEYS.users, seedUsers);
    this.orders = load<Order[]>(KEYS.orders, seedOrders);
    this.notifications = load<Notification[]>(
      KEYS.notifications,
      seedNotifications
    );
    this.locations = load<CourierLocation[]>(KEYS.locations, []);
    this.currentUser = load<User | null>(KEYS.currentUser, null);

    save(KEYS.users, this.users);
    save(KEYS.orders, this.orders);
    save(KEYS.notifications, this.notifications);
    save(KEYS.locations, this.locations);
  }

  // =========================
  // USERS
  // =========================

  getUsers(): User[] {
    return this.users;
  }

  getUserById(id: string): User | undefined {
    return this.users.find((user) => user.id === id);
  }

  getUserByEmail(email: string): User | undefined {
    return this.users.find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
  }

  saveUser(user: User): User {
    const index = this.users.findIndex((u) => u.id === user.id);

    if (index >= 0) {
      this.users[index] = user;
    } else {
      this.users.push(user);
    }

    save(KEYS.users, this.users);
    return user;
  }

  deleteUser(id: string): void {
    this.users = this.users.filter((user) => user.id !== id);
    save(KEYS.users, this.users);
  }

  // =========================
  // CURRENT USER
  // =========================

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  setCurrentUser(user: User | null): void {
    this.currentUser = user;
    save(KEYS.currentUser, user);
  }

  logout(): void {
    this.currentUser = null;
    localStorage.removeItem(KEYS.currentUser);
  }

  // =========================
  // ORDERS
  // =========================

  getOrders(): Order[] {
    return this.orders;
  }

  getOrderById(id: string): Order | undefined {
    return this.orders.find((order) => order.id === id);
  }

  getOrdersByCustomer(customerId: string): Order[] {
    return this.orders.filter(
      (order) => order.customerId === customerId
    );
  }

  getOrdersByCourier(courierId: string): Order[] {
    return this.orders.filter(
      (order) => order.courierId === courierId
    );
  }

  saveOrder(order: Order): Order {
    const index = this.orders.findIndex((o) => o.id === order.id);

    if (index >= 0) {
      this.orders[index] = order;
    } else {
      this.orders.unshift(order);
    }

    save(KEYS.orders, this.orders);
    return order;
  }

  updateOrder(id: string, updates: Partial<Order>): Order | undefined {
    const order = this.getOrderById(id);

    if (!order) {
      return undefined;
    }

    const updatedOrder = {
      ...order,
      ...updates,
    };

    this.saveOrder(updatedOrder);

    return updatedOrder;
  }

  deleteOrder(id: string): void {
    this.orders = this.orders.filter((order) => order.id !== id);
    save(KEYS.orders, this.orders);
  }

  // =========================
  // CREATE ORDER
  // =========================

  createOrder(data: Partial<Order>): Order {
    const id =
      "ORD-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.random().toString(36).substring(2, 7).toUpperCase();

    const distance =
      typeof data.distance === "number" ? data.distance : 0;

    const serviceType = data.serviceType || "standard";

    const price =
      typeof data.price === "number"
        ? data.price
        : calculatePrice(distance, serviceType);

    const order: Order = {
      ...(data as Order),
      id,
      price,
      distance,
      status: data.status || "pending",
      createdAt: data.createdAt || new Date().toISOString(),
    };

    this.orders.unshift(order);
    save(KEYS.orders, this.orders);

    return order;
  }

  // =========================
  // NOTIFICATIONS
  // =========================

  getNotifications(userId?: string): Notification[] {
    if (!userId) {
      return this.notifications;
    }

    return this.notifications.filter(
      (notification) =>
        notification.userId === userId ||
        notification.userId === "all"
    );
  }

  addNotification(notification: Notification): void {
    this.notifications.unshift(notification);
    save(KEYS.notifications, this.notifications);
  }

  markNotificationRead(id: string): void {
    this.notifications = this.notifications.map((notification) =>
      notification.id === id
        ? { ...notification, read: true }
        : notification
    );

    save(KEYS.notifications, this.notifications);
  }

  markAllNotificationsRead(userId: string): void {
    this.notifications = this.notifications.map((notification) =>
      notification.userId === userId || notification.userId === "all"
        ? { ...notification, read: true }
        : notification
    );

    save(KEYS.notifications, this.notifications);
  }

  // =========================
  // COURIER LOCATIONS
  // =========================

  getCourierLocations(): CourierLocation[] {
    return this.locations;
  }

  getCourierLocation(
    courierId: string
  ): CourierLocation | undefined {
    return this.locations.find(
      (location) => location.courierId === courierId
    );
  }

  updateCourierLocation(location: CourierLocation): void {
    const index = this.locations.findIndex(
      (item) => item.courierId === location.courierId
    );

    if (index >= 0) {
      this.locations[index] = location;
    } else {
      this.locations.push(location);
    }

    save(KEYS.locations, this.locations);
  }

  // =========================
  // COURIER ASSIGNMENT
  // =========================

  assignCourier(
    orderId: string,
    courierId: string
  ): Order | undefined {
    const order = this.getOrderById(orderId);

    if (!order) {
      return undefined;
    }

    const updatedOrder = {
      ...order,
      courierId,
      status: "assigned",
    };

    this.saveOrder(updatedOrder);

    this.addNotification({
      id: "NOT-" + Date.now(),
      userId: courierId,
      title: "Yeni Görev",
      message: `Yeni bir teslimat görevi size atandı. Sipariş: ${orderId}`,
      read: false,
      createdAt: new Date().toISOString(),
    } as Notification);

    return updatedOrder;
  }

  // =========================
  // DELIVERY
  // =========================

  markOrderDelivered(
    orderId: string,
    proof?: string
  ): Order | undefined {
    const order = this.getOrderById(orderId);

    if (!order) {
      return undefined;
    }

    const updatedOrder = {
      ...order,
      status: "delivered",
      deliveredAt: new Date().toISOString(),
      deliveryProof: proof,
    };

    this.saveOrder(updatedOrder);

    if (order.customerId) {
      this.addNotification({
        id: "NOT-" + Date.now(),
        userId: order.customerId,
        title: "Teslimat Tamamlandı",
        message: "Siparişiniz başarıyla teslim edildi.",
        read: false,
        createdAt: new Date().toISOString(),
      } as Notification);
    }

    return updatedOrder;
  }

  // =========================
  // RESET
  // =========================

  reset(): void {
    this.users = [...seedUsers];
    this.orders = [...seedOrders];
    this.notifications = [];
    this.locations = [];
    this.currentUser = null;

    save(KEYS.users, this.users);
    save(KEYS.orders, this.orders);
    save(KEYS.notifications, this.notifications);
    save(KEYS.locations, this.locations);
    localStorage.removeItem(KEYS.currentUser);
  }
}

export const storage = new StorageService();