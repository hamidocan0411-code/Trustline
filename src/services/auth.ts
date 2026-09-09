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

/* ============================================================
   ERROR HELPERS
============================================================ */

function createAuthError(
  code: string,
  message: string
): Error & { code: string } {
  const error = new Error(message) as Error & {
    code: string;
  };

  error.code = code;

  return error;
}

function getErrorCode(
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

/* ============================================================
   ROLE
============================================================ */

function getDefaultRole(
  email: string
): UserRole {
  return (
    email.trim().toLowerCase() ===
    ADMIN_EMAIL.toLowerCase()
  )
    ? "admin"
    : "customer";
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

/* ============================================================
   PROFILE NORMALIZATION
============================================================ */

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
      : fallbackUser?.displayName ||
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
        : fallbackUser?.photoURL ||
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
      data.courierStatus ===
        "Müsait" ||
      data.courierStatus ===
        "Meşgul" ||
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
      typeof data.rating ===
      "number"
        ? data.rating
        : 5,

    createdAt,
  };
}

/* ============================================================
   FALLBACK PROFILE
============================================================ */

/**
 * Firestore erişimi başarısız olsa bile
 * Firebase Auth kullanıcısından kullanılabilir
 * bir profil oluşturur.
 *
 * Bu profil uygulamanın Login ekranına
 * geri dönmesini engeller.
 */
function createFallbackProfile(
  user: User
): AuthUserProfile {
  const email =
    user.email ?? "";

  return {
    id: user.uid,

    name:
      user.displayName?.trim() ||
      "Trustline Kullanıcısı",

    email,

    phone:
      user.phoneNumber ?? "",

    role:
      getDefaultRole(email),

    avatar:
      user.photoURL ||
      undefined,

    totalDeliveries:
      0,

    rating:
      5,

    createdAt:
      new Date().toISOString(),
  };
}

/* ============================================================
   FIRESTORE PROFILE
============================================================ */

/**
 * Firestore profilini okur.
 *
 * Firestore izin problemi varsa Auth oturumunu
 * bozmaz ve fallback profil döndürür.
 */
export async function ensureUserProfile(
  user: User
): Promise<AuthUserProfile> {
  const fallbackProfile =
    createFallbackProfile(user);

  const userRef =
    doc(
      db,
      "users",
      user.uid
    );

  try {
    const snapshot =
      await getDoc(userRef);

    if (snapshot.exists()) {
      const data =
        snapshot.data();

      const profile =
        normalizeProfile(
          user.uid,
          data,
          user
        );

      /**
       * Güvenlik:
       *
       * Firestore'daki id alanı yanlışsa
       * uygulamada Firebase UID kullanılır.
       */
      return {
        ...profile,
        id: user.uid,
      };
    }
  } catch (error) {
    console.error(
      "⚠️ Firestore profil okunamadı. Auth oturumu korunuyor:",
      error
    );
  }

  /**
   * Profil yoksa oluşturmayı deniyoruz.
   *
   * Başarısız olursa kullanıcıyı logout etmiyoruz.
   */
  try {
    const profileData = {
      id: user.uid,

      name:
        user.displayName?.trim() ||
        "Trustline Kullanıcısı",

      email:
        user.email ?? "",

      phone:
        user.phoneNumber ?? "",

      role:
        getDefaultRole(
          user.email ?? ""
        ),

      avatar:
        user.photoURL ?? "",

      totalDeliveries:
        0,

      rating:
        5,

      createdAt:
        new Date().toISOString(),

      createdAtServer:
        serverTimestamp(),
    };

    await setDoc(
      userRef,
      profileData,
      {
        merge: true,
      }
    );

    return normalizeProfile(
      user.uid,
      profileData,
      user
    );
  } catch (error) {
    console.error(
      "⚠️ Firestore profil oluşturulamadı. Fallback profil kullanılıyor:",
      error
    );

    return fallbackProfile;
  }
}

/* ============================================================
   REGISTER
============================================================ */

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

  console.log(
    "🟡 Yeni Firebase Auth kullanıcısı oluşturuluyor:",
    cleanEmail
  );

  /**
   * KRİTİK:
   *
   * Firebase Authentication işlemi
   * Firestore'dan bağımsızdır.
   */
  const credential =
    await createUserWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    );

  const user =
    credential.user;

  console.log(
    "🟢 Firebase Auth kullanıcısı oluşturuldu:",
    {
      uid: user.uid,
      email: user.email,
    }
  );

  /**
   * İsim bilgisini Auth'a yaz.
   */
  try {
    await updateProfile(
      user,
      {
        displayName:
          cleanName,
      }
    );
  } catch (error) {
    console.warn(
      "⚠️ Firebase Auth profil adı güncellenemedi:",
      error
    );
  }

  /**
   * Firestore profilini oluşturmaya çalış.
   *
   * Permission hatası kayıt işlemini
   * başarısız yapmayacak.
   */
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

  try {
    await setDoc(
      doc(
        db,
        "users",
        user.uid
      ),
      profileData,
      {
        merge: true,
      }
    );

    console.log(
      "🟢 Firestore kullanıcı profili oluşturuldu:",
      user.uid
    );
  } catch (error) {
    /**
     * Firestore hatası burada kayıt işlemini
     * bozmayacak.
     *
     * Auth kullanıcısı zaten oluşturuldu.
     */
    console.error(
      "⚠️ Firestore profil yazılamadı fakat Auth hesabı oluşturuldu:",
      error
    );
  }

  /**
   * Email doğrulaması gönder.
   */
  try {
    await sendEmailVerification(
      user
    );

    console.log(
      "📧 Email doğrulama gönderildi:",
      cleanEmail
    );
  } catch (error) {
    console.warn(
      "⚠️ Email doğrulama gönderilemedi:",
      error
    );
  }

  /**
   * Kayıttan sonra kullanıcıyı logout ediyoruz.
   *
   * Bu normal davranış.
   */
  await signOut(
    auth
  ).catch(
    (error) => {
      console.warn(
        "⚠️ Kayıt sonrası logout hatası:",
        error
      );
    }
  );

  throw createAuthError(
    "auth/email-verification-required",
    "Hesabınız oluşturuldu. E-posta adresinizi doğrulamanız gerekiyor. E-postanıza gönderilen doğrulama bağlantısına tıklayın."
  );
}

/* ============================================================
   EMAIL LOGIN
============================================================ */

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

  console.log(
    "🟡 Email ile Firebase Auth giriş deneniyor:",
    cleanEmail
  );

  /**
   * Auth girişi.
   *
   * Buradaki hata Firestore kaynaklı değildir.
   */
  const credential =
    await signInWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    );

  const user =
    credential.user;

  console.log(
    "🟢 Firebase Auth email giriş başarılı:",
    {
      uid: user.uid,
      email: user.email,
      verified:
        user.emailVerified,
    }
  );

  /**
   * Email/password hesaplarında doğrulama şartı.
   */
  if (!user.emailVerified) {
    await signOut(
      auth
    ).catch(
      () => undefined
    );

    throw createAuthError(
      "auth/email-not-verified",
      "E-posta adresiniz henüz doğrulanmamış. E-postanıza gönderilen doğrulama bağlantısına tıklayın."
    );
  }

  /**
   * Firestore problem çıkarsa fallback profil
   * kullanılacak ve Auth oturumu korunacak.
   */
  const profile =
    await ensureUserProfile(
      user
    );

  console.log(
    "🟢 Email kullanıcı profili hazır:",
    {
      uid: profile.id,
      email: profile.email,
      role: profile.role,
    }
  );

  return profile;
}

/* ============================================================
   GOOGLE
============================================================ */

function createGoogleProvider():
  GoogleAuthProvider {
  const provider =
    new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  provider.addScope(
    "profile"
  );

  provider.addScope(
    "email"
  );

  return provider;
}

/* ============================================================
   MOBILE
============================================================ */

function isMobileDevice(): boolean {
  if (
    typeof window ===
    "undefined"
  ) {
    return false;
  }

  const userAgent =
    navigator.userAgent ||
    navigator.vendor ||
    "";

  const mobileRegex =
    /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i;

  const isMobileUserAgent =
    mobileRegex.test(
      userAgent
    );

  const isIPadOS =
    navigator.platform ===
      "MacIntel" &&
    navigator.maxTouchPoints >
      1;

  return (
    isMobileUserAgent ||
    isIPadOS
  );
}

/* ============================================================
   GOOGLE LOGIN
============================================================ */

export async function loginWithGoogle():
  Promise<
    AuthUserProfile | void
  > {
  const provider =
    createGoogleProvider();

  await setPersistence(
    auth,
    browserLocalPersistence
  );

  /**
   * iPhone / iPad / Android:
   * Redirect kullan.
   */
  if (isMobileDevice()) {
    console.log(
      "📱 Mobil Google giriş başlatılıyor..."
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

  /**
   * Desktop:
   * Popup kullan.
   */
  try {
    console.log(
      "🟡 Google popup giriş başlatılıyor..."
    );

    const credential =
      await signInWithPopup(
        auth,
        provider
      );

    const user =
      credential.user;

    console.log(
      "🟢 Google Auth giriş başarılı:",
      {
        uid: user.uid,
        email: user.email,
      }
    );

    const profile =
      await ensureUserProfile(
        user
      );

    console.log(
      "🟢 Google profili hazır:",
      {
        uid: profile.id,
        email: profile.email,
        role: profile.role,
      }
    );

    return profile;
  } catch (error) {
    const code =
      getErrorCode(error);

    /**
     * Popup engellenirse redirect'e geç.
     */
    const shouldUseRedirect =
      code ===
        "auth/popup-blocked" ||
      code ===
        "auth/operation-not-supported-in-this-environment";

    if (
      shouldUseRedirect
    ) {
      console.log(
        "🔄 Google popup kullanılamadı, redirect'e geçiliyor..."
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
      "❌ Google giriş hatası:",
      error
    );

    throw error;
  }
}

/* ============================================================
   GOOGLE REDIRECT
============================================================ */

export async function handleGoogleRedirectResult():
  Promise<AuthUserProfile | null> {
  try {
    const result =
      await getRedirectResult(
        auth
      );

    if (result?.user) {
      console.log(
        "🟢 Google redirect kullanıcısı bulundu:",
        {
          uid:
            result.user.uid,
          email:
            result.user.email,
        }
      );

      return await ensureUserProfile(
        result.user
      );
    }

    /**
     * Redirect sonucu null gelebilir.
     * Auth state yine hazır olabilir.
     */
    const currentUser =
      auth.currentUser;

    if (currentUser) {
      console.log(
        "🟢 Redirect sonrası currentUser bulundu:",
        currentUser.email
      );

      return await ensureUserProfile(
        currentUser
      );
    }

    return null;
  } catch (error) {
    console.error(
      "❌ Google redirect sonucu işlenemedi:",
      error
    );

    /**
     * Auth kullanıcısı mevcutsa
     * Firestore hatası yüzünden logout yapma.
     */
    const currentUser =
      auth.currentUser;

    if (currentUser) {
      return await ensureUserProfile(
        currentUser
      );
    }

    throw error;
  }
}

/* ============================================================
   LOGOUT
============================================================ */

export async function logoutUser():
  Promise<void> {
  await signOut(auth);
}

/* ============================================================
   CURRENT PROFILE
============================================================ */

export async function getCurrentUserProfile():
  Promise<
    AuthUserProfile | null
  > {
  const user =
    auth.currentUser;

  if (!user) {
    return null;
  }

  const isPasswordUser =
    user.providerData.some(
      (provider) =>
        provider.providerId ===
        "password"
    );

  if (
    isPasswordUser &&
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

/* ============================================================
   AUTH STATE
============================================================ */

export function subscribeToAuth(
  callback: (
    user: User | null,
    profile: AuthUserProfile | null
  ) => void
): () => void {
  return onAuthStateChanged(
    auth,
    async (user) => {
      console.log(
        "🔄 Firebase Auth state:",
        user?.email ?? "YOK"
      );

      if (!user) {
        callback(
          null,
          null
        );

        return;
      }

      const isPasswordUser =
        user.providerData.some(
          (provider) =>
            provider.providerId ===
            "password"
        );

      /**
       * Email/password kullanıcılarında
       * doğrulama kontrolü.
       */
      if (
        isPasswordUser &&
        !user.emailVerified
      ) {
        await signOut(
          auth
        ).catch(
          () => undefined
        );

        callback(
          null,
          null
        );

        return;
      }

      /**
       * Burada Firestore permission hatası
       * Auth state'i bozmayacak.
       */
      try {
        const profile =
          await ensureUserProfile(
            user
          );

        console.log(
          "🟢 Auth kullanıcı hazır:",
          {
            uid: profile.id,
            email: profile.email,
            role: profile.role,
          }
        );

        callback(
          user,
          profile
        );
      } catch (error) {
        /**
         * Bu blok normalde ensureUserProfile
         * fallback kullandığı için çalışmamalı.
         *
         * Yine de Auth kullanıcısını koruyoruz.
         */
        console.error(
          "⚠️ Profil hazırlanırken hata:",
          error
        );

        const fallback =
          createFallbackProfile(
            user
          );

        callback(
          user,
          fallback
        );
      }
    },
    (error) => {
      console.error(
        "❌ Firebase Auth listener hatası:",
        error
      );

      callback(
        null,
        null
      );
    }
  );
}

/* ============================================================
   ROLE HELPERS
============================================================ */

export function isAdminUser(
  profile: AuthUserProfile | null
): boolean {
  if (!profile) {
    return false;
  }

  return (
    profile.role ===
      "admin" ||
    profile.email
      .trim()
      .toLowerCase() ===
      ADMIN_EMAIL.toLowerCase()
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

/* ============================================================
   FIREBASE USER
============================================================ */

export function getFirebaseUser():
  User | null {
  return auth.currentUser;
}