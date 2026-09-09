import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "./firebase";

export const ADMIN_EMAIL =
  "hamidocan0411@gmail.com";

export type UserRole =
  | "customer"
  | "courier"
  | "admin";

export interface AuthUserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  vehicle?: string;
  plate?: string;
  courierStatus?:
    | "Müsait"
    | "Meşgul"
    | "Çevrimdışı";
  totalDeliveries?: number;
  rating?: number;
  createdAt: string;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

/* =====================================================
   ERROR HELPERS
===================================================== */

function createAuthError(
  code: string,
  message: string
): Error & { code: string } {
  const error =
    new Error(message) as Error & {
      code: string;
    };

  error.code = code;

  return error;
}

export function getErrorCode(
  error: unknown
): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    return String(
      Reflect.get(error, "code") ?? ""
    );
  }

  return "";
}

/* =====================================================
   ROLE HELPERS
===================================================== */

function getDefaultRole(
  email: string
): UserRole {
  return (
    email.trim().toLowerCase() ===
    ADMIN_EMAIL.toLowerCase()
      ? "admin"
      : "customer"
  );
}

function normalizeRole(
  value: unknown,
  email: string
): UserRole {
  if (
    value === "admin" ||
    value === "courier" ||
    value === "customer"
  ) {
    return value;
  }

  return getDefaultRole(email);
}

/* =====================================================
   PROFILE NORMALIZATION
===================================================== */

function normalizeProfile(
  uid: string,
  data: Record<string, unknown>,
  fallbackUser?: User
): AuthUserProfile {
  const email =
    typeof data.email === "string"
      ? data.email
      : fallbackUser?.email ?? "";

  const name =
    typeof data.name === "string" &&
    data.name.trim()
      ? data.name
      : fallbackUser?.displayName ??
        "Trustline Kullanıcısı";

  const phone =
    typeof data.phone === "string"
      ? data.phone
      : fallbackUser?.phoneNumber ?? "";

  const createdAt =
    typeof data.createdAt === "string"
      ? data.createdAt
      : new Date().toISOString();

  return {
    id: uid,

    name,

    email,

    phone,

    role: normalizeRole(
      data.role,
      email
    ),

    avatar:
      typeof data.avatar === "string"
        ? data.avatar
        : fallbackUser?.photoURL ??
          undefined,

    vehicle:
      typeof data.vehicle === "string"
        ? data.vehicle
        : undefined,

    plate:
      typeof data.plate === "string"
        ? data.plate
        : undefined,

    courierStatus:
      data.courierStatus === "Müsait" ||
      data.courierStatus === "Meşgul" ||
      data.courierStatus ===
        "Çevrimdışı"
        ? data.courierStatus
        : undefined,

    totalDeliveries:
      typeof data.totalDeliveries ===
      "number"
        ? data.totalDeliveries
        : 0,

    rating:
      typeof data.rating === "number"
        ? data.rating
        : 5,

    createdAt,
  };
}

/* =====================================================
   FIRESTORE USER PROFILE
===================================================== */

export async function ensureUserProfile(
  user: User
): Promise<AuthUserProfile> {
  const userRef = doc(
    db,
    "users",
    user.uid
  );

  const snapshot =
    await getDoc(userRef);

  /*
   * Profil zaten varsa doğrudan kullan.
   */
  if (snapshot.exists()) {
    return normalizeProfile(
      user.uid,
      snapshot.data(),
      user
    );
  }

  /*
   * Yeni Google / Firebase kullanıcısı.
   */
  const role =
    getDefaultRole(
      user.email ?? ""
    );

  const profileData = {
    id: user.uid,

    name:
      user.displayName?.trim() ||
      "Trustline Kullanıcısı",

    email:
      user.email ?? "",

    phone:
      user.phoneNumber ?? "",

    role,

    avatar:
      user.photoURL ?? "",

    totalDeliveries: 0,

    rating: 5,

    createdAt:
      new Date().toISOString(),

    createdAtServer:
      serverTimestamp(),
  };

  await setDoc(
    userRef,
    profileData
  );

  return normalizeProfile(
    user.uid,
    profileData,
    user
  );
}

/* =====================================================
   EMAIL REGISTER
===================================================== */

export async function registerUser({
  name,
  email,
  password,
  phone = "",
}: RegisterData): Promise<AuthUserProfile> {
  const cleanName =
    name.trim();

  const cleanEmail =
    email.trim().toLowerCase();

  const cleanPhone =
    phone.trim();

  if (!cleanName) {
    throw new Error(
      "Ad soyad gerekli."
    );
  }

  if (!cleanEmail) {
    throw new Error(
      "E-posta adresi gerekli."
    );
  }

  if (password.length < 6) {
    throw new Error(
      "Şifre en az 6 karakter olmalıdır."
    );
  }

  const credential =
    await createUserWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    );

  const user =
    credential.user;

  try {
    await updateProfile(
      user,
      {
        displayName:
          cleanName,
      }
    );

    const role =
      getDefaultRole(
        cleanEmail
      );

    const profileData = {
      id: user.uid,

      name: cleanName,

      email: cleanEmail,

      phone: cleanPhone,

      role,

      avatar: "",

      totalDeliveries: 0,

      rating: 5,

      createdAt:
        new Date().toISOString(),

      createdAtServer:
        serverTimestamp(),
    };

    await setDoc(
      doc(
        db,
        "users",
        user.uid
      ),
      profileData
    );

    await sendEmailVerification(
      user
    );

    await signOut(auth);

    throw createAuthError(
      "auth/email-verification-required",
      "Hesabınız oluşturuldu. E-posta adresinizi doğrulamanız gerekiyor."
    );
  } catch (error) {
    if (
      getErrorCode(error) ===
      "auth/email-verification-required"
    ) {
      throw error;
    }

    await signOut(
      auth
    ).catch(
      () => undefined
    );

    throw error;
  }
}

/* =====================================================
   EMAIL LOGIN
===================================================== */

export async function loginUser(
  email: string,
  password: string
): Promise<AuthUserProfile> {
  const cleanEmail =
    email.trim().toLowerCase();

  if (!cleanEmail) {
    throw new Error(
      "E-posta adresi gerekli."
    );
  }

  if (!password) {
    throw new Error(
      "Şifre gerekli."
    );
  }

  const credential =
    await signInWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    );

  const user =
    credential.user;

  if (!user.emailVerified) {
    await signOut(
      auth
    ).catch(
      () => undefined
    );

    throw createAuthError(
      "auth/email-not-verified",
      "E-posta adresiniz henüz doğrulanmamış."
    );
  }

  return ensureUserProfile(
    user
  );
}

/* =====================================================
   GOOGLE PROVIDER
===================================================== */

function createGoogleProvider() {
  const provider =
    new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  provider.addScope("profile");

  provider.addScope("email");

  return provider;
}

/* =====================================================
   GOOGLE LOGIN
===================================================== */

export async function loginWithGoogle(): Promise<
  AuthUserProfile | void
> {
  const provider =
    createGoogleProvider();

  await setPersistence(
    auth,
    browserLocalPersistence
  );

  try {
    console.log(
      "🔵 Google popup başlatılıyor..."
    );

    const credential =
      await signInWithPopup(
        auth,
        provider
      );

    console.log(
      "🟢 Google Auth başarılı:",
      credential.user.uid
    );

    /*
     * Popup sonrası profil hazırlanır.
     *
     * Aynı zamanda subscribeToAuth()
     * Firebase Auth state'i dinlediği için
     * App ayrıca login çağrısı yapmak zorunda değildir.
     */
    const profile =
      await ensureUserProfile(
        credential.user
      );

    console.log(
      "🟢 Google Firestore profili hazır:",
      profile.email
    );

    return profile;
  } catch (error) {
    const code =
      getErrorCode(error);

    /*
     * Popup engellenirse redirect kullan.
     */
    if (
      code ===
        "auth/popup-blocked" ||
      code ===
        "auth/operation-not-supported-in-this-environment"
    ) {
      console.log(
        "🟡 Google popup kullanılamadı. Redirect başlatılıyor..."
      );

      await signInWithRedirect(
        auth,
        provider
      );

      throw createAuthError(
        "auth/google-redirect-started",
        "Google giriş sayfasına yönlendiriliyorsunuz..."
      );
    }

    console.error(
      "🔴 Google giriş hatası:",
      error
    );

    throw error;
  }
}

/* =====================================================
   GOOGLE REDIRECT
===================================================== */

let redirectResultPromise:
  | Promise<
      AuthUserProfile | null
    >
  | null = null;

function processGoogleRedirect(): Promise<
  AuthUserProfile | null
> {
  /*
   * Aynı sayfada birden fazla
   * getRedirectResult çağrılmasını engelle.
   */
  if (
    redirectResultPromise
  ) {
    return redirectResultPromise;
  }

  redirectResultPromise =
    getRedirectResult(auth)
      .then(
        async (result) => {
          if (
            result?.user
          ) {
            console.log(
              "🟢 Google redirect kullanıcısı bulundu:",
              result.user.uid
            );

            const profile =
              await ensureUserProfile(
                result.user
              );

            console.log(
              "🟢 Redirect profili hazır:",
              profile.email
            );

            return profile;
          }

          /*
           * Popup veya normal email login
           * sırasında redirect sonucu null'dır.
           */
          return null;
        }
      )
      .catch(
        async (error) => {
          console.error(
            "⚠️ Google redirect sonucu alınamadı:",
            error
          );

          /*
           * Redirect sonucu alınamasa bile
           * Firebase Auth kullanıcıyı restore etmiş
           * olabilir.
           */
          const currentUser =
            auth.currentUser;

          if (
            currentUser
          ) {
            try {
              return await ensureUserProfile(
                currentUser
              );
            } catch {
              return null;
            }
          }

          return null;
        }
      );

  return redirectResultPromise;
}

export async function handleGoogleRedirectResult(): Promise<
  AuthUserProfile | null
> {
  return processGoogleRedirect();
}

/* =====================================================
   PROFILE RETRY
===================================================== */

async function getProfileWithRetry(
  user: User
): Promise<AuthUserProfile | null> {
  /*
   * Firestore kısa süreli gecikme yaşarsa
   * kullanıcıyı login ekranına atma.
   */
  const maxAttempts = 3;

  for (
    let attempt = 1;
    attempt <= maxAttempts;
    attempt++
  ) {
    try {
      return await ensureUserProfile(
        user
      );
    } catch (error) {
      console.error(
        `Profil yükleme denemesi ${attempt}/${maxAttempts} başarısız:`,
        error
      );

      if (
        attempt <
        maxAttempts
      ) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              500 * attempt
            )
        );
      }
    }
  }

  return null;
}

/* =====================================================
   AUTH SYNCHRONIZATION
===================================================== */

export function subscribeToAuth(
  callback: (
    user: User | null,
    profile: AuthUserProfile | null
  ) => void
): () => void {
  let mounted = true;

  /*
   * KRİTİK DEĞİŞİKLİK:
   *
   * Artık getRedirectResult() bitene kadar
   * onAuthStateChanged bekletilmiyor.
   *
   * Firebase Auth listener HEMEN kuruluyor.
   *
   * Böylece:
   *
   * Google
   *   ↓
   * Firebase Auth
   *   ↓
   * onAuthStateChanged
   *   ↓
   * Firestore profile
   *   ↓
   * App
   *
   * zinciri doğrudan çalışıyor.
   */

  const unsubscribe =
    onAuthStateChanged(
      auth,
      async (user) => {
        if (!mounted) {
          return;
        }

        console.log(
          "🔐 Firebase Auth state:",
          user?.uid ??
            "YOK"
        );

        /*
         * Firebase gerçekten kullanıcı olmadığını
         * bildiriyorsa login ekranına dön.
         */
        if (!user) {
          callback(
            null,
            null
          );

          return;
        }

        /*
         * Email/password kullanıcılarında
         * doğrulama zorunlu.
         *
         * Google kullanıcılarında bu kontrol
         * çalışmaz.
         */
        if (
          user.providerData.some(
            (provider) =>
              provider.providerId ===
              "password"
          ) &&
          !user.emailVerified
        ) {
          console.warn(
            "⚠️ Doğrulanmamış email hesabı."
          );

          await signOut(
            auth
          ).catch(
            () => undefined
          );

          if (mounted) {
            callback(
              null,
              null
            );
          }

          return;
        }

        /*
         * Firebase Auth var.
         *
         * Firestore profilini al.
         */
        const profile =
          await getProfileWithRetry(
            user
          );

        if (!mounted) {
          return;
        }

        if (!profile) {
          /*
           * Firebase Auth kullanıcı mevcutken
           * profil geçici olarak okunamadıysa
           * kullanıcıyı logout yapma.
           */
          console.warn(
            "⚠️ Firebase Auth kullanıcı mevcut ancak profil şu anda alınamadı."
          );

          callback(
            user,
            null
          );

          return;
        }

        console.log(
          "🟢 Auth senkronizasyonu tamamlandı:",
          profile.email
        );

        callback(
          user,
          profile
        );
      },
      (error) => {
        console.error(
          "🔴 Firebase Auth listener hatası:",
          error
        );

        if (!mounted) {
          return;
        }

        callback(
          null,
          null
        );
      }
    );

  /*
   * Redirect sonucunu da sayfa açılırken işle.
   *
   * Ancak bu işlem Auth listener'ı
   * BLOKE ETMEZ.
   */
  void processGoogleRedirect()
    .then((profile) => {
      if (
        mounted &&
        profile
      ) {
        console.log(
          "🟢 Google redirect senkronizasyonu tamamlandı:",
          profile.email
        );
      }
    })
    .catch((error) => {
      console.error(
        "⚠️ Redirect senkronizasyon hatası:",
        error
      );
    });

  /*
   * Cleanup.
   */
  return () => {
    mounted = false;

    try {
      unsubscribe();
    } catch (error) {
      console.warn(
        "Auth listener kapatılamadı:",
        error
      );
    }
  };
}

/* =====================================================
   CURRENT USER
===================================================== */

export async function getCurrentUserProfile(): Promise<
  AuthUserProfile | null
> {
  const user =
    auth.currentUser;

  if (!user) {
    return null;
  }

  if (
    user.providerData.some(
      (provider) =>
        provider.providerId ===
        "password"
    ) &&
    !user.emailVerified
  ) {
    await signOut(
      auth
    ).catch(
      () => undefined
    );

    return null;
  }

  return ensureUserProfile(
    user
  );
}

/* =====================================================
   LOGOUT
===================================================== */

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/* =====================================================
   ROLE HELPERS
===================================================== */

export function isAdminUser(
  profile: AuthUserProfile | null
): boolean {
  return (
    !!profile &&
    (
      profile.role ===
        "admin" ||
      profile.email
        .toLowerCase() ===
        ADMIN_EMAIL.toLowerCase()
    )
  );
}

export function isCourierUser(
  profile: AuthUserProfile | null
): boolean {
  return (
    profile?.role ===
    "courier"
  );
}

export function isCustomerUser(
  profile: AuthUserProfile | null
): boolean {
  return (
    profile?.role ===
    "customer"
  );
}

export function getFirebaseUser(): User | null {
  return auth.currentUser;
}