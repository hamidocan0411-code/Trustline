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
   ROLE
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
   PROFILE
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

/* =====================================================
   FIRESTORE PROFILE
===================================================== */

export async function ensureUserProfile(
  user: User
): Promise<AuthUserProfile> {
  const userRef = doc(
    db,
    "users",
    user.uid
  );

  console.log(
    "📡 Firestore kullanıcı profili okunuyor:",
    user.uid
  );

  const snapshot =
    await getDoc(userRef);

  if (snapshot.exists()) {
    console.log(
      "🟢 Firestore kullanıcı profili bulundu:",
      user.uid
    );

    return normalizeProfile(
      user.uid,
      snapshot.data(),
      user
    );
  }

  console.log(
    "🟡 Firestore profili yok. Yeni profil oluşturuluyor:",
    user.uid
  );

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

  console.log(
    "🟢 Firestore kullanıcı profili oluşturuldu:",
    user.uid
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

    await signOut(
      auth
    );

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
      credential.user.uid,
      credential.user.email
    );

    /*
     * Burada profil alınır.
     * Ancak App'in asıl kullanıcı senkronizasyonu
     * onAuthStateChanged üzerinden yapılır.
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

    if (
      code ===
        "auth/popup-blocked" ||
      code ===
        "auth/operation-not-supported-in-this-environment"
    ) {
      console.log(
        "🟡 Popup kullanılamadı. Google redirect başlatılıyor..."
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

let redirectChecked = false;

export async function handleGoogleRedirectResult(): Promise<
  AuthUserProfile | null
> {
  /*
   * Çok önemli:
   * getRedirectResult sadece bir kez çalıştırılır.
   */
  if (redirectChecked) {
    return null;
  }

  redirectChecked = true;

  try {
    const result =
      await getRedirectResult(
        auth
      );

    if (!result?.user) {
      return null;
    }

    console.log(
      "🟢 Google redirect Auth kullanıcısı:",
      result.user.uid
    );

    return await ensureUserProfile(
      result.user
    );
  } catch (error) {
    console.error(
      "🔴 Google redirect hatası:",
      error
    );

    /*
     * Firebase Auth kullanıcıyı zaten restore ettiyse
     * mevcut kullanıcı üzerinden devam et.
     */
    if (auth.currentUser) {
      try {
        return await ensureUserProfile(
          auth.currentUser
        );
      } catch {
        return null;
      }
    }

    return null;
  }
}

/* =====================================================
   PROFILE RETRY
===================================================== */

async function loadProfileSafely(
  user: User
): Promise<AuthUserProfile | null> {
  for (
    let attempt = 1;
    attempt <= 3;
    attempt++
  ) {
    try {
      return await ensureUserProfile(
        user
      );
    } catch (error) {
      console.error(
        `🔴 Firestore profil hatası (${attempt}/3):`,
        error
      );

      if (attempt < 3) {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              attempt * 700
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

  console.log(
    "👂 Firebase Auth listener başlatılıyor..."
  );

  const unsubscribe =
    onAuthStateChanged(
      auth,
      async (user) => {
        if (!mounted) {
          return;
        }

        console.log(
          "🔐 Firebase Auth state:",
          user
            ? `${user.uid} / ${user.email}`
            : "YOK"
        );

        /*
         * Firebase gerçekten çıkış yaptığını
         * bildiriyorsa App login ekranına geçebilir.
         */
        if (!user) {
          callback(
            null,
            null
          );

          return;
        }

        /*
         * Google kullanıcılarında emailVerified
         * kontrolü yapılmaz.
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
         * Firebase Auth kullanıcısı canlı olarak mevcut.
         *
         * Şimdi Firestore users/{uid} okunuyor.
         */
        console.log(
          "📡 Firebase Auth kullanıcısı bulundu. Firestore profili bekleniyor..."
        );

        const profile =
          await loadProfileSafely(
            user
          );

        if (!mounted) {
          return;
        }

        /*
         * Burada ASLA signOut yapmıyoruz.
         *
         * Firebase Auth kullanıcı mevcutsa App'e
         * kullanıcıyı bildiriyoruz.
         */
        if (!profile) {
          console.warn(
            "⚠️ Firebase Auth kullanıcı mevcut fakat Firestore profil okunamadı."
          );

          callback(
            user,
            null
          );

          return;
        }

        console.log(
          "🟢 AUTH + FIRESTORE SENKRONİZASYONU TAMAMLANDI:",
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
   * Redirect sonucu listener'ı bekletmez.
   *
   * Sayfa redirect ile açıldıysa Firebase Auth zaten
   * onAuthStateChanged üzerinden kullanıcıyı yakalar.
   */
  void handleGoogleRedirectResult().catch(
    (error) => {
      console.error(
        "⚠️ Redirect kontrolü başarısız:",
        error
      );
    }
  );

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
      profile.role === "admin" ||
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