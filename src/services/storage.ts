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
  getDocs,
} from "firebase/firestore";

import { db } from "./firebase";

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

class StorageService {
  private currentUser: UserProfile | null = null;

  private users: UserProfile[] = [];
  private orders: Order[] = [];
  private notifications: NotificationItem[] = [];
  private pricing: PricingConfig = DEFAULT_PRICING;
  private courierLocations: CourierLocation[] = [];

  private subscribers = new Set<Subscriber>();

  private initialized = false;
  private unsubscribers: (() => void)[] = [];

  // ==========================================
  // INIT - FIRESTORE LIVE LISTENERS
  // ==========================================

  async init() {
    if (this.initialized) return;

    this.initialized = true;

    try {
      // USERS
      const unsubscribeUsers = onSnapshot(
        collection(db, "users"),
        (snapshot) => {
          this.users = snapshot.docs.map((item) => ({
            ...(item.data() as UserProfile),
            id: item.id,
          }));

          this.emit();
        },
        (error) => {
          console.error(
            "Users canlı veri hatası:",
            error
          );
        }
      );

      // ORDERS
      const unsubscribeOrders = onSnapshot(
        collection(db, "orders"),
        (snapshot) => {
          this.orders = snapshot.docs.map((item) => ({
            ...(item.data() as Order),
            id: item.id,
          }));

          this.emit();
        },
        (error) => {
          console.error(
            "Orders canlı veri hatası:",
            error
          );
        }
      );

      // NOTIFICATIONS
      const unsubscribeNotifications = onSnapshot(
        collection(db, "notifications"),
        (snapshot) => {
          this.notifications = snapshot.docs.map(
            (item) => ({
              ...(item.data() as NotificationItem),
              id: item.id,
            })
          );

          this.emit();
        },
        (error) => {
          console.error(
            "Notifications canlı veri hatası:",
            error
          );
        }
      );

      // PRICING
      const unsubscribePricing = onSnapshot(
        doc(db, "settings", "pricing"),
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
            "Pricing canlı veri hatası:",
            error
          );
        }
      );

      // COURIER LOCATIONS
      const unsubscribeLocations = onSnapshot(
        collection(db, "courierLocations"),
        (snapshot) => {
          this.courierLocations =
            snapshot.docs.map((item) => ({
              ...(item.data() as CourierLocation),
              courierId:
                item.data().courierId || item.id,
            }));

          this.emit();
        },
        (error) => {
          console.error(
            "Courier locations canlı veri hatası:",
            error
          );
        }
      );

      this.unsubscribers.push(
        unsubscribeUsers,
        unsubscribeOrders,
        unsubscribeNotifications,
        unsubscribePricing,
        unsubscribeLocations
      );

      console.log(
        "🔥 Firebase canlı veri sistemi başlatıldı"
      );
    } catch (error) {
      console.error(
        "Storage init hatası:",
        error
      );
    }
  }

  // ==========================================
  // SUBSCRIBE
  // ==========================================

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);

    // İlk veriyi hemen gönder
    callback();

    return () => {
      this.subscribers.delete(callback);
    };
  }

  private emit() {
    this.subscribers.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error(
          "Storage subscriber hatası:",
          error
        );
      }
    });
  }

  // ==========================================
  // CURRENT USER
  // ==========================================

  setCurrentUser(user: UserProfile | null) {
    this.currentUser = user;
    this.emit();
  }

  getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  // ==========================================
  // USERS
  // ==========================================

  getUsers(): UserProfile[] {
    return this.users;
  }

  getUserById(id: string): UserProfile | undefined {
    return this.users.find(
      (user) => user.id === id
    );
  }

  getCouriers(): UserProfile[] {
    return this.users.filter(
      (user) =>
        user.role === "courier"
    );
  }

  async updateUser(
    id: string,
    data: Partial<UserProfile>
  ) {
    try {
      await updateDoc(
        doc(db, "users", id),
        {
          ...data,
          updatedAt:
            new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error(
        "Kullanıcı güncelleme hatası:",
        error
      );
      throw error;
    }
  }

  async updateCourierStatus(
    courierId: string,
    status: CourierAvailability
  ): Promise<UserProfile | undefined> {
    const user =
      this.getUserById(courierId);

    try {
      await updateDoc(
        doc(db, "users", courierId),
        {
          courierStatus: status,
          updatedAt:
            new Date().toISOString(),
        }
      );

      return {
        ...(user || {
          id: courierId,
        }),
        courierStatus: status,
      } as UserProfile;
    } catch (error) {
      console.error(
        "Kurye durum güncelleme hatası:",
        error
      );
      return undefined;
    }
  }

  // ==========================================
  // ORDERS
  // ==========================================

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

  async createOrder(
    order: Order
  ): Promise<Order> {
    try {
      await setDoc(
        doc(db, "orders", order.id),
        {
          ...order,
          createdAt:
            order.createdAt ||
            new Date().toISOString(),
          updatedAt:
            new Date().toISOString(),
        }
      );

      return order;
    } catch (error) {
      console.error(
        "Sipariş oluşturma hatası:",
        error
      );
      throw error;
    }
  }

  async updateOrder(
    id: string,
    data: Partial<Order>
  ) {
    try {
      await updateDoc(
        doc(db, "orders", id),
        {
          ...data,
          updatedAt:
            new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error(
        "Sipariş güncelleme hatası:",
        error
      );
      throw error;
    }
  }

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ) {
    try {
      await updateDoc(
        doc(db, "orders", orderId),
        {
          status,
          updatedAt:
            new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error(
        "Sipariş durum güncelleme hatası:",
        error
      );
      throw error;
    }
  }

  async assignCourier(
    orderId: string,
    courierId: string
  ) {
    try {
      await updateDoc(
        doc(db, "orders", orderId),
        {
          courierId,
          status: "Kurye Atandı",
          updatedAt:
            new Date().toISOString(),
        }
      );
    } catch (error) {
      console.error(
        "Kurye atama hatası:",
        error
      );
      throw error;
    }
  }

  async deleteOrder(
    orderId: string
  ) {
    try {
      await deleteDoc(
        doc(db, "orders", orderId)
      );
    } catch (error) {
      console.error(
        "Sipariş silme hatası:",
        error
      );
      throw error;
    }
  }

  // ==========================================
  // PRICING
  // ==========================================

  getPricing(): PricingConfig {
    return this.pricing;
  }

  async updatePricing(
    pricing: PricingConfig
  ) {
    try {
      await setDoc(
        doc(db, "settings", "pricing"),
        {
          ...pricing,
          updatedAt:
            new Date().toISOString(),
        },
        {
          merge: true,
        }
      );
    } catch (error) {
      console.error(
        "Fiyat güncelleme hatası:",
        error
      );
      throw error;
    }
  }

  // ==========================================
  // NOTIFICATIONS
  // ==========================================

  getNotifications(
    userId: string
  ): NotificationItem[] {
    return this.notifications
      .filter(
        (notification) =>
          notification.userId === userId
      )
      .sort((a, b) => {
        const dateA = new Date(
          a.createdAt || 0
        ).getTime();

        const dateB = new Date(
          b.createdAt || 0
        ).getTime();

        return dateB - dateA;
      });
  }

  async createNotification(
    notification: NotificationItem
  ) {
    try {
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
    } catch (error) {
      console.error(
        "Bildirim oluşturma hatası:",
        error
      );
      throw error;
    }
  }

  async markNotificationAsRead(
    notificationId: string
  ) {
    try {
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
    } catch (error) {
      console.error(
        "Bildirim güncelleme hatası:",
        error
      );
    }
  }

  // ==========================================
  // COURIER LOCATION
  // ==========================================

  getCourierLocation(
    courierId: string
  ): CourierLocation | undefined {
    return this.courierLocations.find(
      (location) =>
        location.courierId === courierId
    );
  }

  async updateCourierLocation(
    location: CourierLocation
  ): Promise<CourierLocation> {
    try {
      await setDoc(
        doc(
          db,
          "courierLocations",
          location.courierId
        ),
        {
          ...location,
          updatedAt:
            location.updatedAt ||
            new Date().toISOString(),
        },
        {
          merge: true,
        }
      );

      return location;
    } catch (error) {
      console.error(
        "Kurye konum güncelleme hatası:",
        error
      );
      throw error;
    }
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  destroy() {
    this.unsubscribers.forEach(
      (unsubscribe) => unsubscribe()
    );

    this.unsubscribers = [];
    this.initialized = false;
  }
}

export const storage = new StorageService();

// Uygulama açılır açılmaz Firebase canlı bağlantısını başlat
storage.init();