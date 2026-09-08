import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
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

function getDefaultRole(
  email: string
): UserRole {
  return email.trim().toLowerCase() ===
    ADMIN_EMAIL.toLowerCase()
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
      data.courierStatus === "Çevrimdışı"
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

/**
 * Firebase Auth kullanıcısının
 * Firestore profilini getirir.
 */
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

  if (snapshot.exists()) {
    return normalizeProfile(
      user.uid,
      snapshot.data(),
      user
    );
  }

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

/**
 * Email + şifre ile yeni müşteri kaydı.
 */
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
      "Hesabınız oluşturuldu. E-posta adresinizi doğrulamanız gerekiyor. E-postanıza gönderilen doğrulama bağlantısına tıklayın."
    );
  } catch (error) {
    if (
      getErrorCode(error) ===
      "auth/email-verification-required"
    ) {
      throw error;
    }

    await signOut(auth).catch(
      () => undefined
    );

    throw error;
  }
}

/**
 * Email + şifre ile giriş.
 */
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
    await signOut(auth).catch(
      () => undefined
    );

    throw createAuthError(
      "auth/email-not-verified",
      "E-posta adresiniz henüz doğrulanmamış. E-postanıza gönderilen doğrulama bağlantısına tıklayın."
    );
  }

  return ensureUserProfile(
    user
  );
}

/**
 * Google provider oluşturur.
 */
function createGoogleProvider(): GoogleAuthProvider {
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

/**
 * Mobil cihaz kontrolü.
 */
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

/**
 * Firebase Auth kullanıcısını kısa süre bekler.
 *
 * Google redirect sonrasında bazı tarayıcılarda
 * auth.currentUser hemen hazır olmayabilir.
 */
function waitForAuthUser(
  timeoutMs = 8000
): Promise<User | null> {
  if (auth.currentUser) {
    return Promise.resolve(
      auth.currentUser
    );
  }

  return new Promise(
    (resolve) => {
      let finished = false;

      const finish = (
        user: User | null
      ) => {
        if (finished) return;

        finished = true;
        unsubscribe();
        clearTimeout(timer);

        resolve(user);
      };

      const unsubscribe =
        onAuthStateChanged(
          auth,
          (user) => {
            if (user) {
              finish(user);
            }
          },
          () => {
            finish(null);
          }
        );

      const timer =
        setTimeout(() => {
          finish(
            auth.currentUser
          );
        }, timeoutMs);
    }
  );
}

/**
 * Google ile giriş.
 *
 * Mobil:
 * Redirect.
 *
 * Masaüstü:
 * Popup.
 * Popup çalışmazsa redirect.
 */
export async function loginWithGoogle(): Promise<AuthUserProfile> {
  const provider =
    createGoogleProvider();

  if (isMobileDevice()) {
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
    const credential =
      await signInWithPopup(
        auth,
        provider
      );

    return await ensureUserProfile(
      credential.user
    );
  } catch (error) {
    const code =
      getErrorCode(error);

    const shouldUseRedirect =
      code ===
        "auth/popup-blocked" ||
      code ===
        "auth/operation-not-supported-in-this-environment" ||
      code ===
        "auth/popup-closed-by-user";

    if (shouldUseRedirect) {
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
      "Google giriş hatası:",
      error
    );

    throw error;
  }
}

/**
 * Google redirect sonucunu işler.
 *
 * Önemli:
 * getRedirectResult() boş dönerse bile
 * auth.currentUser ve onAuthStateChanged
 * üzerinden oturumu yakalamaya çalışırız.
 */
export async function handleGoogleRedirectResult(): Promise<AuthUserProfile | null> {
  try {
    const result =
      await getRedirectResult(
        auth
      );

    if (result?.user) {
      return await ensureUserProfile(
        result.user
      );
    }

    /*
     * Redirect sonucu boş olabilir.
     * Bu durumda Firebase Auth state'inin
     * hazır olmasını bekliyoruz.
     */
    const user =
      await waitForAuthUser(
        8000
      );

    if (!user) {
      return null;
    }

    return await ensureUserProfile(
      user
    );
  } catch (error) {
    console.error(
      "Google redirect sonucu alınamadı:",
      error
    );

    /*
     * getRedirectResult sırasında hata oluşsa bile
     * auth.currentUser hazırlandıysa kullanıcıyı
     * kaybetme.
     */
    const currentUser =
      auth.currentUser;

    if (currentUser) {
      try {
        return await ensureUserProfile(
          currentUser
        );
      } catch {
        // Alttaki orijinal hatayı döndüreceğiz.
      }
    }

    throw error;
  }
}

/**
 * Çıkış.
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Mevcut Firebase kullanıcısının
 * Firestore profilini getirir.
 */
export async function getCurrentUserProfile(): Promise<AuthUserProfile | null> {
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
    await signOut(auth).catch(
      () => undefined
    );

    return null;
  }

  try {
    return await ensureUserProfile(
      user
    );
  } catch {
    return null;
  }
}

/**
 * Kullanıcı auth durumunu dinler.
 */
export function subscribeToAuth(
  callback: (
    user: User | null,
    profile: AuthUserProfile | null
  ) => void
): () => void {
  return onAuthStateChanged(
    auth,
    async (user) => {
      if (!user) {
        callback(
          null,
          null
        );
        return;
      }

      /*
       * Email + şifre kullanıcıları için
       * doğrulama zorunludur.
       */
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

        callback(
          user,
          profile
        );
      } catch (error) {
        console.error(
          "Kullanıcı profili alınamadı:",
          error
        );

        callback(
          user,
          null
        );
      }
    }
  );
}

/**
 * Admin kontrolü.
 */
export function isAdminUser(
  profile: AuthUserProfile | null
): boolean {
  if (!profile) {
    return false;
  }

  return (
    profile.role ===
      "admin" ||
    profile.email.toLowerCase() ===
      ADMIN_EMAIL.toLowerCase()
  );
}

/**
 * Kurye kontrolü.
 */
export function isCourierUser(
  profile: AuthUserProfile | null
): boolean {
  return (
    profile?.role ===
    "courier"
  );
}

/**
 * Müşteri kontrolü.
 */
export function isCustomerUser(
  profile: AuthUserProfile | null
): boolean {
  return (
    profile?.role ===
    "customer"
  );
}

/**
 * Firebase Auth kullanıcısını
 * doğrudan döndürür.
 */
export function getFirebaseUser(): User | null {
  return auth.currentUser;
}