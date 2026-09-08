import {
  getApps,
  initializeApp,
} from "firebase/app";

import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signOut,
} from "firebase/auth";

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";

import { auth, db } from "./firebase";

import type {
  Courier,
  Customer,
  Order,
  OrderStatus,
  PricingConfig,
  UserProfile,
} from "../types";

import { DEFAULT_PRICING } from "../utils/pricing";

/*
|--------------------------------------------------------------------------
| TRUSTLINE STORAGE SERVICE
|--------------------------------------------------------------------------
|
| Firestore veri katmanı.
|
| Kullanıcılar:
|   users/{uid}
|
| Siparişler:
|   orders/{orderId}
|
| Fiyatlandırma:
|   settings/pricing
|
| Konum:
|   courierLocations/{courierId}
|
| Bildirim:
|   notifications/{notificationId}
|
|--------------------------------------------------------------------------
*/

class StorageService {
  private currentUser: UserProfile | null = null;

  private users: UserProfile[] = [];
  private orders: Order[] = [];
  private couriers: Courier[] = [];
  private customers: Customer[] = [];

  private unsubscribers: Unsubscribe[] = [];

  private initialized = false;

  private secondaryAppName =
    "TrustlineCourierCreator";

  /*
  |--------------------------------------------------------------------------
  | INIT
  |--------------------------------------------------------------------------
  */

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.initialized = true;

    if (auth.currentUser) {
      try {
        await this.setCurrentUser(
          auth.currentUser.uid
        );
      } catch (error) {
        console.error(
          "Storage başlatılamadı:",
          error
        );
      }
    }
  }

  /*
  |--------------------------------------------------------------------------
  | USER
  |--------------------------------------------------------------------------
  */

  async setCurrentUser(
    user: UserProfile | null
  ): Promise<void> {
    this.clearListeners();

    this.currentUser = user;

    this.users = [];
    this.orders = [];
    this.couriers = [];
    this.customers = [];

    if (!user) {
      return;
    }

    /*
     * Admin bütün kullanıcıları ve siparişleri görür.
     */
    if (user.role === "admin") {
      this.subscribeAllUsers();
      this.subscribeAllOrders();
      return;
    }

    /*
     * Müşteri sadece kendi siparişlerini görür.
     */
    if (user.role === "customer") {
      this.subscribeCustomerOrders(
        user.id
      );
      return;
    }

    /*
     * Kurye sadece kendisine atanmış siparişleri görür.
     */
    if (user.role === "courier") {
      this.subscribeCourierOrders(
        user.id
      );
    }
  }

  getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  /*
  |--------------------------------------------------------------------------
  | LISTENERS
  |--------------------------------------------------------------------------
  */

  private clearListeners(): void {
    for (const unsubscribe of this.unsubscribers) {
      try {
        unsubscribe();
      } catch {
        // ignore
      }
    }

    this.unsubscribers = [];
  }

  private addListener(
    unsubscribe: Unsubscribe
  ): void {
    this.unsubscribers.push(
      unsubscribe
    );
  }

  private subscribeAllUsers(): void {
    const usersRef = collection(
      db,
      "users"
    );

    const unsubscribe = onSnapshot(
      usersRef,
      (snapshot) => {
        this.users = snapshot.docs.map(
          (item) =>
            item.data() as UserProfile
        );

        this.couriers =
          this.users.filter(
            (item) =>
              item.role === "courier"
          ) as Courier[];

        this.customers =
          this.users.filter(
            (item) =>
              item.role === "customer"
          ) as Customer[];
      },
      (error) => {
        console.error(
          "Kullanıcı listener hatası:",
          error
        );
      }
    );

    this.addListener(unsubscribe);
  }

  private subscribeAllOrders(): void {
    const ordersRef = collection(
      db,
      "orders"
    );

    const unsubscribe = onSnapshot(
      ordersRef,
      (snapshot) => {
        this.orders = snapshot.docs
          .map((item) =>
            item.data() as Order
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
      },
      (error) => {
        console.error(
          "Sipariş listener hatası:",
          error
        );
      }
    );

    this.addListener(unsubscribe);
  }

  private subscribeCustomerOrders(
    customerId: string
  ): void {
    const ordersRef = collection(
      db,
      "orders"
    );

    const q = query(
      ordersRef,
      where(
        "customerId",
        "==",
        customerId
      )
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        this.orders = snapshot.docs
          .map((item) =>
            item.data() as Order
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
      },
      (error) => {
        console.error(
          "Müşteri sipariş listener hatası:",
          error
        );
      }
    );

    this.addListener(unsubscribe);
  }

  private subscribeCourierOrders(
    courierId: string
  ): void {
    const ordersRef = collection(
      db,
      "orders"
    );

    const q = query(
      ordersRef,
      where(
        "courierId",
        "==",
        courierId
      )
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        this.orders = snapshot.docs
          .map((item) =>
            item.data() as Order
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
      },
      (error) => {
        console.error(
          "Kurye sipariş listener hatası:",
          error
        );
      }
    );

    this.addListener(unsubscribe);
  }

  /*
  |--------------------------------------------------------------------------
  | USERS
  |--------------------------------------------------------------------------
  */

  async getCouriers(): Promise<
    Courier[]
  > {
    if (this.currentUser?.role === "admin") {
      return [...this.couriers];
    }

    const snapshot = await getDocs(
      query(
        collection(db, "users"),
        where(
          "role",
          "==",
          "courier"
        )
      )
    );

    return snapshot.docs.map(
      (item) =>
        item.data() as Courier
    );
  }

  async getCustomers(): Promise<
    Customer[]
  > {
    if (this.currentUser?.role === "admin") {
      return [...this.customers];
    }

    const snapshot = await getDocs(
      query(
        collection(db, "users"),
        where(
          "role",
          "==",
          "customer"
        )
      )
    );

    return snapshot.docs.map(
      (item) =>
        item.data() as Customer
    );
  }

  async getUsers(): Promise<
    UserProfile[]
  > {
    if (this.currentUser?.role === "admin") {
      return [...this.users];
    }

    if (!this.currentUser) {
      return [];
    }

    const userRef = doc(
      db,
      "users",
      this.currentUser.id
    );

    const snapshot =
      await getDoc(userRef);

    if (!snapshot.exists()) {
      return [];
    }

    return [
      snapshot.data() as UserProfile,
    ];
  }

  async getUserById(
    userId: string
  ): Promise<UserProfile | null> {
    const snapshot = await getDoc(
      doc(db, "users", userId)
    );

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data() as UserProfile;
  }

  /*
  |--------------------------------------------------------------------------
  | COURIER CREATE
  |--------------------------------------------------------------------------
  |
  | NOT:
  | Bu yöntem frontend üzerinde secondary Firebase Auth
  | kullanır.
  |
  | Production ortamında bunu Cloud Function + Admin SDK
  | tarafına taşımak daha güvenlidir.
  |
  */

  async createCourier(data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    vehicle?: string;
    plate?: string;
  }): Promise<Courier> {
    if (
      !this.currentUser ||
      this.currentUser.role !== "admin"
    ) {
      throw new Error(
        "Kurye oluşturmak için admin yetkisi gerekir."
      );
    }

    const name = data.name.trim();
    const email = data.email
      .trim()
      .toLowerCase();
    const phone = data.phone.trim();
    const password = data.password;

    if (!name) {
      throw new Error(
        "Kurye adı gerekli."
      );
    }

    if (!email) {
      throw new Error(
        "Kurye e-posta adresi gerekli."
      );
    }

    if (password.length < 6) {
      throw new Error(
        "Kurye şifresi en az 6 karakter olmalıdır."
      );
    }

    /*
     * Ana admin oturumuna dokunmamak için
     * ikinci Firebase App kullanıyoruz.
     */

    const secondaryApp =
      getApps().find(
        (app) =>
          app.name ===
          this.secondaryAppName
      ) ??
      initializeApp(
        auth.app.options,
        this.secondaryAppName
      );

    const secondaryAuth =
      getAuth(secondaryApp);

    let createdUser:
      | typeof secondaryAuth.currentUser
      | null = null;

    try {
      const credential =
        await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          password
        );

      createdUser = credential.user;

      const uid = createdUser.uid;

      const courier: Courier = {
        id: uid,
        name,
        email,
        phone,
        role: "courier",
        vehicle:
          data.vehicle?.trim() ||
          "",
        plate:
          data.plate?.trim() ||
          "",
        courierStatus:
          "Çevrimdışı",
        totalDeliveries: 0,
        rating: 5,
        createdAt:
          new Date().toISOString(),
      } as Courier;

      /*
       * ÖNEMLİ:
       * Firestore Rules admin kontrolü kullanıyorsa
       * bu yazma işlemi yeni kurye Auth oturumu nedeniyle
       * admin olarak görünmeyebilir.
       *
       * Bu yüzden hata alınırsa Cloud Function mimarisine
       * geçeceğiz.
       */

      await setDoc(
        doc(db, "users", uid),
        courier
      );

      await signOut(
        secondaryAuth
      );

      return courier;
    } catch (error) {
      /*
       * Auth hesabı oluştu ama Firestore yazılamadıysa
       * yeni Auth hesabını temizlemeye çalış.
       */
      if (createdUser) {
        try {
          await deleteUser(
            createdUser
          );
        } catch {
          // ignore cleanup error
        }
      }

      try {
        await signOut(
          secondaryAuth
        );
      } catch {
        // ignore
      }

      throw error;
    }
  }

  /*
  |--------------------------------------------------------------------------
  | COURIER STATUS
  |--------------------------------------------------------------------------
  */

  async updateCourierStatus(
    courierId: string,
    status: Courier["courierStatus"]
  ): Promise<void> {
    await updateDoc(
      doc(db, "users", courierId),
      {
        courierStatus: status,
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | ORDERS
  |--------------------------------------------------------------------------
  */

  async getOrders(): Promise<Order[]> {
    return [...this.orders];
  }

  async getOrderById(
    orderId: string
  ): Promise<Order | null> {
    const snapshot = await getDoc(
      doc(db, "orders", orderId)
    );

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data() as Order;
  }

  async createOrder(
    order: Order
  ): Promise<Order> {
    if (!this.currentUser) {
      throw new Error(
        "Sipariş oluşturmak için giriş yapmalısınız."
      );
    }

    if (
      this.currentUser.role !==
      "customer"
    ) {
      throw new Error(
        "Siparişi yalnızca müşteri oluşturabilir."
      );
    }

    const now =
      new Date().toISOString();

    const newOrder: Order = {
      ...order,
      customerId:
        this.currentUser.id,
      customerName:
        this.currentUser.name,
      customerPhone:
        this.currentUser.phone,
      courierId:
        order.courierId ?? null,
      status:
        order.status ||
        "Kurye Bekleniyor",
      createdAt:
        order.createdAt || now,
      updatedAt: now,
    };

    await setDoc(
      doc(db, "orders", newOrder.id),
      newOrder
    );

    return newOrder;
  }

  async updateOrder(
    orderId: string,
    changes: Partial<Order>
  ): Promise<Order> {
    const orderRef = doc(
      db,
      "orders",
      orderId
    );

    const snapshot =
      await getDoc(orderRef);

    if (!snapshot.exists()) {
      throw new Error(
        "Sipariş bulunamadı."
      );
    }

    const existing =
      snapshot.data() as Order;

    const updatedOrder: Order = {
      ...existing,
      ...changes,
      id: orderId,
      updatedAt:
        new Date().toISOString(),
    };

    await updateDoc(
      orderRef,
      updatedOrder as DocumentData
    );

    return updatedOrder;
  }

  async deleteOrder(
    orderId: string
  ): Promise<void> {
    await deleteDoc(
      doc(db, "orders", orderId)
    );
  }

  /*
  |--------------------------------------------------------------------------
  | ASSIGN COURIER
  |--------------------------------------------------------------------------
  */

  async assignCourier(
    orderId: string,
    courierId: string
  ): Promise<Order> {
    const courier =
      await this.getUserById(
        courierId
      );

    if (!courier) {
      throw new Error(
        "Kurye bulunamadı."
      );
    }

    if (
      courier.role !== "courier"
    ) {
      throw new Error(
        "Seçilen kullanıcı kurye değil."
      );
    }

    const order =
      await this.getOrderById(
        orderId
      );

    if (!order) {
      throw new Error(
        "Sipariş bulunamadı."
      );
    }

    const updatedOrder =
      await this.updateOrder(
        orderId,
        {
          courierId:
            courier.id,
          courierName:
            courier.name,
          courierPhone:
            courier.phone,
          status:
            order.status ===
            "Kurye Bekleniyor"
              ? "Kurye Atandı"
              : order.status,
        }
      );

    /*
     * Kurye meşgul yapılır.
     */
    try {
      await this.updateCourierStatus(
        courier.id,
        "Meşgul"
      );
    } catch (error) {
      console.warn(
        "Kurye durumu güncellenemedi:",
        error
      );
    }

    return updatedOrder;
  }

  /*
  |--------------------------------------------------------------------------
  | ORDER STATUS
  |--------------------------------------------------------------------------
  */

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

  /*
  |--------------------------------------------------------------------------
  | PRICING
  |--------------------------------------------------------------------------
  */

  async getPricing(): Promise<PricingConfig> {
    const pricingRef = doc(
      db,
      "settings",
      "pricing"
    );

    const snapshot =
      await getDoc(pricingRef);

    if (!snapshot.exists()) {
      const fallback: PricingConfig =
        {
          ...DEFAULT_PRICING,
          updatedAt:
            new Date().toISOString(),
        };

      return fallback;
    }

    return snapshot.data() as PricingConfig;
  }

  async updatePricing(
    pricing: Partial<PricingConfig>
  ): Promise<PricingConfig> {
    if (
      !this.currentUser ||
      this.currentUser.role !== "admin"
    ) {
      throw new Error(
        "Fiyatlandırmayı yalnızca admin değiştirebilir."
      );
    }

    const current =
      await this.getPricing();

    const updated: PricingConfig =
      {
        ...current,
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
      updated,
      {
        merge: true,
      }
    );

    return updated;
  }

  async setPricing(
    pricing: Partial<PricingConfig>
  ): Promise<PricingConfig> {
    return this.updatePricing(
      pricing
    );
  }

  /*
  |--------------------------------------------------------------------------
  | COURIER LOCATION
  |--------------------------------------------------------------------------
  */

  async updateCourierLocation(
    latitude: number,
    longitude: number,
    isSharing = true
  ): Promise<void> {
    if (!this.currentUser) {
      throw new Error(
        "Konum paylaşmak için giriş yapmalısınız."
      );
    }

    if (
      this.currentUser.role !==
      "courier"
    ) {
      throw new Error(
        "Sadece kuryeler konum paylaşabilir."
      );
    }

    await setDoc(
      doc(
        db,
        "courierLocations",
        this.currentUser.id
      ),
      {
        courierId:
          this.currentUser.id,
        latitude,
        longitude,
        updatedAt:
          new Date().toISOString(),
        isSharing,
      },
      {
        merge: true,
      }
    );
  }

  async stopCourierLocationSharing(): Promise<void> {
    if (!this.currentUser) {
      return;
    }

    if (
      this.currentUser.role !==
      "courier"
    ) {
      return;
    }

    await setDoc(
      doc(
        db,
        "courierLocations",
        this.currentUser.id
      ),
      {
        courierId:
          this.currentUser.id,
        isSharing: false,
        updatedAt:
          new Date().toISOString(),
      },
      {
        merge: true,
      }
    );
  }

  /*
  |--------------------------------------------------------------------------
  | CLEANUP
  |--------------------------------------------------------------------------
  */

  destroy(): void {
    this.clearListeners();

    this.currentUser = null;
    this.users = [];
    this.orders = [];
    this.couriers = [];
    this.customers = [];
  }
}

export const storage =
  new StorageService();

export default storage;