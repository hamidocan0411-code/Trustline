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

import {
  createUserWithEmailAndPassword,
  getAuth,
  getApps,
  initializeApp,
  signOut,
} from "firebase/auth";

import { db, auth } from "./firebase";
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

const ADMIN_EMAIL = "hamidocan0411@gmail.com";

class StorageService {
  private currentUser: UserProfile | null = null;

  private users: UserProfile[] = [];
  private orders: Order[] = [];
  private notifications: NotificationItem[] = [];
  private pricing: PricingConfig = DEFAULT_PRICING;
  private courierLocations: CourierLocation[] = [];

  private subscribers = new Set<Subscriber>();

  private initialized = false;
  private initializing = false;

  private unsubscribers: (() => void)[] = [];

  /*
   * ---------------------------------------------------------
   * TEMEL STORAGE
   * ---------------------------------------------------------
   */

  async init(): Promise<void> {
    if (this.initialized || this.initializing) {
      return;
    }

    this.initializing = true;

    try {
      /*
       * Firebase Auth'un hazır olmasını bekliyoruz.
       */
      await new Promise<void>((resolve) => {
        if (auth.currentUser) {
          resolve();
          return;
        }

        const unsubscribe = auth.onAuthStateChanged(() => {
          unsubscribe();
          resolve();
        });
      });

      const user = auth.currentUser;

      /*
       * Kullanıcı giriş yapmamışsa protected listener
       * başlatmıyoruz.
       */
      if (!user) {
        this.initialized = true;
        this.initializing = false;

        console.log(
          "Storage: Kullanıcı giriş yapmadığı için protected listener başlatılmadı."
        );

        return;
      }

      /*
       * Kullanıcı profilini bul.
       */
      let profile: UserProfile | null = null;

      try {
        const userSnapshot = await getDoc(
          doc(db, "users", user.uid)
        );

        if (userSnapshot.exists()) {
          profile = {
            ...(userSnapshot.data() as UserProfile),
            id: userSnapshot.id,
          };
        }
      } catch (error) {
        console.error(
          "Storage kullanıcı profili okunamadı:",
          error
        );
      }

      if (profile) {
        this.currentUser = profile;
      }

      this.startListeners(profile);

      this.initialized = true;
      this.initializing = false;

      console.log(
        "🔥 Firebase canlı veri sistemi başlatıldı"
      );
    } catch (error) {
      this.initializing = false;

      console.error(
        "Storage init hatası:",
        error
      );
    }
  }

  private startListeners(
    profile: UserProfile | null
  ) {
    /*
     * Eski listener'ları temizle.
     */
    this.unsubscribers.forEach(
      (unsubscribe) => {
        try {
          unsubscribe();
        } catch {
          // ignore
        }
      }
    );

    this.unsubscribers = [];

    if (!profile) {
      return;
    }

    const uid = profile.id;
    const role = profile.role;

    /*
     * -------------------------------------------------------
     * USERS
     * -------------------------------------------------------
     *
     * Admin:
     *   tüm kullanıcıları dinler.
     *
     * Courier:
     *   sadece kendi profilini dinler.
     *
     * Customer:
     *   sadece kendi profilini dinler.
     */

    if (role === "admin") {
      const unsubscribeUsers = onSnapshot(
        collection(db, "users"),
        (snapshot) => {
          this.users = snapshot.docs.map(
            (item) => ({
              ...(item.data() as UserProfile),
              id: item.id,
            })
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

      this.unsubscribers.push(
        unsubscribeUsers
      );
    } else {
      const unsubscribeUser = onSnapshot(
        doc(db, "users", uid),
        (snapshot) => {
          if (snapshot.exists()) {
            const user = {
              ...(snapshot.data() as UserProfile),
              id: snapshot.id,
            };

            this.users = [
              ...this.users.filter(
                (item) =>
                  item.id !== uid
              ),
              user,
            ];

            if (
              this.currentUser?.id === uid
            ) {
              this.currentUser = user;
            }
          }

          this.emit();
        },
        (error) => {
          console.error(
            "Kullanıcı canlı veri hatası:",
            error
          );
        }
      );

      this.unsubscribers.push(
        unsubscribeUser
      );
    }

    /*
     * -------------------------------------------------------
     * ORDERS
     * -------------------------------------------------------
     */

    let ordersQuery;

    if (role === "admin") {
      ordersQuery = query(
        collection(db, "orders")
      );
    } else if (role === "courier") {
      ordersQuery = query(
        collection(db, "orders"),
        where(
          "courierId",
          "==",
          uid
        )
      );
    } else {
      ordersQuery = query(
        collection(db, "orders"),
        where(
          "customerId",
          "==",
          uid
        )
      );
    }

    const unsubscribeOrders =
      onSnapshot(
        ordersQuery,
        (snapshot) => {
          this.orders =
            snapshot.docs.map(
              (item) => ({
                ...(item.data() as Order),
                id: item.id,
              })
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

    this.unsubscribers.push(
      unsubscribeOrders
    );

    /*
     * -------------------------------------------------------
     * NOTIFICATIONS
     * -------------------------------------------------------
     */

    const notificationsQuery =
      query(
        collection(db, "notifications"),
        where(
          "userId",
          "==",
          uid
        )
      );

    const unsubscribeNotifications =
      onSnapshot(
        notificationsQuery,
        (snapshot) => {
          this.notifications =
            snapshot.docs.map(
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

    this.unsubscribers.push(
      unsubscribeNotifications
    );

    /*
     * -------------------------------------------------------
     * PRICING
     * -------------------------------------------------------
     */

    const unsubscribePricing =
      onSnapshot(
        doc(
          db,
          "settings",
          "pricing"
        ),
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

    this.unsubscribers.push(
      unsubscribePricing
    );

    /*
     * -------------------------------------------------------
     * COURIER LOCATIONS
     * -------------------------------------------------------
     *
     * Admin tüm konumları görebilir.
     * Courier kendi konumunu görür.
     */

    if (role === "admin") {
      const unsubscribeLocations =
        onSnapshot(
          collection(
            db,
            "courierLocations"
          ),
          (snapshot) => {
            this.courierLocations =
              snapshot.docs.map(
                (item) => ({
                  ...(item.data() as CourierLocation),
                  courierId:
                    item.data()
                      .courierId ||
                    item.id,
                })
              );

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
        unsubscribeLocations
      );
    } else if (role === "courier") {
      const unsubscribeLocation =
        onSnapshot(
          doc(
            db,
            "courierLocations",
            uid
          ),
          (snapshot) => {
            if (snapshot.exists()) {
              const location =
                snapshot.data() as CourierLocation;

              this.courierLocations = [
                ...this.courierLocations.filter(
                  (item) =>
                    item.courierId !== uid
                ),
                {
                  ...location,
                  courierId:
                    location.courierId ||
                    uid,
                },
              ];
            }

            this.emit();
          },
          (error) => {
            console.error(
              "Kurye konum canlı veri hatası:",
              error
            );
          }
        );

      this.unsubscribers.push(
        unsubscribeLocation
      );
    }
  }

  subscribe(
    callback: Subscriber
  ): () => void {
    this.subscribers.add(
      callback
    );

    try {
      callback();
    } catch (error) {
      console.error(
        "Storage ilk subscriber hatası:",
        error
      );
    }

    return () => {
      this.subscribers.delete(
        callback
      );
    };
  }

  private emit() {
    this.subscribers.forEach(
      (callback) => {
        try {
          callback();
        } catch (error) {
          console.error(
            "Storage subscriber hatası:",
            error
          );
        }
      }
    );
  }

  setCurrentUser(
    user: UserProfile | null
  ) {
    this.currentUser = user;

    /*
     * Kullanıcı değiştiğinde listener'ları
     * yeni role göre yeniden kur.
     */
    if (user) {
      this.startListeners(user);
    }

    this.emit();
  }

  getCurrentUser():
    UserProfile | null {
    return this.currentUser;
  }

  /*
   * ---------------------------------------------------------
   * USERS
   * ---------------------------------------------------------
   */

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

  /*
   * ---------------------------------------------------------
   * GERÇEK KURYE OLUŞTURMA
   * ---------------------------------------------------------
   *
   * Admin hesabının çıkış yapmaması için ikinci Firebase
   * Auth instance kullanıyoruz.
   */

  async createCourier(data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }): Promise<UserProfile> {
    const name =
      data.name.trim();

    const email =
      data.email.trim().toLowerCase();

    const phone =
      data.phone?.trim() || "";

    const password =
      data.password;

    if (!name) {
      throw new Error(
        "Kurye adı gerekli."
      );
    }

    if (!email) {
      throw new Error(
        "Kurye e-postası gerekli."
      );
    }

    if (
      !password ||
      password.length < 6
    ) {
      throw new Error(
        "Şifre en az 6 karakter olmalıdır."
      );
    }

    /*
     * Şu anda giriş yapmış kullanıcı admin mi?
     */
    const adminUser =
      auth.currentUser;

    if (!adminUser) {
      throw new Error(
        "Admin oturumu bulunamadı. Lütfen tekrar giriş yapın."
      );
    }

    if (
      adminUser.email
        ?.trim()
        .toLowerCase() !==
      ADMIN_EMAIL.toLowerCase()
    ) {
      throw new Error(
        "Bu işlemi sadece admin yapabilir."
      );
    }

    /*
     * Aynı Firebase config ile ikinci app oluşturuyoruz.
     */
    const secondaryAppName =
      "TrustlineCourierCreator";

    const existingApp =
      getApps().find(
        (app) =>
          app.name ===
          secondaryAppName
      );

    const secondaryApp =
      existingApp ??
      initializeApp(
        adminUser.auth.app.options,
        secondaryAppName
      );

    const secondaryAuth =
      getAuth(
        secondaryApp
      );

    let createdUid =
      "";

    try {
      /*
       * GERÇEK Firebase Authentication hesabı.
       */
      const credential =
        await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          password
        );

      const courierUser =
        credential.user;

      createdUid =
        courierUser.uid;

      /*
       * Gerçek UID ile Firestore profili oluştur.
       */
      const now =
        new Date().toISOString();

      const profile:
        UserProfile = {
        id: courierUser.uid,
        name,
        email:
          courierUser.email ||
          email,
        phone,
        role: "courier",
        courierStatus:
          "Çevrimdışı",
        totalDeliveries: 0,
        rating: 5,
        createdAt: now,
      };

      await setDoc(
        doc(
          db,
          "users",
          courierUser.uid
        ),
        {
          ...profile,
          updatedAt: now,
        }
      );

      /*
       * Local storage listesini hemen güncelle.
       */
      this.users = [
        ...this.users.filter(
          (user) =>
            user.id !==
            profile.id
        ),
        profile,
      ];

      this.emit();

      /*
       * İkinci Auth hesabından çık.
       *
       * ANA ADMIN HESABI ETKİLENMEZ.
       */
      await signOut(
        secondaryAuth
      );

      console.log(
        "✅ Gerçek kurye hesabı oluşturuldu:",
        {
          uid: profile.id,
          email: profile.email,
          role: profile.role,
        }
      );

      return profile;
    } catch (error: any) {
      console.error(
        "Gerçek kurye oluşturma hatası:",
        error
      );

      /*
       * Firestore yazımı başarısız olursa oluşturulan Auth
       * hesabını temizlemeyi deniyoruz.
       */
      try {
        if (
          secondaryAuth.currentUser &&
          createdUid
        ) {
          await secondaryAuth.currentUser.delete();
        }
      } catch (deleteError) {
        console.warn(
          "Başarısız kurye hesabı temizlenemedi:",
          deleteError
        );
      }

      try {
        await signOut(
          secondaryAuth
        );
      } catch {
        // ignore
      }

      const code =
        error?.code;

      if (
        code ===
        "auth/email-already-in-use"
      ) {
        throw new Error(
          "Bu e-posta adresi zaten Firebase'de kayıtlı."
        );
      }

      if (
        code ===
        "auth/invalid-email"
      ) {
        throw new Error(
          "Geçerli bir e-posta adresi girin."
        );
      }

      if (
        code ===
        "auth/weak-password"
      ) {
        throw new Error(
          "Şifre Firebase kurallarına göre çok zayıf."
        );
      }

      if (
        code ===
        "permission-denied"
      ) {
        throw new Error(
          "Firestore yetkisi reddedildi. Firebase Rules içinde admin yetkisini kontrol edin."
        );
      }

      throw error;
    }
  }

  async updateCourierStatus(
    courierId: string,
    status: CourierAvailability
  ): Promise<UserProfile | undefined> {
    try {
      await updateDoc(
        doc(
          db,
          "users",
          courierId
        ),
        {
          courierStatus: status,
          updatedAt:
            new Date().toISOString(),
        }
      );

      const existing =
        this.getUserById(
          courierId
        );

      const updated = existing
        ? {
            ...existing,
            courierStatus:
              status,
          }
        : undefined;

      if (updated) {
        this.users =
          this.users.map(
            (user) =>
              user.id ===
              courierId
                ? updated
                : user
          );
      }

      this.emit();

      return updated;
    } catch (error) {
      console.error(
        "Kurye durum güncelleme hatası:",
        error
      );

      throw error;
    }
  }

  /*
   * ---------------------------------------------------------
   * ORDERS
   * ---------------------------------------------------------
   */

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

  async createOrder(
    order: Order
  ): Promise<Order> {
    try {
      const finalOrder = {
        ...order,
        createdAt:
          order.createdAt ||
          new Date().toISOString(),
        updatedAt:
          new Date().toISOString(),
      };

      await setDoc(
        doc(
          db,
          "orders",
          order.id
        ),
        finalOrder
      );

      return finalOrder;
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
      const current =
        this.getOrderById(id);

      await updateDoc(
        doc(
          db,
          "orders",
          id
        ),
        {
          ...data,
          updatedAt:
            new Date().toISOString(),
        }
      );

      const updatedOrder:
        Order = {
        ...(current || {
          id,
        }),
        ...data,
        id,
        updatedAt:
          new Date().toISOString(),
      } as Order;

      this.orders =
        this.orders.map(
          (order) =>
            order.id === id
              ? updatedOrder
              : order
        );

      this.emit();

      return updatedOrder;
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
    try {
      const courier =
        this.getUserById(
          courierId
        );

      const data: Partial<Order> =
        {
          courierId,
          courierName:
            courier?.name ||
            "",
          courierPhone:
            courier?.phone ||
            "",
          status:
            "Kurye Atandı",
        };

      return await this.updateOrder(
        orderId,
        data
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
        doc(
          db,
          "orders",
          orderId
        )
      );

      this.orders =
        this.orders.filter(
          (order) =>
            order.id !==
            orderId
        );

      this.emit();
    } catch (error) {
      console.error(
        "Sipariş silme hatası:",
        error
      );

      throw error;
    }
  }

  /*
   * ---------------------------------------------------------
   * PRICING
   * ---------------------------------------------------------
   */

  getPricing():
    PricingConfig {
    return this.pricing;
  }

  async updatePricing(
    pricing: PricingConfig
  ) {
    try {
      const finalPricing =
        {
          ...pricing,
          updatedAt:
            new Date().toISOString(),
        };

      /*
       * Mevcut AdminPanel ve rules yapısıyla uyumlu:
       * settings/pricing
       */
      await setDoc(
        doc(
          db,
          "settings",
          "pricing"
        ),
        finalPricing,
        {
          merge: true,
        }
      );

      this.pricing =
        finalPricing;

      this.emit();
    } catch (error) {
      console.error(
        "Fiyat güncelleme hatası:",
        error
      );

      throw error;
    }
  }

  /*
   * Eski kodlar setPricing çağırıyorsa
   * o da çalışsın.
   */
  async setPricing(
    pricing: PricingConfig
  ) {
    return this.updatePricing(
      pricing
    );
  }

  /*
   * ---------------------------------------------------------
   * NOTIFICATIONS
   * ---------------------------------------------------------
   */

  getNotifications(
    userId: string
  ): NotificationItem[] {
    return [
      ...this.notifications
        .filter(
          (notification) =>
            notification.userId ===
            userId
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
        }),
    ];
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

      throw error;
    }
  }

  /*
   * ---------------------------------------------------------
   * COURIER LOCATION
   * ---------------------------------------------------------
   */

  getCourierLocation(
    courierId: string
  ):
    | CourierLocation
    | undefined {
    return this.courierLocations.find(
      (location) =>
        location.courierId ===
        courierId
    );
  }

  async updateCourierLocation(
    location: CourierLocation
  ): Promise<CourierLocation> {
    try {
      const finalLocation = {
        ...location,
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
        finalLocation,
        {
          merge: true,
        }
      );

      this.courierLocations = [
        ...this.courierLocations.filter(
          (item) =>
            item.courierId !==
            location.courierId
        ),
        finalLocation,
      ];

      this.emit();

      return finalLocation;
    } catch (error) {
      console.error(
        "Kurye konum güncelleme hatası:",
        error
      );

      throw error;
    }
  }

  /*
   * ---------------------------------------------------------
   * TEMİZLE
   * ---------------------------------------------------------
   */

  destroy() {
    this.unsubscribers.forEach(
      (unsubscribe) => {
        try {
          unsubscribe();
        } catch {
          // ignore
        }
      }
    );

    this.unsubscribers = [];

    this.initialized = false;
    this.initializing = false;

    this.users = [];
    this.orders = [];
    this.notifications = [];
    this.courierLocations = [];

    this.currentUser = null;
  }
}

export const storage =
  new StorageService();

/*
 * Uygulama açılırken başlat.
 *
 * Hata uygulamayı siyah ekrana düşürmesin.
 */
void storage.init().catch(
  (error) => {
    console.error(
      "Storage başlangıç hatası:",
      error
    );
  }
);