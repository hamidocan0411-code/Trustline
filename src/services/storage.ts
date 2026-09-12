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
  type Unsubscribe,
} from "firebase/firestore";

import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from "firebase/auth";

import {
  getApps,
  initializeApp,
} from "firebase/app";

import {
  db,
  auth,
  waitForAuthState,
  subscribeToAuthState,
} from "./firebase";

import type {
  CourierAvailability,
  CourierLocation,
  NotificationItem,
  Order,
  OrderStatus,
  PricingConfig,
  UserProfile,
} from "../types";

import {
  DEFAULT_PRICING,
} from "../utils/pricing";

/* ============================================================
   TYPES
============================================================ */

type Subscriber = () => void;

/* ============================================================
   CONSTANTS
============================================================ */

const ADMIN_EMAIL =
  "hamidocan0411@gmail.com";

const SECONDARY_APP_NAME =
  "TrustlineCourierCreator";

/* ============================================================
   STORAGE SERVICE
============================================================ */

class StorageService {
  private currentUser:
    | UserProfile
    | null = null;

  private users: UserProfile[] = [];

  private orders: Order[] = [];

  private notifications:
    NotificationItem[] = [];

  private courierLocations:
    CourierLocation[] = [];

  private pricing:
    PricingConfig = {
      ...DEFAULT_PRICING,
    };

  private subscribers =
    new Set<Subscriber>();

  private firestoreUnsubscribers:
    Unsubscribe[] = [];

  private authUnsubscribe:
    | Unsubscribe
    | null = null;

  private initialized = false;

  private initializing = false;

  private activeUserId:
    | string
    | null = null;

  private activeRole:
    | string
    | null = null;

  /* ==========================================================
     INIT
  ========================================================== */

  async init(): Promise<void> {
    if (this.initializing) {
      return;
    }

    if (this.initialized) {
      return;
    }

    this.initializing = true;

    try {
      console.log(
        "ğŸ”¥ Storage init baÅŸlÄ±yor..."
      );

      const firebaseUser =
        await waitForAuthState();

      if (firebaseUser) {
        console.log(
          "ğŸ” Storage Firebase kullanÄ±cÄ± bulundu:",
          {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
          }
        );

        try {
          await this.loadUserProfile(
            firebaseUser.uid
          );
        } catch (error) {
          console.error(
            "âŒ Storage kullanÄ±cÄ± profili yÃ¼klenemedi:",
            error
          );
        }
      } else {
        console.log(
          "â„¹ï¸ Storage init sÄ±rasÄ±nda aktif Firebase kullanÄ±cÄ±sÄ± yok."
        );
      }

      this.authUnsubscribe =
        subscribeToAuthState(
          async (firebaseUser) => {
            try {
              if (!firebaseUser) {
                console.log(
                  "ğŸ”’ Firebase kullanÄ±cÄ± yok. Storage temizleniyor."
                );

                await this.handleLogout();

                return;
              }

              console.log(
                "ğŸ” Storage Firebase Auth kullanÄ±cÄ± bulundu:",
                {
                  uid:
                    firebaseUser.uid,
                  email:
                    firebaseUser.email,
                  provider:
                    firebaseUser.providerData
                      .map(
                        (provider) =>
                          provider.providerId
                      )
                      .join(", "),
                }
              );

              await this.loadUserProfile(
                firebaseUser.uid
              );
            } catch (error) {
              console.error(
                "âŒ Storage Auth state iÅŸleme hatasÄ±:",
                error
              );
            }
          }
        );

      this.initialized = true;

      console.log(
        "ğŸ”¥ Trustline Storage sistemi hazÄ±r."
      );
    } catch (error) {
      console.error(
        "âŒ Storage init hatasÄ±:",
        error
      );
    } finally {
      this.initializing = false;

      this.emit();
    }
  }

  /* ==========================================================
     USER PROFILE LOAD
  ========================================================== */

  private async loadUserProfile(
    uid: string
  ): Promise<void> {
    try {
      const profileRef =
        doc(
          db,
          "users",
          uid
        );

      const profileSnapshot =
        await getDoc(profileRef);

      if (!profileSnapshot.exists()) {
        console.warn(
          "âš ï¸ Firebase Auth kullanÄ±cÄ±sÄ± var fakat users koleksiyonunda profil henÃ¼z bulunamadÄ±:",
          uid
        );

        return;
      }

      const profile: UserProfile = {
        ...(profileSnapshot.data() as UserProfile),
        id: profileSnapshot.id,
      };

      if (
        this.activeUserId === profile.id &&
        this.activeRole === profile.role &&
        this.currentUser
      ) {
        this.currentUser = profile;

        this.updateUserLocal(
          profile
        );

        this.emit();

        return;
      }

      console.log(
        "ğŸ‘¤ KullanÄ±cÄ± profili yÃ¼klendi:",
        {
          id: profile.id,
          email: profile.email,
          role: profile.role,
        }
      );

      this.currentUser = profile;

      this.activeUserId =
        profile.id;

      this.activeRole =
        profile.role;

      this.resetRealtimeData();

      this.updateUserLocal(
        profile
      );

      this.startListeners(
        profile
      );

      this.emit();
    } catch (error) {
      console.error(
        "âŒ KullanÄ±cÄ± profili yÃ¼klenemedi:",
        error
      );

      throw error;
    }
  }

  /* ==========================================================
     START LISTENERS
  ========================================================== */

  private startListeners(
    profile: UserProfile
  ): void {
    this.cleanupFirestoreListeners();

    const uid =
      profile.id;

    const role =
      profile.role;

    console.log(
      "ğŸ”¥ Firestore listener sistemi baÅŸlatÄ±lÄ±yor:",
      {
        uid,
        role,
        email: profile.email,
      }
    );

    this.startUserListener(
      profile
    );

    this.startOrderListener(
      uid,
      role
    );

    this.startNotificationListener(
      uid
    );

    this.startPricingListener();

    this.startCourierLocationListener(
      uid,
      role
    );
  }

  /* ==========================================================
     USER LISTENER
  ========================================================== */

  private startUserListener(
    profile: UserProfile
  ): void {
    const uid =
      profile.id;

    const role =
      profile.role;

    if (role === "admin") {
      const unsubscribe =
        onSnapshot(
          collection(
            db,
            "users"
          ),
          (snapshot) => {
            try {
              this.users =
                snapshot.docs.map(
                  (item) => ({
                    ...(item.data() as UserProfile),
                    id: item.id,
                  })
                );

              const updatedCurrentUser =
                this.users.find(
                  (user) =>
                    user.id === uid
                );

              if (updatedCurrentUser) {
                this.currentUser =
                  updatedCurrentUser;
              }

              console.log(
                "ğŸ‘‘ ADMIN kullanÄ±cÄ±lar gÃ¼ncellendi:",
                this.users.length
              );

              this.emit();
            } catch (error) {
              console.error(
                "âŒ Admin users snapshot iÅŸleme hatasÄ±:",
                error
              );
            }
          },
          (error) => {
            console.error(
              "âŒ Admin users listener hatasÄ±:",
              error
            );
          }
        );

      this.firestoreUnsubscribers.push(
        unsubscribe
      );

      return;
    }

    const unsubscribe =
      onSnapshot(
        doc(
          db,
          "users",
          uid
        ),
        (snapshot) => {
          try {
            if (
              !snapshot.exists()
            ) {
              console.warn(
                "âš ï¸ KullanÄ±cÄ± profili artÄ±k mevcut deÄŸil:",
                uid
              );

              this.emit();

              return;
            }

            const liveUser:
              UserProfile = {
              ...(snapshot.data() as UserProfile),
              id: snapshot.id,
            };

            const previousRole =
              this.currentUser?.role;

            if (
              previousRole &&
              previousRole !== liveUser.role
            ) {
              console.log(
                "ğŸ”„ KullanÄ±cÄ± rolÃ¼ deÄŸiÅŸti:",
                {
                  oldRole:
                    previousRole,
                  newRole:
                    liveUser.role,
                  uid:
                    liveUser.id,
                }
              );

              this.currentUser =
                liveUser;

              this.activeRole =
                liveUser.role;

              this.updateUserLocal(
                liveUser
              );

              this.resetRealtimeData();

              this.startListeners(
                liveUser
              );

              this.emit();

              return;
            }

            this.currentUser =
              liveUser;

            this.updateUserLocal(
              liveUser
            );

            this.emit();
          } catch (error) {
            console.error(
              "âŒ KullanÄ±cÄ± snapshot iÅŸleme hatasÄ±:",
              error
            );
          }
        },
        (error) => {
          console.error(
            "âŒ KullanÄ±cÄ± profil listener hatasÄ±:",
            error
          );
        }
      );

    this.firestoreUnsubscribers.push(
      unsubscribe
    );
  }

  /* ==========================================================
     ORDER LISTENER
  ========================================================== */

  private startOrderListener(
    uid: string,
    role: string
  ): void {
    let ordersQuery;

    if (role === "admin") {
      ordersQuery =
        query(
          collection(
            db,
            "orders"
          )
        );

      console.log(
        "ğŸ‘‘ ADMIN tÃ¼m sipariÅŸleri dinliyor."
      );
    } else if (
      role === "courier"
    ) {
      ordersQuery =
        query(
          collection(
            db,
            "orders"
          ),
          where(
            "courierId",
            "==",
            uid
          )
        );

      console.log(
        "ğŸš´ KURYE sipariÅŸleri dinliyor."
      );
    } else {
      ordersQuery =
        query(
          collection(
            db,
            "orders"
          ),
          where(
            "customerId",
            "==",
            uid
          )
        );

      console.log(
        "ğŸ‘¤ MÃœÅTERÄ° sipariÅŸleri dinliyor."
      );
    }

    const unsubscribe =
      onSnapshot(
        ordersQuery,
        (snapshot) => {
          try {
            this.orders =
              snapshot.docs.map(
                (item) => ({
                  ...(item.data() as Order),
                  id: item.id,
                })
              );

            console.log(
              "ğŸ“¦ SipariÅŸler gÃ¼ncellendi:",
              {
                count:
                  this.orders.length,
                role,
              }
            );

            this.emit();
          } catch (error) {
            console.error(
              "âŒ Orders snapshot iÅŸleme hatasÄ±:",
              error
            );
          }
        },
        (error) => {
          console.error(
            "âŒ Orders listener hatasÄ±:",
            error
          );
        }
      );

    this.firestoreUnsubscribers.push(
      unsubscribe
    );
  }

  /* ==========================================================
     NOTIFICATION LISTENER
  ========================================================== */

  private startNotificationListener(
    uid: string
  ): void {
    const notificationsQuery =
      query(
        collection(
          db,
          "notifications"
        ),
        where(
          "userId",
          "==",
          uid
        )
      );

    const unsubscribe =
      onSnapshot(
        notificationsQuery,
        (snapshot) => {
          try {
            this.notifications =
              snapshot.docs.map(
                (item) => ({
                  ...(item.data() as NotificationItem),
                  id: item.id,
                })
              );

            this.emit();
          } catch (error) {
            console.error(
              "âŒ Notification snapshot iÅŸleme hatasÄ±:",
              error
            );
          }
        },
        (error) => {
          console.error(
            "âŒ Notifications listener hatasÄ±:",
            error
          );
        }
      );

    this.firestoreUnsubscribers.push(
      unsubscribe
    );
  }

  /* ==========================================================
     PRICING LISTENER
  ========================================================== */

  private startPricingListener(): void {
    const unsubscribe =
      onSnapshot(
        doc(
          db,
          "pricing",
          "default"
        ),
        (snapshot) => {
          try {
            if (
              snapshot.exists()
            ) {
              this.pricing = {
                ...DEFAULT_PRICING,
                ...(snapshot.data() as PricingConfig),
              };
            } else {
              this.pricing = {
                ...DEFAULT_PRICING,
              };
            }

            this.emit();
          } catch (error) {
            console.error(
              "âŒ Pricing snapshot iÅŸleme hatasÄ±:",
              error
            );
          }
        },
        (error) => {
          console.error(
            "âŒ Pricing listener hatasÄ±:",
            error
          );
        }
      );

    this.firestoreUnsubscribers.push(
      unsubscribe
    );
  }

  /* ==========================================================
     COURIER LOCATION LISTENER
  ========================================================== */

  private startCourierLocationListener(
    uid: string,
    role: string
  ): void {
    if (role === "admin" || role === "customer") {const unsubscribe =
        onSnapshot(
          collection(
            db,
            "courierLocations"
          ),
          (snapshot) => {
            try {
              this.courierLocations =
                snapshot.docs.map(
                  (item) => {
                    const data =
                      item.data() as CourierLocation;

                    return {
                      ...data,
                      courierId:
                        data.courierId ||
                        item.id,
                    };
                  }
                );

              this.emit();
            } catch (error) {
              console.error(
                "âŒ Courier location snapshot iÅŸleme hatasÄ±:",
                error
              );
            }
          },
          (error) => {
            console.error(
              "âŒ Courier locations listener hatasÄ±:",
              error
            );
          }
        );

      this.firestoreUnsubscribers.push(
        unsubscribe
      );

      return;
    }

    if (
      role === "courier"
    ) {
      const unsubscribe =
        onSnapshot(
          doc(
            db,
            "courierLocations",
            uid
          ),
          (snapshot) => {
            try {
              if (
                snapshot.exists()
              ) {
                const data =
                  snapshot.data() as CourierLocation;

                const location:
                  CourierLocation = {
                  ...data,
                  courierId:
                    data.courierId ||
                    uid,
                };

                this.courierLocations =
                  [
                    ...this.courierLocations.filter(
                      (item) =>
                        item.courierId !== uid
                    ),
                    location,
                  ];
              } else {
                this.courierLocations =
                  this.courierLocations.filter(
                    (item) =>
                      item.courierId !== uid
                  );
              }

              this.emit();
            } catch (error) {
              console.error(
                "âŒ Kurye konum snapshot iÅŸleme hatasÄ±:",
                error
              );
            }
          },
          (error) => {
            console.error(
              "âŒ Kurye konum listener hatasÄ±:",
              error
            );
          }
        );

      this.firestoreUnsubscribers.push(
        unsubscribe
      );
    }
  }

  /* ==========================================================
     CLEANUP FIRESTORE LISTENERS
  ========================================================== */

  private cleanupFirestoreListeners(): void {
    for (
      const unsubscribe of
      this.firestoreUnsubscribers
    ) {
      try {
        unsubscribe();
      } catch (error) {
        console.warn(
          "âš ï¸ Listener kapatma hatasÄ±:",
          error
        );
      }
    }

    this.firestoreUnsubscribers =
      [];
  }

  /* ==========================================================
     RESET REALTIME DATA
  ========================================================== */

  private resetRealtimeData(): void {
    this.users = [];
    this.orders = [];
    this.notifications = [];
    this.courierLocations = [];

    this.pricing = {
      ...DEFAULT_PRICING,
    };
  }

  /* ==========================================================
     COURIER OFFLINE / GPS KAPATMA
  ========================================================== */

  async setCourierOffline(
    courierId: string
  ): Promise<void> {
    if (!courierId) {
      return;
    }

    const now =
      new Date().toISOString();

    const existingLocation =
      this.getCourierLocation(
        courierId
      );

    if (existingLocation) {
      try {
        await setDoc(
          doc(
            db,
            "courierLocations",
            courierId
          ),
          {
            courierId,
            latitude:
              existingLocation.latitude,
            longitude:
              existingLocation.longitude,
            updatedAt: now,
            isSharing: false,
          },
          {
            merge: true,
          }
        );

        const localLocation:
          CourierLocation = {
          ...existingLocation,
          updatedAt: now,
          isSharing: false,
        };

        this.courierLocations = [
          ...this.courierLocations.filter(
            (item) =>
              item.courierId !==
              courierId
          ),
          localLocation,
        ];
      } catch (error) {
        console.error(
          "âŒ Kurye GPS kapatÄ±lÄ±rken konum gÃ¼ncellenemedi:",
          error
        );
      }
    }

    try {
      await updateDoc(
        doc(
          db,
          "users",
          courierId
        ),
        {
          courierStatus:
            "Ã‡evrimdÄ±ÅŸÄ±",

          updatedAt: now,
        }
      );
    } catch (error) {
      console.error(
        "âŒ Kurye Ã§evrimdÄ±ÅŸÄ± yapÄ±lamadÄ±:",
        error
      );

      throw error;
    }

    const existingUser =
      this.getUserById(
        courierId
      );

    if (existingUser) {
      this.updateUserLocal({
        ...existingUser,
        courierStatus:
          "Ã‡evrimdÄ±ÅŸÄ±",
      });
    }

    if (
      this.currentUser?.id ===
      courierId
    ) {
      this.currentUser = {
        ...this.currentUser,
        courierStatus:
          "Ã‡evrimdÄ±ÅŸÄ±",
      };
    }

    this.emit();

    console.log(
      "ğŸ”´ Kurye Ã§evrimdÄ±ÅŸÄ± + canlÄ± GPS kapalÄ±:",
      courierId
    );
  }

  /* ==========================================================
     LOGOUT HANDLER
  ========================================================== */

  private async handleLogout(): Promise<void> {
    const logoutUser =
      this.currentUser;

    if (
      logoutUser?.role ===
      "courier"
    ) {
      try {
        await this.setCourierOffline(
          logoutUser.id
        );
      } catch (error) {
        console.error(
          "âš ï¸ Logout sÄ±rasÄ±nda kurye GPS kapatÄ±lamadÄ±:",
          error
        );
      }
    }

    this.cleanupFirestoreListeners();

    this.currentUser = null;

    this.activeUserId = null;

    this.activeRole = null;

    this.resetRealtimeData();

    this.emit();

    console.log(
      "ğŸ§¹ Storage logout temizliÄŸi tamamlandÄ±."
    );
  }

  /* ==========================================================
     LOCAL USER UPDATE
  ========================================================== */

  private updateUserLocal(
    user: UserProfile
  ): void {
    const exists =
      this.users.some(
        (item) =>
          item.id === user.id
      );

    if (exists) {
      this.users =
        this.users.map(
          (item) =>
            item.id === user.id
              ? user
              : item
        );
    } else {
      this.users = [
        ...this.users,
        user,
      ];
    }
  }

  /* ==========================================================
     SUBSCRIBERS
  ========================================================== */

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
        "âŒ Storage subscriber ilk Ã§aÄŸrÄ± hatasÄ±:",
        error
      );
    }

    return () => {
      this.subscribers.delete(
        callback
      );
    };
  }

  private emit(): void {
    for (
      const callback of
      this.subscribers
    ) {
      try {
        callback();
      } catch (error) {
        console.error(
          "âŒ Storage subscriber emit hatasÄ±:",
          error
        );
      }
    }
  }

  /* ==========================================================
     CURRENT USER
  ========================================================== */

  setCurrentUser(
    user: UserProfile | null
  ): void {
    if (!user) {
      void this.handleLogout();
      return;
    }

    const userChanged =
      this.activeUserId !== user.id ||
      this.activeRole !== user.role;

    this.currentUser =
      user;

    this.activeUserId =
      user.id;

    this.activeRole =
      user.role;

    if (userChanged) {
      this.resetRealtimeData();

      this.updateUserLocal(
        user
      );

      this.startListeners(
        user
      );
    } else {
      this.updateUserLocal(
        user
      );
    }

    this.emit();
  }

  getCurrentUser():
    | UserProfile
    | null {
    return this.currentUser;
  }

  /* ==========================================================
     USERS
  ========================================================== */

  getUsers(): UserProfile[] {
    return [
      ...this.users,
    ];
  }

  getUserById(
    id: string
  ):
    | UserProfile
    | undefined {
    return this.users.find(
      (user) =>
        user.id === id
    );
  }

  getCouriers():
    UserProfile[] {
    return this.users.filter(
      (user) =>
        user.role === "courier"
    );
  }

  getCustomers():
    UserProfile[] {
    return this.users.filter(
      (user) =>
        user.role === "customer"
    );
  }

  async updateUser(
    id: string,
    data: Partial<UserProfile>
  ): Promise<void> {
    if (!id) {
      throw new Error(
        "KullanÄ±cÄ± ID gerekli."
      );
    }

    await updateDoc(
      doc(
        db,
        "users",
        id
      ),
      {
        ...data,
        updatedAt:
          new Date().toISOString(),
      }
    );

    const existing =
      this.getUserById(id);

    if (existing) {
      const updatedUser:
        UserProfile = {
        ...existing,
        ...data,
      };

      this.updateUserLocal(
        updatedUser
      );

      if (
        this.currentUser?.id ===
        id
      ) {
        this.currentUser =
          updatedUser;
      }
    }

    this.emit();
  }

  /* ==========================================================
     COURIER EMPLOYMENT STATUS
  ========================================================== */

  async updateCourierEmploymentStatus(
    courierId: string,
    status: "active" | "inactive"
  ): Promise<void> {
    if (!courierId) {
      throw new Error(
        "Kurye ID gerekli."
      );
    }

    const existing =
      this.getUserById(
        courierId
      );

    if (
      existing &&
      existing.role !== "courier"
    ) {
      throw new Error(
        "Bu kullanÄ±cÄ± kurye deÄŸil."
      );
    }

    const now =
      new Date().toISOString();

    await updateDoc(
      doc(
        db,
        "users",
        courierId
      ),
      {
        employmentStatus:
          status,
        updatedAt:
          now,
      }
    );

    if (existing) {
      const updatedUser:
        UserProfile = {
        ...existing,
        employmentStatus:
          status,
        updatedAt:
          now,
      } as UserProfile;

      this.updateUserLocal(
        updatedUser
      );

      if (
        this.currentUser?.id ===
        courierId
      ) {
        this.currentUser =
          updatedUser;
      }
    }

    this.emit();

    console.log(
      "ğŸ‘” Kurye Ã§alÄ±ÅŸma durumu gÃ¼ncellendi:",
      {
        courierId,
        status,
      }
    );
  }

  /* ==========================================================
     CONVERT CUSTOMER TO COURIER
  ========================================================== */

  async convertCustomerToCourier(
    userId: string
  ): Promise<UserProfile> {
    if (!userId) {
      throw new Error(
        "KullanÄ±cÄ± ID gerekli."
      );
    }

    const adminUser =
      auth.currentUser;

    if (!adminUser) {
      throw new Error(
        "Admin oturumu bulunamadÄ±."
      );
    }

    if (
      adminUser.email
        ?.trim()
        .toLowerCase() !==
      ADMIN_EMAIL.toLowerCase()
    ) {
      throw new Error(
        "Bu iÅŸlemi sadece yetkili admin yapabilir."
      );
    }

    const userRef =
      doc(
        db,
        "users",
        userId
      );

    const snapshot =
      await getDoc(userRef);

    if (!snapshot.exists()) {
      throw new Error(
        "MÃ¼ÅŸteri bulunamadÄ±."
      );
    }

    const existing =
      snapshot.data() as UserProfile;

    if (
      existing.role ===
      "courier"
    ) {
      throw new Error(
        "Bu kullanÄ±cÄ± zaten kurye."
      );
    }

    if (
      existing.role ===
      "admin"
    ) {
      throw new Error(
        "YÃ¶netici hesabÄ± kurye yapÄ±lamaz."
      );
    }

    if (
      existing.role !==
      "customer"
    ) {
      throw new Error(
        "Sadece mÃ¼ÅŸteri hesaplarÄ± kurye yapÄ±labilir."
      );
    }

    const updatedAt =
      new Date().toISOString();

    const updatedProfile:
      UserProfile = {
      ...existing,

      id:
        snapshot.id,

      role:
        "courier",

      courierStatus:
        existing.courierStatus ||
        "Ã‡evrimdÄ±ÅŸÄ±",

      totalDeliveries:
        typeof existing.totalDeliveries ===
        "number"
          ? existing.totalDeliveries
          : 0,

      rating:
        typeof existing.rating ===
        "number"
          ? existing.rating
          : 5,
    };

    await updateDoc(
      userRef,
      {
        role:
          "courier",

        courierStatus:
          updatedProfile.courierStatus,

        totalDeliveries:
          updatedProfile.totalDeliveries,

        rating:
          updatedProfile.rating,

        updatedAt,
      }
    );

    this.updateUserLocal(
      updatedProfile
    );

    this.emit();

    console.log(
      "ğŸš´ MÃ¼ÅŸteri kurye yapÄ±ldÄ±:",
      {
        uid:
          updatedProfile.id,
        email:
          updatedProfile.email,
        name:
          updatedProfile.name,
      }
    );

    return updatedProfile;
  }

  /* ==========================================================
     CREATE COURIER
  ========================================================== */

  async createCourier(data: {
    name: string;
    email: string;
    phone?: string;
    password: string;
  }): Promise<UserProfile> {
    const name =
      data.name.trim();

    const email =
      data.email
        .trim()
        .toLowerCase();

    const phone =
      data.phone?.trim() ||
      "";

    if (!name) {
      throw new Error(
        "Kurye adÄ± gerekli."
      );
    }

    if (!email) {
      throw new Error(
        "Kurye e-postasÄ± gerekli."
      );
    }

    if (
      !data.password ||
      data.password.length < 6
    ) {
      throw new Error(
        "Åifre en az 6 karakter olmalÄ±dÄ±r."
      );
    }

    const adminUser =
      auth.currentUser;

    if (!adminUser) {
      throw new Error(
        "Admin oturumu bulunamadÄ±."
      );
    }

    if (
      adminUser.email
        ?.trim()
        .toLowerCase() !==
      ADMIN_EMAIL.toLowerCase()
    ) {
      throw new Error(
        "Bu iÅŸlemi sadece yetkili admin yapabilir."
      );
    }

    const existingApp =
      getApps().find(
        (app) =>
          app.name ===
          SECONDARY_APP_NAME
      );

    const secondaryApp =
      existingApp ??
      initializeApp(
        auth.app.options,
        SECONDARY_APP_NAME
      );

    const secondaryAuth =
      getAuth(
        secondaryApp
      );

    try {
      const credential =
        await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          data.password
        );

      const courierUser =
        credential.user;

      const now =
        new Date().toISOString();

      const profile:
        UserProfile = {
        id:
          courierUser.uid,

        name,

        email:
          courierUser.email ||
          email,

        phone,

        role:
          "courier",

        courierStatus:
          "Ã‡evrimdÄ±ÅŸÄ±",

        totalDeliveries:
          0,

        rating:
          5,

        createdAt:
          now,
      };

      await setDoc(
        doc(
          db,
          "users",
          courierUser.uid
        ),
        {
          ...profile,
          updatedAt:
            now,
        }
      );

      await signOut(
        secondaryAuth
      );

      return profile;
    } catch (error: any) {
      console.error(
        "âŒ Kurye oluÅŸturma hatasÄ±:",
        error
      );

      try {
        if (
          secondaryAuth.currentUser
        ) {
          await secondaryAuth.currentUser.delete();
        }
      } catch {
        // ignore cleanup error
      }

      try {
        await signOut(
          secondaryAuth
        );
      } catch {
        // ignore cleanup error
      }

      if (
        error?.code ===
        "auth/email-already-in-use"
      ) {
        throw new Error(
          "Bu e-posta adresi zaten kayÄ±tlÄ±."
        );
      }

      if (
        error?.code ===
        "auth/invalid-email"
      ) {
        throw new Error(
          "GeÃ§erli bir e-posta adresi girin."
        );
      }

      if (
        error?.code ===
        "auth/weak-password"
      ) {
        throw new Error(
          "Åifre en az 6 karakter olmalÄ±dÄ±r."
        );
      }

      throw error;
    }
  }

  /* ==========================================================
     COURIER STATUS
  ========================================================== */

  async updateCourierStatus(
    courierId: string,
    status: CourierAvailability
  ):
    Promise<
      UserProfile | undefined
    > {
    if (!courierId) {
      throw new Error(
        "Kurye ID gerekli."
      );
    }

    if (
      status ===
      "Ã‡evrimdÄ±ÅŸÄ±"
    ) {
      await this.setCourierOffline(
        courierId
      );

      return this.getUserById(
        courierId
      );
    }

    const existing =
      this.getUserById(
        courierId
      );

    const now =
      new Date().toISOString();

    await updateDoc(
      doc(
        db,
        "users",
        courierId
      ),
      {
        courierStatus:
          status,

        updatedAt:
          now,
      }
    );

    if (existing) {
      const updatedUser = {
        ...existing,
        courierStatus:
          status,
      };

      this.updateUserLocal(
        updatedUser
      );

      if (
        this.currentUser?.id ===
        courierId
      ) {
        this.currentUser =
          updatedUser;
      }

      this.emit();

      return updatedUser;
    }

    return existing;
  }

  /* ==========================================================
     ORDERS
  ========================================================== */

  getOrders(): Order[] {
    return [
      ...this.orders,
    ];
  }

  getOrderById(
    id: string
  ):
    | Order
    | undefined {
    return this.orders.find(
      (order) =>
        order.id === id
    );
  }

  async createOrder(
    order: Order
  ): Promise<Order> {
    if (!order.id) {
      throw new Error(
        "SipariÅŸ ID gerekli."
      );
    }

    const now =
      new Date().toISOString();

    const finalOrder:
      Order = {
      ...order,

      createdAt:
        order.createdAt ||
        now,

      updatedAt:
        now,
    };

    await setDoc(
      doc(
        db,
        "orders",
        finalOrder.id
      ),
      finalOrder
    );

    return finalOrder;
  }

  async updateOrder(
    id: string,
    data: Partial<Order>
  ): Promise<Order> {
    if (!id) {
      throw new Error(
        "SipariÅŸ ID gerekli."
      );
    }

    const updatedAt =
      new Date().toISOString();

    await updateDoc(
      doc(
        db,
        "orders",
        id
      ),
      {
        ...data,
        updatedAt,
      }
    );

    const current =
      this.getOrderById(
        id
      );

    const updatedOrder:
      Order = {
      ...(current || {
        id,
      }),

      ...data,

      id,

      updatedAt,
    } as Order;

    const exists =
      this.orders.some(
        (order) =>
          order.id === id
      );

    if (exists) {
      this.orders =
        this.orders.map(
          (order) =>
            order.id === id
              ? updatedOrder
              : order
        );
    } else {
      this.orders = [
        ...this.orders,
        updatedOrder,
      ];
    }

    this.emit();

    return updatedOrder;
  }

  /* ==========================================================
     UPDATE ORDER STATUS
     TESLÄ°M EDÄ°LDÄ° = DELIVERED AT KAYDI
  ========================================================== */

  async updateOrderStatus(
    orderId: string,
    status: OrderStatus
  ): Promise<Order> {
    if (!orderId) {
      throw new Error(
        "SipariÅŸ ID gerekli."
      );
    }

    const current =
      this.getOrderById(
        orderId
      );

    if (
      status ===
      "Teslim Edildi"
    ) {
      const deliveredAt =
        new Date().toISOString();

      const updatedAt =
        deliveredAt;

      await updateDoc(
        doc(
          db,
          "orders",
          orderId
        ),
        {
          status:
            "Teslim Edildi",

          deliveredAt,

          updatedAt,
        }
      );

      const updatedOrder:
        Order = {
        ...(current || {
          id: orderId,
        }),

        status:
          "Teslim Edildi",

        deliveredAt,

        updatedAt,

        id:
          orderId,
      } as Order;

      const exists =
        this.orders.some(
          (order) =>
            order.id ===
            orderId
        );

      if (exists) {
        this.orders =
          this.orders.map(
            (order) =>
              order.id ===
              orderId
                ? updatedOrder
                : order
          );
      } else {
        this.orders = [
          ...this.orders,
          updatedOrder,
        ];
      }

      this.emit();

      console.log(
        "âœ… SipariÅŸ teslim edildi:",
        {
          orderId,
          deliveredAt,
        }
      );

      return updatedOrder;
    }

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
      this.getUserById(
        courierId
      );

    if (!courier) {
      throw new Error(
        "Kurye bulunamadÄ±."
      );
    }

    if (
      courier.role !==
      "courier"
    ) {
      throw new Error(
        "SeÃ§ilen kullanÄ±cÄ± kurye deÄŸil."
      );
    }

    return this.updateOrder(
      orderId,
      {
        courierId,

        courierName:
          courier.name || "",

        courierPhone:
          courier.phone || "",

        status:
          "Kurye AtandÄ±",
      }
    );
  }

  async deleteOrder(
    orderId: string
  ): Promise<void> {
    if (!orderId) {
      throw new Error(
        "SipariÅŸ ID gerekli."
      );
    }

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
          order.id !== orderId
      );

    this.emit();
  }

  /* ==========================================================
     PRICING
  ========================================================== */

  getPricing():
    PricingConfig {
    return {
      ...this.pricing,
    };
  }

  async updatePricing(
    pricing: PricingConfig
  ): Promise<void> {
    const finalPricing = {
      ...DEFAULT_PRICING,
      ...pricing,

      updatedAt:
        new Date().toISOString(),
    };

    await setDoc(
      doc(
        db,
        "pricing",
        "default"
      ),
      finalPricing,
      {
        merge: true,
      }
    );

    this.pricing =
      finalPricing;

    this.emit();
  }

  async setPricing(
    pricing: PricingConfig
  ): Promise<void> {
    return this.updatePricing(
      pricing
    );
  }

  /* ==========================================================
     NOTIFICATIONS
  ========================================================== */

  getNotifications(
    userId: string
  ):
    NotificationItem[] {
    return [
      ...this.notifications
        .filter(
          (notification) =>
            notification.userId ===
            userId
        )
        .sort(
          (a, b) => {
            const dateA =
              new Date(
                a.createdAt || 0
              ).getTime();

            const dateB =
              new Date(
                b.createdAt || 0
              ).getTime();

            return (
              dateB -
              dateA
            );
          }
        ),
    ];
  }

  async createNotification(
    notification:
      NotificationItem
  ): Promise<void> {
    if (!notification.id) {
      throw new Error(
        "Bildirim ID gerekli."
      );
    }

    const now =
      new Date().toISOString();

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
          now,
      }
    );
  }

  async markNotificationAsRead(
    notificationId: string
  ): Promise<void> {
    if (!notificationId) {
      throw new Error(
        "Bildirim ID gerekli."
      );
    }

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

    this.notifications =
      this.notifications.map(
        (notification) =>
          notification.id ===
          notificationId
            ? {
                ...notification,
                read: true,
              }
            : notification
      );

    this.emit();
  }

  async markAllNotificationsAsRead(
    userId: string
  ): Promise<void> {
    if (!userId) {
      throw new Error(
        "KullanÄ±cÄ± ID gerekli."
      );
    }

    const userNotifications =
      this.notifications.filter(
        (notification) =>
          notification.userId ===
          userId &&
          !notification.read
      );

    for (
      const notification of
      userNotifications
    ) {
      await updateDoc(
        doc(
          db,
          "notifications",
          notification.id
        ),
        {
          read: true,
        }
      );
    }

    this.notifications =
      this.notifications.map(
        (notification) =>
          notification.userId ===
            userId
            ? {
                ...notification,
                read: true,
              }
            : notification
      );

    this.emit();

    console.log(
      "âœ… TÃ¼m bildirimler okundu:",
      userId
    );
  }

  /* ==========================================================
     COURIER LOCATION
  ========================================================== */

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
  ):
    Promise<CourierLocation> {
    if (!location.courierId) {
      throw new Error(
        "Kurye ID gerekli."
      );
    }

    const finalLocation:
      CourierLocation = {
      ...location,

      updatedAt:
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
  }

  /* ==========================================================
     DESTROY
  ========================================================== */

  destroy(): void {
    console.log(
      "ğŸ§¹ Storage destroy baÅŸlatÄ±ldÄ±."
    );

    this.cleanupFirestoreListeners();

    if (
      this.authUnsubscribe
    ) {
      try {
        this.authUnsubscribe();
      } catch {
        // ignore
      }

      this.authUnsubscribe =
        null;
    }

    this.initialized =
      false;

    this.initializing =
      false;

    this.currentUser =
      null;

    this.activeUserId =
      null;

    this.activeRole =
      null;

    this.resetRealtimeData();

    this.emit();
  }
}

/* ============================================================
   SINGLETON EXPORT
============================================================ */

export const storage =
  new StorageService();

void storage
  .init()
  .catch(
    (error) => {
      console.error(
        "âŒ Storage baÅŸlangÄ±Ã§ hatasÄ±:",
        error
      );
    }
  );

