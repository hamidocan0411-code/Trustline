import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from "firebase/auth";

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

  async init(): Promise<void> {
    if (this.initialized) return;

    this.initialized = true;

    try {
      // ==========================================
      // USERS - CANLI
      // ==========================================

      const unsubscribeUsers = onSnapshot(
        collection(db, "users"),
        (snapshot) => {
          this.users = snapshot.docs.map((item) => {
            const data = item.data() as Partial<UserProfile>;

            return {
              ...data,
              id: item.id,
              name: data.name || "Kullanıcı",
              email: data.email || "",
              phone: data.phone || "",
              role: data.role || "customer",
              isActive: data.isActive !== false,
            } as UserProfile;
          });

          console.log(
            "🔥 CANLI USERS:",
            this.users.length
          );

          this.emit();
        },
        (error) => {
          console.error(
            "Users canlı veri hatası:",
            error
          );
        }
      );

      // ==========================================
      // ORDERS - CANLI
      // ==========================================

      const unsubscribeOrders = onSnapshot(
        collection(db, "orders"),
        (snapshot) => {
          this.orders = snapshot.docs.map((item) => {
            const data = item.data() as Partial<Order>;

            return {
              ...data,
              id: item.id,
            } as Order;
          });

          console.log(
            "🔥 CANLI ORDERS:",
            this.orders.length
          );

          this.emit();
        },
        (error) => {
          console.error(
            "Orders canlı veri hatası:",
            error
          );
        }
      );

      // ==========================================
      // NOTIFICATIONS - CANLI
      // ==========================================

      const unsubscribeNotifications = onSnapshot(
        collection(db, "notifications"),
        (snapshot) => {
          this.notifications =
            snapshot.docs.map((item) => {
              const data =
                item.data() as Partial<NotificationItem>;

              return {
                ...data,
                id: item.id,
              } as NotificationItem;
            });

          this.emit();
        },
        (error) => {
          console.error(
            "Notifications canlı veri hatası:",
            error
          );
        }
      );

      // ==========================================
      // PRICING - CANLI
      // ==========================================

      const unsubscribePricing = onSnapshot(
        doc(db, "settings", "pricing"),
        (snapshot) => {
          if (snapshot.exists()) {
            this.pricing = {
              ...DEFAULT_PRICING,
              ...(snapshot.data() as Partial<PricingConfig>),
            };
          } else {
            this.pricing = DEFAULT_PRICING;
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

      // ==========================================
      // COURIER LOCATIONS - CANLI
      // ==========================================

      const unsubscribeLocations = onSnapshot(
        collection(db, "courierLocations"),
        (snapshot) => {
          this.courierLocations =
            snapshot.docs.map((item) => {
              const data =
                item.data() as Partial<CourierLocation>;

              return {
                ...data,
                courierId:
                  data.courierId || item.id,
              } as CourierLocation;
            });

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
        "🔥 Firebase canlı veri sistemi başarıyla başlatıldı"
      );
    } catch (error) {
      console.error(
        "Storage init hatası:",
        error
      );

      this.initialized = false;
    }
  }

  // ==========================================
  // SUBSCRIBE
  // ==========================================

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);

    callback();

    return () => {
      this.subscribers.delete(callback);
    };
  }

  private emit(): void {
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

  setCurrentUser(
    user: UserProfile | null
  ): void {
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
    return [...this.users];
  }

  getUserById(
    id: string
  ): UserProfile | undefined {
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

  getCustomers(): UserProfile[] {
    return this.users.filter(
      (user) =>
        user.role === "customer"
    );
  }

  async updateUser(
    id: string,
    data: Partial<UserProfile>
  ): Promise<void> {
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
  ): Promise<UserProfile> {
    try {
      await updateDoc(
        doc(db, "users", courierId),
        {
          courierStatus: status,
          updatedAt:
            new Date().toISOString(),
        }
      );

      const existing =
        this.getUserById(courierId);

      return {
        ...(existing || {
          id: courierId,
          name: "",
          email: "",
          phone: "",
          role: "courier",
          createdAt:
            new Date().toISOString(),
          updatedAt:
            new Date().toISOString(),
          isActive: true,
        }),
        courierStatus: status,
      } as UserProfile;
    } catch (error) {
      console.error(
        "Kurye durum güncelleme hatası:",
        error
      );
      throw error;
    }
  }

  // ==========================================
  // KURYE OLUŞTUR
  // ==========================================

  async createCourier(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
  }): Promise<UserProfile> {
    const email =
      data.email.trim().toLowerCase();

    const name =
      data.name.trim();

    const phone =
      data.phone.trim();

    if (!email) {
      throw new Error(
        "Kurye e-postası zorunludur."
      );
    }

    if (!name) {
      throw new Error(
        "Kurye adı zorunludur."
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

    /*
     * ÖNEMLİ:
     * Firebase Auth mevcut oturumu değiştirebilir.
     *
     * Bu yüzden kurye oluşturma sonrası
     * admin oturumunu mümkün olduğunca
     * korumak için secondary auth kullanılabilir.
     *
     * Şimdilik mevcut Firebase Auth kullanılıyor.
     */

    const auth = getAuth();

    let adminEmail: string | null = null;
    let adminPasswordLost = false;

    if (auth.currentUser?.email) {
      adminEmail =
        auth.currentUser.email;
    }

    try {
      const credential =
        await createUserWithEmailAndPassword(
          auth,
          email,
          data.password
        );

      const uid =
        credential.user.uid;

      const now =
        new Date().toISOString();

      const courier: UserProfile = {
        id: uid,
        name,
        email,
        phone,
        role: "courier",
        courierStatus: "Çevrimdışı",
        totalDeliveries: 0,
        rating: 0,
        createdAt: now,
        updatedAt: now,
        isActive: true,
      };

      await setDoc(
        doc(db, "users", uid),
        courier
      );

      console.log(
        "🔥 YENİ KURYE OLUŞTURULDU:",
        courier
      );

      return courier;
    } catch (error: any) {
      console.error(
        "Kurye oluşturma hatası:",
        error
      );

      const code =
        error?.code || "";

      if (
        code ===
        "auth/email-already-in-use"
      ) {
        throw new Error(
          "Bu e-posta adresi zaten kullanılıyor."
        );
      }

      if (
        code ===
        "auth/invalid-email"
      ) {
        throw new Error(
          "Geçersiz e-posta adresi."
        );
      }

      if (
        code ===
        "auth/weak-password"
      ) {
        throw new Error(
          "Şifre en az 6 karakter olmalıdır."
        );
      }

      throw error;
    } finally {
      void adminEmail;
      void adminPasswordLost;
    }
  }

  // ==========================================
  // ORDERS
  // ==========================================

  getOrders(): Order[] {
    return [...this.orders];
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
      const now =
        new Date().toISOString();

      const cleanOrder = {
        ...order,
        id: order.id,
        createdAt:
          order.createdAt || now,
        updatedAt: now,
      };

      await setDoc(
        doc(
          db,
          "orders",
          order.id
        ),
        cleanOrder
      );

      console.log(
        "🔥 SİPARİŞ OLUŞTURULDU:",
        order.id
      );

      return cleanOrder as Order;
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
  ): Promise<Order> {
    try {
      const updatedData = {
        ...data,
        updatedAt:
          new Date().toISOString(),
      };

      await updateDoc(
        doc(db, "orders", id),
        updatedData
      );

      const current =
        this.getOrderById(id);

      return {
        ...(current || {
          id,
        }),
        ...updatedData,
      } as Order;
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
      this.getUserById(courierId);

    if (!courier) {
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
          "Kurye",
        status:
          "Kurye Atandı",
      }
    );
  }

  async deleteOrder(
    orderId: string
  ): Promise<void> {
    try {
      await deleteDoc(
        doc(
          db,
          "orders",
          orderId
        )
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
    return {
      ...this.pricing,
    };
  }

  async updatePricing(
    pricing: PricingConfig
  ): Promise<void> {
    try {
      await setDoc(
        doc(
          db,
          "settings",
          "pricing"
        ),
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
        const dateA =
          new Date(
            a.createdAt || 0
          ).getTime();

        const dateB =
          new Date(
            b.createdAt || 0
          ).getTime();

        return dateB - dateA;
      });
  }

  async createNotification(
    notification: NotificationItem
  ): Promise<NotificationItem> {
    try {
      const data = {
        ...notification,
        createdAt:
          notification.createdAt ||
          new Date().toISOString(),
      };

      await setDoc(
        doc(
          db,
          "notifications",
          notification.id
        ),
        data
      );

      return data;
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
  ): Promise<void> {
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
      throw error;
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

  getCourierLocations(): CourierLocation[] {
    return [
      ...this.courierLocations,
    ];
  }

  async updateCourierLocation(
    location: CourierLocation
  ): Promise<CourierLocation> {
    try {
      const data = {
        ...location,
        courierId:
          location.courierId,
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
        data,
        {
          merge: true,
        }
      );

      return data;
    } catch (error) {
      console.error(
        "Kurye konum güncelleme hatası:",
        error
      );
      throw error;
    }
  }

  // ==========================================
  // MANUEL FIRESTORE USER SYNC
  // ==========================================

  async refreshUsers(): Promise<UserProfile[]> {
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

      return this.users;
    } catch (error) {
      console.error(
        "Users manuel yenileme hatası:",
        error
      );

      throw error;
    }
  }

  // ==========================================
  // CLEANUP
  // ==========================================

  destroy(): void {
    this.unsubscribers.forEach(
      (unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          console.error(
            "Firebase listener kapatma hatası:",
            error
          );
        }
      }
    );

    this.unsubscribers = [];
    this.initialized = false;

    console.log(
      "Firebase canlı bağlantıları kapatıldı"
    );
  }
}

export const storage =
  new StorageService();

// ==========================================
// APP START - FIREBASE LIVE CONNECTION
// ==========================================

void storage.init();