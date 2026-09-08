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
    email: user.email ?? "",
    phone: user.phoneNumber ?? "",
    role,
    avatar: user.photoURL ?? "",
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
  const cleanName = name.trim();
  const cleanEmail =
    email.trim().toLowerCase();
  const cleanPhone = phone.trim();

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

  const user = credential.user;

  try {
    await updateProfile(user, {
      displayName: cleanName,
    });

    const role =
      getDefaultRole(cleanEmail);

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
      doc(db, "users", user.uid),
      profileData
    );

    await sendEmailVerification(user);

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

    await signOut(auth).catch(
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

  const user = credential.user;

  if (!user.emailVerified) {
    await signOut(auth).catch(
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
    /*
     * Tüm cihazlarda önce popup.
     */
    const credential =
      await signInWithPopup(
        auth,
        provider
      );

    /*
     * Google Auth başarılı olduktan hemen sonra
     * Firestore profilini hazırla.
     */
    const profile =
      await ensureUserProfile(
        credential.user
      );

    return profile;
  } catch (error) {
    const code =
      getErrorCode(error);

    /*
     * Sadece popup tarayıcı tarafından
     * engellenirse redirect fallback.
     */
    if (
      code ===
        "auth/popup-blocked" ||
      code ===
        "auth/operation-not-supported-in-this-environment"
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

    /*
     * Kullanıcı popup'ı kapatırsa burada kalır.
     * Redirect başlatılmaz.
     */
    console.error(
      "Google giriş hatası:",
      error
    );

    throw error;
  }
}

/* =====================================================
   GOOGLE REDIRECT RESULT
===================================================== */

let redirectResultPromise:
  | Promise<AuthUserProfile | null>
  | null = null;

function processGoogleRedirect(): Promise<
  AuthUserProfile | null
> {
  if (redirectResultPromise) {
    return redirectResultPromise;
  }

  redirectResultPromise =
    getRedirectResult(auth)
      .then(async (result) => {
        /*
         * Redirect ile Google'dan döndüysek
         * burada user hazırdır.
         */
        if (result?.user) {
          return await ensureUserProfile(
            result.user
          );
        }

        /*
         * Normal popup/email girişinde
         * redirect sonucu null olur.
         */
        return null;
      })
      .catch((error) => {
        console.error(
          "Google redirect sonucu alınamadı:",
          error
        );

        /*
         * Firebase Auth yine de kullanıcıyı
         * restore ettiyse onunla devam et.
         */
        if (auth.currentUser) {
          return ensureUserProfile(
            auth.currentUser
          ).catch(() => null);
        }

        return null;
      });

  return redirectResultPromise;
}

export async function handleGoogleRedirectResult(): Promise<
  AuthUserProfile | null
> {
  return processGoogleRedirect();
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
  let unsubscribe:
    | (() => void)
    | null = null;

  /*
   * KRİTİK SENKRON NOKTASI:
   *
   * Redirect sonucu önce işlenir.
   * onAuthStateChanged bundan SONRA başlatılır.
   *
   * Böylece:
   *
   * redirect → user → profile → App
   *
   * zinciri tamamlanmadan App'e
   * sahte null gönderilmez.
   */
  void processGoogleRedirect().finally(() => {
    if (!mounted) {
      return;
    }

    unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!mounted) {
            return;
          }

          /*
           * Kullanıcı yok.
           */
          if (!user) {
            callback(
              null,
              null
            );

            return;
          }

          /*
           * Email/password hesabı doğrulanmamışsa
           * sisteme sokma.
           */
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

            if (mounted) {
              callback(
                null,
                null
              );
            }

            return;
          }

          try {
            /*
             * Firebase Auth user →
             * Firestore profile
             *
             * tek merkez.
             */
            const profile =
              await ensureUserProfile(
                user
              );

            if (!mounted) {
              return;
            }

            callback(
              user,
              profile
            );
          } catch (error) {
            console.error(
              "Kullanıcı profili alınamadı:",
              error
            );

            if (!mounted) {
              return;
            }

            /*
             * Firebase Auth var ama Firestore
             * geçici olarak cevap vermiyorsa
             * kullanıcıyı login ekranına atma.
             */
            callback(
              user,
              null
            );
          }
        }
      );
  });

  /*
   * App kapanırsa redirect sonucu henüz
   * tamamlanmamış olsa bile zinciri iptal et.
   */
  return () => {
    mounted = false;

    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
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
    await signOut(auth).catch(
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
  return !!profile && (
    profile.role === "admin" ||
    profile.email.toLowerCase() ===
      ADMIN_EMAIL.toLowerCase()
  );
}

export function isCourierUser(
  profile: AuthUserProfile | null
): boolean {
  return profile?.role === "courier";
}

export function isCustomerUser(
  profile: AuthUserProfile | null
): boolean {
  return profile?.role === "customer";
}

export function getFirebaseUser(): User | null {
  return auth.currentUser;
}