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
  deleteUser,
  getAuth,
  signOut,
} from "firebase/auth";

import {
  getApps,
  initializeApp,
} from "firebase/app";

import { DEFAULT_PRICING } from "../utils/pricing";

import type {
  Courier,
  Customer,
  Order,
  OrderStatus,
  PricingConfig,
  UserProfile,
  CourierAvailability,
} from "../types";

import { auth, db } from "./firebase";

type CreateCourierData = {
  name: string;
  email: string;
  phone: string;
  password: string;
  vehicle?: string;
  plate?: string;
};

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
    this.listeners.forEach((listener) => {
      listener();
    });
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
      console.error(
        "Cache kaydedilemedi:",
        error,
      );
    }
  }

  private loadCache() {
    try {
      const raw =
        localStorage.getItem(
          this.cacheKey,
        );

      if (!raw) return;

      const cache =
        JSON.parse(raw);

      if (
        Array.isArray(
          cache.users,
        )
      ) {
        this.users =
          cache.users;
      }

      if (
        Array.isArray(
          cache.orders,
        )
      ) {
        this.orders =
          cache.orders;
      }
    } catch (error) {
      console.error(
        "Cache okunamadı:",
        error,
      );
    }
  }

  async initializeForUser(
    profile: UserProfile,
  ) {
    this.currentUser =
      profile;

    this.loadCache();

    this.cleanupListeners();

    await this.ensureUserProfile(
      profile,
    );

    this.setupUserListener(
      profile,
    );

    this.setupOrderListener(
      profile,
    );

    if (
      profile.role === "admin"
    ) {
      this.setupAdminUsersListener();
    }

    this.notify();
  }

  private cleanupListeners() {
    if (
      this.userUnsubscribe
    ) {
      this.userUnsubscribe();
      this.userUnsubscribe =
        null;
    }

    if (
      this.orderUnsubscribe
    ) {
      this.orderUnsubscribe();
      this.orderUnsubscribe =
        null;
    }

    if (
      this.adminUsersUnsubscribe
    ) {
      this.adminUsersUnsubscribe();
      this.adminUsersUnsubscribe =
        null;
    }
  }

  private async ensureUserProfile(
    profile: UserProfile,
  ) {
    if (!profile?.id) return;

    try {
      const userRef = doc(
        db,
        "users",
        profile.id,
      );

      const snapshot =
        await getDoc(userRef);

      if (!snapshot.exists()) {
        await setDoc(
          userRef,
          {
            ...profile,
            id: profile.id,
            updatedAt:
              new Date().toISOString(),
          },
          {
            merge: true,
          },
        );
      }
    } catch (error) {
      console.error(
        "Kullanıcı profili oluşturulamadı:",
        error,
      );
    }
  }

  private setupUserListener(
    profile: UserProfile,
  ) {
    if (!profile?.id) return;

    const userRef = doc(
      db,
      "users",
      profile.id,
    );

    this.userUnsubscribe =
      onSnapshot(
        userRef,
        (snapshot) => {
          if (!snapshot.exists())
            return;

          const user = {
            ...snapshot.data(),
            id: profile.id,
          } as UserProfile;

          this.currentUser = {
            ...this.currentUser,
            ...user,
          } as UserProfile;

          const index =
            this.users.findIndex(
              (item) =>
                item.id ===
                profile.id,
            );

          if (index >= 0) {
            this.users[index] =
              this.currentUser;
          } else {
            this.users.push(
              this.currentUser,
            );
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

  /**
   * ADMIN TÜM USERS KOLEKSİYONUNU DİNLER.
   *
   * Önceki sürüm sadece customer dinliyordu.
   * Bu yüzden yeni eklenen kuryeler
   * bazen admin panelinde görünmüyordu.
   */
  private setupAdminUsersListener() {
    const usersRef =
      collection(db, "users");

    this.adminUsersUnsubscribe =
      onSnapshot(
        usersRef,
        (snapshot) => {
          const users =
            snapshot.docs.map(
              (item) =>
                ({
                  ...item.data(),
                  id: item.id,
                }) as UserProfile,
            );

          this.users =
            users;

          this.saveCache();

          this.notify();
        },
        (error) => {
          console.error(
            "Admin kullanıcı listesi hatası:",
            error,
          );
        },
      );
  }

  private setupOrderListener(
    profile: UserProfile,
  ) {
    const ordersRef =
      collection(db, "orders");

    let ordersQuery;

    if (
      profile.role ===
      "customer"
    ) {
      ordersQuery = query(
        ordersRef,
        where(
          "customerId",
          "==",
          profile.id,
        ),
      );
    } else if (
      profile.role ===
      "courier"
    ) {
      ordersQuery = query(
        ordersRef,
        where(
          "courierId",
          "==",
          profile.id,
        ),
      );
    } else {
      ordersQuery = ordersRef;
    }

    this.orderUnsubscribe =
      onSnapshot(
        ordersQuery,
        (snapshot) => {
          const orders =
            snapshot.docs.map(
              (item) =>
                ({
                  ...item.data(),
                  id: item.id,
                }) as Order,
            );

          this.orders =
            orders;

          this.saveCache();

          this.notify();
        },
        (error) => {
          console.error(
            "Sipariş listener hatası:",
            error,
          );
        },
      );
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getOrders() {
    return [
      ...this.orders,
    ];
  }

  getCustomers(): Customer[] {
    return this.users.filter(
      (user) =>
        user.role ===
        "customer",
    ) as Customer[];
  }

  getCouriers(): Courier[] {
    return this.users.filter(
      (user) =>
        user.role ===
        "courier",
    ) as Courier[];
  }

  getUsers() {
    return [
      ...this.users,
    ];
  }

  getOrderById(
    id: string,
  ) {
    return this.orders.find(
      (order) =>
        order.id === id,
    );
  }

  async createOrder(
    data: Partial<Order>,
  ) {
    const firebaseUser =
      auth.currentUser;

    if (!firebaseUser) {
      throw new Error(
        "Firebase oturumu bulunamadı. Lütfen tekrar giriş yapın.",
      );
    }

    const customerId =
      this.currentUser?.role ===
      "customer"
        ? firebaseUser.uid
        : data.customerId ||
          this.currentUser?.id ||
          firebaseUser.uid;

    const orderId =
      data.id ||
      `order_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 9)}`;

    const now =
      new Date().toISOString();

    const cleanData =
      Object.fromEntries(
        Object.entries(
          data,
        ).filter(
          ([, value]) =>
            value !==
            undefined,
        ),
      );

    const order = {
      ...cleanData,
      id: orderId,
      customerId,
      courierId:
        data.courierId ??
        null,
      status:
        data.status ||
        "Kurye Bekleniyor",
      createdAt:
        data.createdAt ||
        now,
      updatedAt: now,
    } as Order;

    if (
      this.currentUser
        ?.role ===
      "customer"
    ) {
      order.customerId =
        firebaseUser.uid;
    }

    try {
      const orderRef =
        doc(
          db,
          "orders",
          orderId,
        );

      await setDoc(
        orderRef,
        order,
      );

      this.orders = [
        order,
        ...this.orders.filter(
          (item) =>
            item.id !==
            orderId,
        ),
      ];

      this.saveCache();

      this.notify();

      console.log(
        "Sipariş Firestore'a yazıldı:",
        order,
      );

      return order;
    } catch (error: any) {
      console.error(
        "Sipariş Firestore'a yazılamadı:",
        error,
      );

      if (
        error?.code ===
        "permission-denied"
      ) {
        throw new Error(
          "Firestore sipariş oluşturma yetkisini reddetti.",
        );
      }

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
    const firebaseUser =
      auth.currentUser;

    if (!firebaseUser) {
      throw new Error(
        "Firebase oturumu bulunamadı.",
      );
    }

    if (!orderId) {
      throw new Error(
        "Sipariş ID bulunamadı.",
      );
    }

    try {
      const orderRef =
        doc(
          db,
          "orders",
          orderId,
        );

      const snapshot =
        await getDoc(
          orderRef,
        );

      if (!snapshot.exists()) {
        throw new Error(
          "Sipariş Firestore'da bulunamadı.",
        );
      }

      const currentOrder =
        snapshot.data() as Order;

      if (
        this.currentUser
          ?.role ===
        "courier"
      ) {
        if (
          currentOrder.courierId !==
          firebaseUser.uid
        ) {
          throw new Error(
            "Bu sipariş size atanmamış.",
          );
        }

        if (
          updates.courierId !==
            undefined &&
          updates.courierId !==
            currentOrder.courierId
        ) {
          throw new Error(
            "Kurye siparişini başka bir kuryeye aktaramaz.",
          );
        }
      }

      const updatedData =
        {
          ...updates,
          updatedAt:
            new Date().toISOString(),
        };

      await updateDoc(
        orderRef,
        updatedData,
      );

      const updatedOrder =
        {
          ...currentOrder,
          ...updatedData,
          id: orderId,
        } as Order;

      const index =
        this.orders.findIndex(
          (order) =>
            order.id ===
            orderId,
        );

      if (index >= 0) {
        this.orders[index] =
          updatedOrder;
      } else {
        this.orders.push(
          updatedOrder,
        );
      }

      this.saveCache();

      this.notify();

      return updatedOrder;
    } catch (error: any) {
      console.error(
        "Sipariş güncellenemedi:",
        error,
      );

      if (
        error?.code ===
        "permission-denied"
      ) {
        throw new Error(
          "Firestore yetkisi reddedildi. Firestore Rules kontrol edilmeli.",
        );
      }

      throw new Error(
        error?.message ||
          "Sipariş güncellenemedi.",
      );
    }
  }

  async assignCourier(
    orderId: string,
    courierId: string,
  ) {
    if (!courierId) {
      throw new Error(
        "Kurye seçilmedi.",
      );
    }

    return this.updateOrder(
      orderId,
      {
        courierId,
        status:
          "Kurye Atandı" as OrderStatus,
      },
    );
  }

  async acceptOrder(
    orderId: string,
  ) {
    const firebaseUser =
      auth.currentUser;

    if (!firebaseUser) {
      throw new Error(
        "Firebase oturumu bulunamadı.",
      );
    }

    if (
      this.currentUser?.role !==
      "courier"
    ) {
      throw new Error(
        "Bu işlem sadece kurye hesabından yapılabilir.",
      );
    }

    const order =
      await this.getOrderByIdFromFirestore(
        orderId,
      );

    if (!order) {
      throw new Error(
        "Sipariş bulunamadı.",
      );
    }

    if (
      order.courierId !==
      firebaseUser.uid
    ) {
      throw new Error(
        "Bu sipariş size atanmamış.",
      );
    }

    if (
      order.status !==
      "Kurye Atandı"
    ) {
      throw new Error(
        "Bu sipariş şu anda kabul edilebilir durumda değil.",
      );
    }

    return this.updateOrder(
      orderId,
      {
        status:
          "Kurye Kabul Etti" as OrderStatus,
      },
    );
  }

  async pickupOrder(
    orderId: string,
  ) {
    return this.updateOrder(
      orderId,
      {
        status:
          "Paket Alındı" as OrderStatus,
      },
    );
  }

  async startDelivery(
    orderId: string,
  ) {
    return this.updateOrder(
      orderId,
      {
        status:
          "Teslimatta" as OrderStatus,
      },
    );
  }

  async completeOrder(
    orderId: string,
    deliveryData?: {
      receiverName?: string;
      deliveryNote?: string;
      signature?: string;
      deliveryPhoto?: string;
    },
  ) {
    const updates: Partial<Order> =
      {
        status:
          "Teslim Edildi" as OrderStatus,
      };

    if (deliveryData) {
      if (
        deliveryData.receiverName !==
        undefined
      ) {
        updates.receiverName =
          deliveryData.receiverName;
      }

      if (
        deliveryData.deliveryNote !==
        undefined
      ) {
        updates.deliveryNote =
          deliveryData.deliveryNote;
      }

      if (
        deliveryData.signature !==
        undefined
      ) {
        updates.signature =
          deliveryData.signature;
      }

      if (
        deliveryData.deliveryPhoto !==
        undefined
      ) {
        updates.deliveryPhoto =
          deliveryData.deliveryPhoto;
      }

      updates.deliveredAt =
        new Date().toISOString();
    }

    return this.updateOrder(
      orderId,
      updates,
    );
  }

  async cancelOrder(
    orderId: string,
  ) {
    return this.updateOrder(
      orderId,
      {
        status:
          "İptal Edildi" as OrderStatus,
      },
    );
  }

  private async getOrderByIdFromFirestore(
    orderId: string,
  ): Promise<Order | null> {
    const orderRef =
      doc(
        db,
        "orders",
        orderId,
      );

    const snapshot =
      await getDoc(
        orderRef,
      );

    if (!snapshot.exists()) {
      return null;
    }

    return {
      ...snapshot.data(),
      id: snapshot.id,
    } as Order;
  }

  async deleteOrder(
    orderId: string,
  ) {
    try {
      const orderRef =
        doc(
          db,
          "orders",
          orderId,
        );

      await deleteDoc(
        orderRef,
      );

      this.orders =
        this.orders.filter(
          (order) =>
            order.id !==
            orderId,
        );

      this.saveCache();

      this.notify();
    } catch (error: any) {
      console.error(
        "Sipariş silinemedi:",
        error,
      );

      throw error;
    }
  }

  /**
   * ESKİ YÖNTEM
   *
   * Firebase Authentication hesabı zaten
   * oluşturulmuşsa kullanılabilir.
   */
  async addCourier(
    courier: Partial<Courier>,
  ) {
    if (!courier.id) {
      throw new Error(
        "Kurye ID bulunamadı.",
      );
    }

    const courierData =
      {
        ...courier,
        id: courier.id,
        role: "courier" as const,
        createdAt:
          courier.createdAt ||
          new Date().toISOString(),
        updatedAt:
          new Date().toISOString(),
        isActive:
          courier.isActive ??
          true,
      };

    try {
      const courierRef =
        doc(
          db,
          "users",
          courier.id,
        );

      await setDoc(
        courierRef,
        courierData,
        {
          merge: true,
        },
      );

      const user =
        courierData as UserProfile;

      const index =
        this.users.findIndex(
          (item) =>
            item.id ===
            user.id,
        );

      if (index >= 0) {
        this.users[index] =
          user;
      } else {
        this.users.push(
          user,
        );
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

  /**
   * YENİ KURYE OLUŞTURMA
   *
   * Admin panelinden:
   *
   * 1. Firebase Authentication hesabı oluşturur.
   * 2. Firebase UID'yi alır.
   * 3. users/{UID} profili oluşturur.
   *
   * Admin'in mevcut oturumunu kapatmaz.
   */
  async createCourier(
    data: CreateCourierData,
  ): Promise<UserProfile> {
    const adminUser =
      auth.currentUser;

    if (!adminUser) {
      throw new Error(
        "Admin Firebase oturumu bulunamadı.",
      );
    }

    if (
      adminUser.email?.toLowerCase() !==
      "hamidocan@gmail.com"
    ) {
      throw new Error(
        "Bu işlem sadece admin hesabından yapılabilir.",
      );
    }

    const name =
      data.name.trim();

    const email =
      data.email
        .trim()
        .toLowerCase();

    const phone =
      data.phone.trim();

    const password =
      data.password;

    if (!name) {
      throw new Error(
        "Kurye adı zorunludur.",
      );
    }

    if (!email) {
      throw new Error(
        "Kurye e-postası zorunludur.",
      );
    }

    if (
      !password ||
      password.length < 6
    ) {
      throw new Error(
        "Şifre en az 6 karakter olmalıdır.",
      );
    }

    /**
     * Ana Firebase uygulamasından
     * farklı bir Firebase App oluşturuyoruz.
     *
     * Böylece yeni kurye oluşturulunca
     * admin hesabının oturumu düşmez.
     */
    const secondaryApp =
      getApps().find(
        (app) =>
          app.name ===
          "TrustlineCourierCreator",
      ) ||
      initializeApp(
        auth.app.options,
        "TrustlineCourierCreator",
      );

    const secondaryAuth =
      getAuth(
        secondaryApp,
      );

    let createdUser:
      | import("firebase/auth").User
      | null = null;

    try {
      const credential =
        await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          password,
        );

      createdUser =
        credential.user;

      const uid =
        createdUser.uid;

      const now =
        new Date().toISOString();

      const profile: UserProfile =
        {
          id: uid,
          name,
          email,
          phone,
          role: "courier",
          courierStatus:
            "Müsait",
          totalDeliveries: 0,
          rating: 5,
          createdAt: now,
        };

      /**
       * Firestore'a ana admin oturumu
       * üzerinden yazılır.
       */
      await setDoc(
        doc(
          db,
          "users",
          uid,
        ),
        profile,
      );

      /**
       * Local cache'i hemen güncelle.
       */
      const existingIndex =
        this.users.findIndex(
          (user) =>
            user.id === uid,
        );

      if (
        existingIndex >= 0
      ) {
        this.users[
          existingIndex
        ] = profile;
      } else {
        this.users.push(
          profile,
        );
      }

      this.saveCache();

      this.notify();

      console.log(
        "KURYE HESABI OLUŞTURULDU:",
        {
          uid,
          email,
          name,
        },
      );

      return profile;
    } catch (error: any) {
      console.error(
        "Kurye hesabı oluşturulamadı:",
        error,
      );

      /**
       * Auth oluşturuldu fakat Firestore
       * yazılamadıysa yeni Auth kullanıcısını
       * temizlemeye çalış.
       */
      if (createdUser) {
        try {
          await deleteUser(
            createdUser,
          );
        } catch (deleteError) {
          console.error(
            "Oluşturulan Auth kullanıcısı temizlenemedi:",
            deleteError,
          );
        }
      }

      if (
        error?.code ===
        "auth/email-already-in-use"
      ) {
        throw new Error(
          "Bu e-posta adresi zaten Firebase Authentication'da kayıtlı.",
        );
      }

      if (
        error?.code ===
        "auth/invalid-email"
      ) {
        throw new Error(
          "Geçersiz e-posta adresi.",
        );
      }

      if (
        error?.code ===
        "auth/weak-password"
      ) {
        throw new Error(
          "Şifre çok zayıf. En az 6 karakter kullanın.",
        );
      }

      if (
        error?.code ===
        "permission-denied"
      ) {
        throw new Error(
          "Firestore kurye profili oluşturma yetkisini reddetti. Firestore Rules kontrol edilmeli.",
        );
      }

      throw new Error(
        error?.message ||
          "Kurye hesabı oluşturulamadı.",
      );
    } finally {
      /**
       * Secondary Auth oturumunu kapat.
       * Ana admin Auth oturumu etkilenmez.
       */
      try {
        await signOut(
          secondaryAuth,
        );
      } catch {
        // Bilerek boş bırakıldı.
      }
    }
  }

  /**
   * Kurye durumunu güncelle.
   */
  async updateCourierStatus(
    courierId: string,
    status: CourierAvailability,
  ) {
    if (!courierId) {
      throw new Error(
        "Kurye ID bulunamadı.",
      );
    }

    return this.updateUser(
      courierId,
      {
        courierStatus:
          status,
      },
    );
  }

  async updateUser(
    userId: string,
    updates: Partial<UserProfile>,
  ) {
    try {
      const userRef =
        doc(
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

      const index =
        this.users.findIndex(
          (user) =>
            user.id === userId,
        );

      if (index >= 0) {
        this.users[index] =
          {
            ...this.users[index],
            ...updates,
          };
      }

      if (
        this.currentUser
          ?.id === userId
      ) {
        this.currentUser =
          {
            ...this.currentUser,
            ...updates,
          };
      }

      this.saveCache();

      this.notify();

      return index >= 0
        ? this.users[index]
        : undefined;
    } catch (error: any) {
      console.error(
        "Kullanıcı güncellenemedi:",
        error,
      );

      if (
        error?.code ===
        "permission-denied"
      ) {
        throw new Error(
          "Kullanıcı güncelleme yetkisi reddedildi.",
        );
      }

      throw error;
    }
  }

  async deleteUser(
    userId: string,
  ) {
    try {
      const userRef =
        doc(
          db,
          "users",
          userId,
        );

      await deleteDoc(
        userRef,
      );

      this.users =
        this.users.filter(
          (user) =>
            user.id !==
            userId,
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

  async getUserById(
    userId: string,
  ) {
    const localUser =
      this.users.find(
        (user) =>
          user.id === userId,
      );

    if (localUser) {
      return localUser;
    }

    try {
      const userRef =
        doc(
          db,
          "users",
          userId,
        );

      const snapshot =
        await getDoc(
          userRef,
        );

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
      const usersRef =
        collection(db, "users");

      const customersQuery =
        query(
          usersRef,
          where(
            "role",
            "==",
            "customer",
          ),
        );

      return new Promise<
        Customer[]
      >(
        (
          resolve,
          reject,
        ) => {
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

                resolve(
                  customers,
                );
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
      const usersRef =
        collection(db, "users");

      const couriersQuery =
        query(
          usersRef,
          where(
            "role",
            "==",
            "courier",
          ),
        );

      return new Promise<
        Courier[]
      >(
        (
          resolve,
          reject,
        ) => {
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

                resolve(
                  couriers,
                );
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

    this.currentUser =
      null;

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
    this.currentUser =
      user;

    if (user) {
      const index =
        this.users.findIndex(
          (item) =>
            item.id === user.id,
        );

      if (index >= 0) {
        this.users[index] =
          user;
      } else {
        this.users.push(
          user,
        );
      }
    }

    this.saveCache();

    this.notify();
  }

  getPricing() {
    return DEFAULT_PRICING;
  }

  getNotifications(
    _userId: string,
  ) {
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
        this.getCustomers()
          .length,
      totalCouriers:
        this.getCouriers()
          .length,
    };
  }
}

const storage =
  new StorageService();

export {
  storage,
};

export default storage;