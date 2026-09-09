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

export const ADMIN_EMAIL = "hamidocan0411@gmail.com";

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

function getErrorCode(error: unknown): string {
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

function getErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(
      Reflect.get(error, "message") ?? ""
    );
  }

  return String(error ?? "");
}

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
   PROFILE
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
      data.courierStatus === "Müsait" ||
      data.courierStatus === "Meşgul" ||
      data.courierStatus === "Çevrimdışı"
        ? data.courierStatus
        : undefined,

    totalDeliveries:
      typeof data.totalDeliveries === "number"
        ? data.totalDeliveries
        : 0,

    rating:
      typeof data.rating === "number"
        ? data.rating
        : 5,

    createdAt,
  };
}

function createFallbackProfile(
  user: User
): AuthUserProfile {
  const email = user.email ?? "";

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

    totalDeliveries: 0,
    rating: 5,

    createdAt:
      new Date().toISOString(),
  };
}

/* ============================================================
   FIRESTORE PROFILE
============================================================ */

export async function ensureUserProfile(
  user: User
): Promise<AuthUserProfile> {
  const fallbackProfile =
    createFallbackProfile(user);

  const userRef =
    doc(db, "users", user.uid);

  try {
    const snapshot =
      await getDoc(userRef);

    if (snapshot.exists()) {
      return {
        ...normalizeProfile(
          user.uid,
          snapshot.data(),
          user
        ),
        id: user.uid,
      };
    }
  } catch (error) {
    console.error(
      "⚠️ Firestore profil okunamadı:",
      {
        code: getErrorCode(error),
        message: getErrorMessage(error),
        uid: user.uid,
      }
    );
  }

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

      totalDeliveries: 0,
      rating: 5,

      createdAt:
        new Date().toISOString(),

      createdAtServer:
        serverTimestamp(),
    };

    await setDoc(
      userRef,
      profileData,
      { merge: true }
    );

    return normalizeProfile(
      user.uid,
      profileData,
      user
    );
  } catch (error) {
    console.error(
      "⚠️ Firestore profil oluşturulamadı:",
      {
        code: getErrorCode(error),
        message: getErrorMessage(error),
        uid: user.uid,
      }
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
    "🟡 Firebase kayıt başlıyor:",
    cleanEmail
  );

  let credential;

  try {
    credential =
      await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );
  } catch (error) {
    console.error(
      "❌ FIREBASE KAYIT HATASI:",
      {
        code: getErrorCode(error),
        message: getErrorMessage(error),
        email: cleanEmail,
      }
    );

    throw error;
  }

  const user =
    credential.user;

  console.log(
    "🟢 FIREBASE AUTH KULLANICISI OLUŞTU:",
    {
      uid: user.uid,
      email: user.email,
      providers:
        user.providerData.map(
          (provider) =>
            provider.providerId
        ),
    }
  );

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
      "⚠️ Auth isim güncellenemedi:",
      error
    );
  }

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
  } catch (error) {
    console.error(
      "⚠️ Firestore profil yazılamadı:",
      {
        code: getErrorCode(error),
        message: getErrorMessage(error),
        uid: user.uid,
      }
    );
  }

  try {
    await sendEmailVerification(
      user
    );

    console.log(
      "📧 Doğrulama e-postası gönderildi."
    );
  } catch (error) {
    console.warn(
      "⚠️ Doğrulama e-postası gönderilemedi:",
      error
    );
  }

  await signOut(auth).catch(
    (error) => {
      console.warn(
        "⚠️ Kayıt sonrası logout hatası:",
        error
      );
    }
  );

  throw createAuthError(
    "auth/email-verification-required",
    "Hesabınız oluşturuldu. E-posta adresinizi doğrulamanız gerekiyor."
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
    "🟡 FIREBASE EMAIL LOGIN:",
    cleanEmail
  );

  let credential;

  try {
    credential =
      await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );
  } catch (error) {
    const code =
      getErrorCode(error);

    const message =
      getErrorMessage(error);

    console.error(
      "❌❌❌ GERÇEK FIREBASE LOGIN HATASI ❌❌❌",
      {
        code,
        message,
        email: cleanEmail,
      }
    );

    /**
     * Firebase'in gerçek hatasını
     * değiştirmeden AuthScreen'e gönderiyoruz.
     */
    throw error;
  }

  const user =
    credential.user;

  console.log(
    "🟢🟢🟢 FIREBASE EMAIL LOGIN BAŞARILI 🟢🟢🟢",
    {
      uid: user.uid,
      email: user.email,
      emailVerified:
        user.emailVerified,

      providers:
        user.providerData.map(
          (provider) => ({
            providerId:
              provider.providerId,
            email:
              provider.email,
          })
        ),
    }
  );

  /**
   * Şifre hesabıysa email doğrulamasını kontrol et.
   */
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
    console.warn(
      "⚠️ Kullanıcı giriş yaptı fakat email doğrulanmamış."
    );

    await signOut(
      auth
    ).catch(
      () => undefined
    );

    throw createAuthError(
      "auth/email-not-verified",
      "E-posta adresiniz henüz doğrulanmamış. Lütfen e-postanıza gönderilen doğrulama bağlantısına tıklayın."
    );
  }

  const profile =
    await ensureUserProfile(
      user
    );

  console.log(
    "🟢 Kullanıcı profili hazır:",
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

  provider.addScope("profile");
  provider.addScope("email");

  return provider;
}

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
      "🟢 Google Auth başarılı:",
      {
        uid: user.uid,
        email: user.email,
        providers:
          user.providerData.map(
            (provider) =>
              provider.providerId
          ),
      }
    );

    return await ensureUserProfile(
      user
    );
  } catch (error) {
    const code =
      getErrorCode(error);

    console.error(
      "❌ Google giriş hatası:",
      {
        code,
        message:
          getErrorMessage(error),
      }
    );

    const shouldUseRedirect =
      code ===
        "auth/popup-blocked" ||
      code ===
        "auth/operation-not-supported-in-this-environment";

    if (
      shouldUseRedirect
    ) {
      await signInWithRedirect(
        auth,
        provider
      );

      throw createAuthError(
        "auth/google-redirect-started",
        "Google giriş sayfasına yönlendiriliyorsunuz..."
      );
    }

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
        "🟢 Google redirect kullanıcısı:",
        {
          uid:
            result.user.uid,
          email:
            result.user.email,
          providers:
            result.user.providerData.map(
              (provider) =>
                provider.providerId
            ),
        }
      );

      return await ensureUserProfile(
        result.user
      );
    }

    const currentUser =
      auth.currentUser;

    if (currentUser) {
      return await ensureUserProfile(
        currentUser
      );
    }

    return null;
  } catch (error) {
    console.error(
      "❌ Google redirect hatası:",
      {
        code: getErrorCode(error),
        message:
          getErrorMessage(error),
      }
    );

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

      console.log(
        "🔐 AUTH PROVIDERS:",
        user.providerData.map(
          (provider) => ({
            providerId:
              provider.providerId,
            email:
              provider.email,
          })
        )
      );

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
        console.warn(
          "⚠️ Auth state: email doğrulanmamış."
        );

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
        console.error(
          "⚠️ Profil hazırlanırken hata:",
          error
        );

        callback(
          user,
          createFallbackProfile(
            user
          )
        );
      }
    },
    (error) => {
      console.error(
        "❌ Firebase Auth listener hatası:",
        {
          code: getErrorCode(error),
          message:
            getErrorMessage(error),
        }
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
    profile.role === "admin" ||
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
    profile?.role === "courier"
  );
}

export function isCustomerUser(
  profile: AuthUserProfile | null
): boolean {
  return (
    profile?.role === "customer"
  );
}

/* ============================================================
   FIREBASE USER
============================================================ */

export function getFirebaseUser():
  User | null {
  return auth.currentUser;
}