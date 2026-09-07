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

import { DEFAULT_PRICING } from "../utils/pricing";

import type {
  Courier,
  Customer,
  Order,
  OrderStatus,
  UserProfile,
import { auth, db } from "./firebase";

class StorageService {
  private currentUser: UserProfile | null = null;
  private users: UserProfile[] = [];
  private orders: Order[] = [];

  private userUnsubscribe: (() => void) | null = null;
  private orderUnsubscribe: (() => void) | null = null;
  private adminUsersUnsubscribe: (() => void) | null = null;

  private listeners = new Set<() => void>();

  private cacheKey = "trustline_cache";

  subscribe(listener: () => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  private saveCache() {
    try {
      localStorage.setItem(
        this.cacheKey,
        JSON.stringify({
          users: this.users,
          orders: this.orders,
        }),
      );
    } catch (error) {
      console.error("Cache kaydedilemedi:", error);
    }
  }

  private loadCache() {
    try {
      const raw = localStorage.getItem(this.cacheKey);

      if (!raw) return;

      const cache = JSON.parse(raw);

      if (Array.isArray(cache.users)) {
        this.users = cache.users;
      }

      if (Array.isArray(cache.orders)) {
        this.orders = cache.orders;
      }
    } catch (error) {
      console.error("Cache okunamadı:", error);
    }
  }

  async initializeForUser(profile: UserProfile) {
    this.currentUser = profile;

    this.loadCache();

    this.cleanupListeners();

    await this.ensureUserProfile(profile);

    this.setupUserListener(profile);
    this.setupOrderListener(profile);

    if (profile.role === "admin") {
      this.setupAdminUsersListener();
    }

    this.notify();
  }

  private cleanupListeners() {
    if (this.userUnsubscribe) {
      this.userUnsubscribe();
      this.userUnsubscribe = null;
    }

    if (this.orderUnsubscribe) {
      this.orderUnsubscribe();
      this.orderUnsubscribe = null;
    }

    if (this.adminUsersUnsubscribe) {
      this.adminUsersUnsubscribe();
      this.adminUsersUnsubscribe = null;
    }
  }

  private async ensureUserProfile(profile: UserProfile) {
    if (!profile?.id) return;

    try {
      const userRef = doc(db, "users", profile.id);
      const snapshot = await getDoc(userRef);

      if (!snapshot.exists()) {
        await setDoc(
          userRef,
          {
            ...profile,
            id: profile.id,
            updatedAt: new Date().toISOString(),
          },
          { merge: true },
        );
      }
    } catch (error) {
      console.error(
        "Kullanıcı profili oluşturulamadı:",
        error,
      );
    }
  }

  private setupUserListener(profile: UserProfile) {
    if (!profile?.id) return;

    const userRef = doc(db, "users", profile.id);

    this.userUnsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (!snapshot.exists()) return;

        const user = {
          ...snapshot.data(),
          id: profile.id,
        } as UserProfile;

        this.currentUser = {
          ...this.currentUser,
          ...user,
        } as UserProfile;

        const index = this.users.findIndex(
          (item) => item.id === profile.id,
        );

        if (index >= 0) {
          this.users[index] = this.currentUser;
        } else {
          this.users.push(this.currentUser);
        }

        this.saveCache();
        this.notify();
      },
      (error) => {
        console.error(
          "Kullanıcı dinleyicisi hatası:",
          error,
        );
      },
    );
  }

  private setupAdminUsersListener() {
    const usersRef = collection(db, "users");

    const customersQuery = query(
      usersRef,
      where("role", "==", "customer"),
    );

    this.adminUsersUnsubscribe = onSnapshot(
      customersQuery,
      (snapshot) => {
        const customers = snapshot.docs.map(
          (item) =>
            ({
              ...item.data(),
              id: item.id,
            }) as UserProfile,
        );

        const nonCustomers = this.users.filter(
          (user) => user.role !== "customer",
        );

        this.users = [
          ...nonCustomers,
          ...customers,
        ];

        this.saveCache();
        this.notify();
      },
      (error) => {
        console.error(
          "Admin müşteri listesi hatası:",
          error,
        );
      },
    );
  }

  private setupOrderListener(profile: UserProfile) {
  const ordersRef = collection(db, "orders");

  let ordersQuery;

  if (profile.role === "customer") {
    ordersQuery = query(
      ordersRef,
      where("customerId", "==", profile.id)
    );
  } else if (profile.role === "courier") {
    ordersQuery = query(
      ordersRef,
      where("courierId", "==", profile.id)
    );
  } else {
    ordersQuery = ordersRef;
  }

  this.orderUnsubscribe = onSnapshot(
    ordersQuery,
    (snapshot) => {
      const orders = snapshot.docs.map(
        (item) =>
          ({
            ...item.data(),
            id: item.id,
          }) as Order
      );

      this.orders = orders;

      this.saveCache();
      this.notify();
    },
    (error) => {
      console.error(
        "Sipariş listener hatası:",
        error
      );
    }
  );
}

  getCurrentUser() {
    return this.currentUser;
  }

  getOrders() {
    return [...this.orders];
  }

  getCustomers(): Customer[] {
    return this.users.filter(
      (user) => user.role === "customer",
    ) as Customer[];
  }

  getCouriers(): Courier[] {
    return this.users.filter(
      (user) => user.role === "courier",
    ) as Courier[];
  }

  getUsers() {
    return [...this.users];
  }

  getOrderById(id: string) {
    return this.orders.find(
      (order) => order.id === id,
    );
  }

  async createOrder(data: Partial<Order>) {
  const firebaseUser = auth.currentUser;

  if (!firebaseUser) {
    throw new Error(
      "Firebase oturumu bulunamadı. Lütfen tekrar giriş yapın."
    );
  }

  const customerId =
    this.currentUser?.role === "customer"
      ? firebaseUser.uid
      : data.customerId ||
        this.currentUser?.id ||
        firebaseUser.uid;

  const orderId =
    data.id ||
    `order_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

  const now = new Date().toISOString();

  // undefined alanları Firestore'a göndermiyoruz
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(
      ([, value]) => value !== undefined
    )
  );

  const order = {
    ...cleanData,
    id: orderId,
    customerId,
    courierId: data.courierId ?? null,
    status: data.status || "Kurye Bekleniyor",
    createdAt: data.createdAt || now,
    updatedAt: now,
  } as Order;

  // Müşteri sipariş oluşturuyorsa Auth UID kesin olarak kullanılır
  if (this.currentUser?.role === "customer") {
    order.customerId = firebaseUser.uid;
  }

  try {
    const orderRef = doc(
      db,
      "orders",
      orderId
    );

    await setDoc(orderRef, order);

    console.log(
      "SİPARİŞ BAŞARIYLA KAYDEDİLDİ:",
      order
    );

    this.orders = [
      order,
      ...this.orders.filter(
        (item) => item.id !== orderId
      ),
    ];

    this.saveCache();
    this.notify();

    return order;
  } catch (error: any) {
    console.error(
      "SİPARİŞ FIRESTORE HATASI:",
      error
    );

    throw new Error(
      error?.message ||
        "Sipariş Firestore'a kaydedilemedi."
    );
  }
}
    /*
     * MÜŞTERİ SİPARİŞ VERİYORSA:
     * customerId kesinlikle Firebase Auth UID olacak.
     *
     * Firestore Rules bunu kontrol ediyor.
     */
    const customerId =
      this.currentUser?.role === "customer"
        ? firebaseUser.uid
        : data.customerId ||
          this.currentUser?.id ||
          firebaseUser.uid;

    const orderId =
      data.id ||
      `order_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;

    const now = new Date().toISOString();

    const order = {
      ...(data as Order),
      id: orderId,
      customerId,
      courierId: data.courierId ?? null,
      status:
        data.status || "Kurye Bekleniyor",
      createdAt: data.createdAt || now,
      updatedAt: now,
    } as Order;

    /*
     * Customer için tekrar kesin UID.
     */
    if (this.currentUser?.role === "customer") {
      order.customerId = firebaseUser.uid;
    }

    try {
      const orderRef = doc(
        db,
        "orders",
        orderId,
      );

      /*
       * MERGE FALSE:
       * Yeni siparişte eski/veri kalıntısı bırakmaz.
       */
      await setDoc(orderRef, order, {
        merge: false,
      });

      console.log(
        "SİPARİŞ FIRESTORE'A BAŞARIYLA YAZILDI:",
        order,
      );

      /*
       * Local state.
       */
      this.orders = [
        order,
        ...this.orders.filter(
          (item) => item.id !== orderId,
        ),
      ];

      this.saveCache();
      this.notify();

      return order;
    } catch (error: any) {
      console.error(
        "SİPARİŞ FIRESTORE'A YAZILAMADI:",
        error,
      );

      /*
       * Artık hata gizlenmiyor.
       */
      throw new Error(
        error?.message ||
          "Sipariş Firestore'a kaydedilemedi.",
      );
    }
  }

  async updateOrder(
    orderId: string,
    updates: Partial<Order>,
  ) {
    try {
      const orderRef = doc(
        db,
        "orders",
        orderId,
      );

      const updatedData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(
        orderRef,
        updatedData,
      );

      const index = this.orders.findIndex(
        (order) => order.id === orderId,
      );

      if (index >= 0) {
        this.orders[index] = {
          ...this.orders[index],
          ...updatedData,
        };
      }

      this.saveCache();
      this.notify();

      return this.orders[index];
    } catch (error) {
      console.error(
        "Sipariş güncellenemedi:",
        error,
      );

      throw error;
    }
  }

  async cancelOrder(orderId: string) {
    return this.updateOrder(
      orderId,
      {
        status: "İptal Edildi" as OrderStatus,
      },
    );
  }

  async assignCourier(
    orderId: string,
    courierId: string,
  ) {
    return this.updateOrder(
      orderId,
      {
        courierId,
        status: "Kurye Atandı" as OrderStatus,
      },
    );
  }

  async deleteOrder(orderId: string) {
    try {
      const orderRef = doc(
        db,
        "orders",
        orderId,
      );

      await deleteDoc(orderRef);

      this.orders = this.orders.filter(
        (order) => order.id !== orderId,
      );

      this.saveCache();
      this.notify();
    } catch (error) {
      console.error(
        "Sipariş silinemedi:",
        error,
      );

      throw error;
    }
  }

  async addCourier(
    courier: Partial<Courier>,
  ) {
    if (!courier.id) {
      throw new Error(
        "Kurye ID bulunamadı.",
      );
    }

    const courierData = {
      ...courier,
      id: courier.id,
      role: "courier" as const,
      createdAt:
        courier.createdAt ||
        new Date().toISOString(),
      updatedAt:
        new Date().toISOString(),
      isActive:
        courier.isActive ?? true,
    };

    try {
      const courierRef = doc(
        db,
        "users",
        courier.id,
      );

      await setDoc(
        courierRef,
        courierData,
        { merge: true },
      );

      const user =
        courierData as UserProfile;

      const index = this.users.findIndex(
        (item) => item.id === user.id,
      );

      if (index >= 0) {
        this.users[index] = user;
      } else {
        this.users.push(user);
      }

      this.saveCache();
      this.notify();

      return user;
    } catch (error) {
      console.error(
        "Kurye eklenemedi:",
        error,
      );

      throw error;
    }
  }

  async updateUser(
    userId: string,
    updates: Partial<UserProfile>,
  ) {
    try {
      const userRef = doc(
        db,
        "users",
        userId,
      );

      await updateDoc(
        userRef,
        {
          ...updates,
          updatedAt:
            new Date().toISOString(),
        },
      );

      const index = this.users.findIndex(
        (user) => user.id === userId,
      );

      if (index >= 0) {
        this.users[index] = {
          ...this.users[index],
          ...updates,
        };
      }

      if (
        this.currentUser?.id === userId
      ) {
        this.currentUser = {
          ...this.currentUser,
          ...updates,
        };
      }

      this.saveCache();
      this.notify();

      return this.users[index];
    } catch (error) {
      console.error(
        "Kullanıcı güncellenemedi:",
        error,
      );

      throw error;
    }
  }

  async deleteUser(userId: string) {
    try {
      const userRef = doc(
        db,
        "users",
        userId,
      );

      await deleteDoc(userRef);

      this.users = this.users.filter(
        (user) => user.id !== userId,
      );

      this.saveCache();
      this.notify();
    } catch (error) {
      console.error(
        "Kullanıcı silinemedi:",
        error,
      );

      throw error;
    }
  }

  async getUserById(userId: string) {
    const localUser = this.users.find(
      (user) => user.id === userId,
    );

    if (localUser) {
      return localUser;
    }

    try {
      const userRef = doc(
        db,
        "users",
        userId,
      );

      const snapshot =
        await getDoc(userRef);

      if (!snapshot.exists()) {
        return null;
      }

      return {
        ...snapshot.data(),
        id: snapshot.id,
      } as UserProfile;
    } catch (error) {
      console.error(
        "Kullanıcı alınamadı:",
        error,
      );

      return null;
    }
  }

  async getCustomersFromFirestore() {
    try {
      const usersRef = collection(
        db,
        "users",
      );

      const customersQuery = query(
        usersRef,
        where("role", "==", "customer"),
      );

      return new Promise<Customer[]>(
        (resolve, reject) => {
          const unsubscribe =
            onSnapshot(
              customersQuery,
              (snapshot) => {
                unsubscribe();

                const customers =
                  snapshot.docs.map(
                    (item) =>
                      ({
                        ...item.data(),
                        id: item.id,
                      }) as Customer,
                  );

                resolve(customers);
              },
              reject,
            );
        },
      );
    } catch (error) {
      console.error(
        "Müşteriler alınamadı:",
        error,
      );

      return [];
    }
  }

  async getCouriersFromFirestore() {
    try {
      const usersRef = collection(
        db,
        "users",
      );

      const couriersQuery = query(
        usersRef,
        where("role", "==", "courier"),
      );

      return new Promise<Courier[]>(
        (resolve, reject) => {
          const unsubscribe =
            onSnapshot(
              couriersQuery,
              (snapshot) => {
                unsubscribe();

                const couriers =
                  snapshot.docs.map(
                    (item) =>
                      ({
                        ...item.data(),
                        id: item.id,
                      }) as Courier,
                  );

                resolve(couriers);
              },
              reject,
            );
        },
      );
    } catch (error) {
      console.error(
        "Kuryeler alınamadı:",
        error,
      );

      return [];
    }
  }

  clear() {
    this.cleanupListeners();

    this.currentUser = null;
    this.users = [];
    this.orders = [];

    try {
      localStorage.removeItem(
        this.cacheKey,
      );
    } catch (error) {
      console.error(
        "Cache temizlenemedi:",
        error,
      );
    }

    this.notify();
  }

  setCurrentUser(
    user: UserProfile | null,
  ) {
    this.currentUser = user;

    if (user) {
      const index = this.users.findIndex(
        (item) => item.id === user.id,
      );

      if (index >= 0) {
        this.users[index] = user;
      } else {
        this.users.push(user);
      }
    }

    this.saveCache();
    this.notify();
  }
getPricing() {
  return DEFAULT_PRICING;
}

getNotifications(userId: string) {
  return [];
}
  getStats() {
    const totalOrders =
      this.orders.length;

    const pendingOrders =
      this.orders.filter(
        (order) =>
          order.status ===
          "Kurye Bekleniyor",
      ).length;

    const assignedOrders =
      this.orders.filter(
        (order) =>
          order.status ===
          "Kurye Atandı",
      ).length;

    const completedOrders =
      this.orders.filter(
        (order) =>
          order.status ===
          "Teslim Edildi",
      ).length;

    return {
      totalOrders,
      pendingOrders,
      assignedOrders,
      completedOrders,
      totalCustomers:
        this.getCustomers().length,
      totalCouriers:
        this.getCouriers().length,
    };
  }
}

const storage = new StorageService();

export { storage };
export default storage;