import {
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getRedirectResult,
  onAuthStateChanged,
  sendEmailVerification,
  setPersistence,
  signInWithEmailAndPassword,
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

/**
 * =========================================================
 * SABİTLER
 * =========================================================
 */

export const ADMIN_EMAIL = "hamidocan0411@gmail.com";

const EXPECTED_PROJECT_ID = "trustline-8729d";

/**
 * =========================================================
 * FIREBASE DEBUG
 * =========================================================
 */

function logFirebaseConnection(): void {
  const projectId = auth.app.options.projectId;
  const authDomain = auth.app.options.authDomain;

  console.log("🔥 FIREBASE AUTH BAĞLANTISI:", {
    projectId,
    authDomain,
    expectedProjectId: EXPECTED_PROJECT_ID,
    projectCorrect: projectId === EXPECTED_PROJECT_ID,
  });

  console.log(
    "🌐 CURRENT ORIGIN:",
    window.location.origin
  );

  console.log(
    "🌐 CURRENT URL:",
    window.location.href
  );

  if (projectId !== EXPECTED_PROJECT_ID) {
    console.error(
      "🚨 KRİTİK: YANLIŞ FIREBASE PROJESİ!",
      {
        actualProjectId: projectId,
        expectedProjectId: EXPECTED_PROJECT_ID,
      }
    );
  }
}

/**
 * =========================================================
 * USER PROFILE
 * =========================================================
 */

export interface UserProfile {
  id: string;
  uid?: string;
  email: string;
  name: string;
  phone?: string;
  role: string;
  photoURL?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

/**
 * =========================================================
 * ERROR HELPERS
 * =========================================================
 */

function getFirebaseErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error
  ) {
    return String(
      (
        error as {
          code?: unknown;
        }
      ).code ?? "unknown"
    );
  }

  return "unknown";
}

function getFirebaseErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(
      (
        error as {
          message?: unknown;
        }
      ).message ?? error
    );
  }

  return String(error);
}

function logDetailedError(
  title: string,
  error: unknown
): void {
  console.error(`❌ ${title}`, error);

  console.error(`❌ ${title} DETAY:`, {
    code: getFirebaseErrorCode(error),
    message: getFirebaseErrorMessage(error),

    name:
      typeof error === "object" &&
      error !== null &&
      "name" in error
        ? String(
            (
              error as {
                name?: unknown;
              }
            ).name
          )
        : "unknown",

    customData:
      typeof error === "object" &&
      error !== null &&
      "customData" in error
        ? (
            error as {
              customData?: unknown;
            }
          ).customData
        : undefined,

    email:
      typeof error === "object" &&
      error !== null &&
      "email" in error
        ? (
            error as {
              email?: unknown;
            }
          ).email
        : undefined,

    credential:
      typeof error === "object" &&
      error !== null &&
      "credential" in error
        ? "MEVCUT"
        : "YOK",

    projectId: auth.app.options.projectId,
    authDomain: auth.app.options.authDomain,
    origin: window.location.origin,
    url: window.location.href,
  });
}

/**
 * =========================================================
 * REGISTER
 * =========================================================
 */

export async function registerUser(
  email: string,
  password: string,
  name: string,
  phone?: string
): Promise<UserProfile> {
  logFirebaseConnection();

  const cleanEmail = String(email)
    .trim()
    .toLowerCase();

  const cleanName = String(name).trim();

  const cleanPhone = String(phone ?? "").trim();

  try {
    console.log(
      "📝 Yeni kullanıcı kaydı başlıyor:",
      {
        email: cleanEmail,
        projectId: auth.app.options.projectId,
      }
    );

    const credential =
      await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

    const user = credential.user;

    console.log(
      "✅ Firebase Authentication kullanıcı oluşturdu:",
      {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        provider: user.providerData.map(
          (provider) => provider.providerId
        ),
      }
    );

    await updateProfile(user, {
      displayName: cleanName,
    });

    try {
      await sendEmailVerification(user);

      console.log(
        "📧 E-posta doğrulama bağlantısı gönderildi."
      );
    } catch (verificationError) {
      logDetailedError(
        "E-POSTA DOĞRULAMA HATASI",
        verificationError
      );

      await signOut(auth);

      throw verificationError;
    }

    await signOut(auth);

    const verificationError = new Error(
      "Kayıt başarılı. E-posta adresinize gönderilen doğrulama bağlantısına tıklayın."
    );

    (
      verificationError as Error & {
        code?: string;
      }
    ).code = "auth/email-verification-required";

    throw verificationError;
  } catch (error) {
    logDetailedError("REGISTER HATASI", error);
    throw error;
  }
}

/**
 * =========================================================
 * LOGIN
 * =========================================================
 */

export async function loginUser(
  email: string,
  password: string
): Promise<UserProfile> {
  logFirebaseConnection();

  const cleanEmail = String(email)
    .trim()
    .toLowerCase();

  console.log("🔐 LOGIN BAŞLIYOR:", {
    email: cleanEmail,
    projectId: auth.app.options.projectId,
    authDomain: auth.app.options.authDomain,
  });

  try {
    await setPersistence(
      auth,
      browserLocalPersistence
    );

    console.log("✅ Auth persistence hazır.");

    const credential =
      await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

    const user = credential.user;

    console.log(
      "✅ FIREBASE AUTH GİRİŞ BAŞARILI:",
      {
        uid: user.uid,
        email: user.email,
        emailVerified: user.emailVerified,
        providers: user.providerData.map(
          (provider) => provider.providerId
        ),
        projectId: auth.app.options.projectId,
      }
    );

    const hasPasswordProvider =
      user.providerData.some(
        (provider) =>
          provider.providerId === "password"
      );

    if (!hasPasswordProvider) {
      await signOut(auth);

      const providerError = new Error(
        "Bu hesap email/şifre ile giriş için yapılandırılmamış."
      );

      (
        providerError as Error & {
          code?: string;
        }
      ).code = "auth/wrong-provider";

      throw providerError;
    }

    if (!user.emailVerified) {
      await signOut(auth);

      const verificationError = new Error(
        "E-posta adresinizi doğrulamanız gerekiyor."
      );

      (
        verificationError as Error & {
          code?: string;
        }
      ).code = "auth/email-not-verified";

      throw verificationError;
    }

    return await ensureUserProfile(user);
  } catch (error) {
    logDetailedError("LOGIN HATASI", error);
    throw error;
  }
}

/**
 * =========================================================
 * ENSURE USER PROFILE
 * =========================================================
 */

export async function ensureUserProfile(
  user: User
): Promise<UserProfile> {
  console.log(
    "👤 Firestore profil kontrolü:",
    {
      uid: user.uid,
      email: user.email,
      emailVerified: user.emailVerified,
      path: `users/${user.uid}`,
    }
  );

  /**
   * Google kullanıcılarında emailVerified kontrolü
   * zorunlu değildir.
   *
   * Email/şifre kullanıcılarında mevcut doğrulama
   * zorunluluğu korunur.
   */

  const isGoogleUser =
    user.providerData.some(
      (provider) =>
        provider.providerId === "google.com"
    );

  if (!isGoogleUser && !user.emailVerified) {
    const verificationError = new Error(
      "E-posta adresinizi doğrulamanız gerekiyor."
    );

    (
      verificationError as Error & {
        code?: string;
      }
    ).code = "auth/email-not-verified";

    throw verificationError;
  }

  const userRef = doc(
    db,
    "users",
    user.uid
  );

  try {
    const snapshot = await getDoc(userRef);

    if (snapshot.exists()) {
      const data = snapshot.data();

      console.log(
        "✅ Firestore profili bulundu:",
        {
          uid: user.uid,
          email: data.email,
          role: data.role,
          google: isGoogleUser,
        }
      );

      return {
        id: user.uid,
        uid: user.uid,

        email:
          typeof data.email === "string"
            ? data.email
            : user.email ?? "",

        name:
          typeof data.name === "string"
            ? data.name
            : user.displayName ?? "",

        phone:
          typeof data.phone === "string"
            ? data.phone
            : "",

        role:
          typeof data.role === "string"
            ? data.role
            : isAdminEmail(user.email)
              ? "admin"
              : "customer",

        photoURL:
          typeof data.photoURL === "string"
            ? data.photoURL
            : user.photoURL ?? "",

        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    }

    console.warn(
      "⚠️ Firestore kullanıcı profili bulunamadı. Oluşturuluyor."
    );

    const role = isAdminEmail(user.email)
      ? "admin"
      : "customer";

    const newProfile: UserProfile = {
      id: user.uid,
      uid: user.uid,
      email: user.email ?? "",
      name: user.displayName ?? "",
      phone: "",
      role,
      photoURL: user.photoURL ?? "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, newProfile);

    console.log(
      "✅ Eksik Firestore profili oluşturuldu:",
      {
        uid: user.uid,
        role,
        google: isGoogleUser,
      }
    );

    return {
      ...newProfile,
      createdAt: undefined,
      updatedAt: undefined,
    };
  } catch (error) {
    logDetailedError(
      "FIRESTORE PROFİL HATASI",
      error
    );

    throw error;
  }
}

/**
 * =========================================================
 * GOOGLE LOGIN
 * =========================================================
 */

export async function loginWithGoogle(): Promise<void> {
  logFirebaseConnection();

  console.log(
    "======================================"
  );

  console.log(
    "🚀 GOOGLE LOGIN BAŞLATILIYOR"
  );

  console.log(
    "======================================"
  );

  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  console.log(
    "🔵 GOOGLE PROVIDER OLUŞTURULDU"
  );

  console.log(
    "🔵 GOOGLE PROVIDER ID:",
    provider.providerId
  );

  console.log(
    "🔵 AUTH DOMAIN:",
    auth.app.options.authDomain
  );

  console.log(
    "🔵 PROJECT ID:",
    auth.app.options.projectId
  );

  console.log(
    "🔵 CURRENT ORIGIN:",
    window.location.origin
  );

  console.log(
    "🔵 CURRENT URL:",
    window.location.href
  );

  try {
    await setPersistence(
      auth,
      browserLocalPersistence
    );

    console.log(
      "✅ GOOGLE: persistence hazır"
    );

    console.log(
      "➡️ GOOGLE signInWithRedirect ÇAĞRILIYOR..."
    );

    await signInWithRedirect(
      auth,
      provider
    );

    console.log(
      "⚠️ BU SATIR NORMALDE ÇALIŞMAZ."
    );
  } catch (error) {
    logDetailedError(
      "GOOGLE REDIRECT BAŞLATMA HATASI",
      error
    );

    throw error;
  }
}

/**
 * =========================================================
 * GOOGLE REDIRECT RESULT
 * =========================================================
 */

export async function handleGoogleRedirectResult(): Promise<
  UserProfile | null
> {
  logFirebaseConnection();

  console.log(
    "======================================"
  );

  console.log(
    "🔎 GOOGLE REDIRECT RESULT KONTROLÜ"
  );

  console.log(
    "======================================"
  );

  console.log(
    "🌐 URL:",
    window.location.href
  );

  console.log(
    "🌐 ORIGIN:",
    window.location.origin
  );

  console.log(
    "🌐 AUTH DOMAIN:",
    auth.app.options.authDomain
  );

  console.log(
    "🌐 PROJECT:",
    auth.app.options.projectId
  );

  try {
    console.log(
      "⏳ getRedirectResult(auth) çağrılıyor..."
    );

    const result =
      await getRedirectResult(auth);

    console.log(
      "📦 getRedirectResult sonucu:",
      result
    );

    if (!result) {
      console.log(
        "ℹ️ GOOGLE REDIRECT RESULT YOK."
      );

      console.log(
        "ℹ️ Bu sayfa yüklemesinde Google redirect sonucu bulunmadı."
      );

      return null;
    }

    console.log(
      "🎉 GOOGLE REDIRECT RESULT BULUNDU!"
    );

    console.log(
      "👤 GOOGLE USER:",
      {
        uid: result.user.uid,
        email: result.user.email,
        displayName:
          result.user.displayName,
        emailVerified:
          result.user.emailVerified,
        photoURL:
          result.user.photoURL,
        providers:
          result.user.providerData.map(
            (provider) =>
              provider.providerId
          ),
      }
    );

    console.log(
      "🔐 GOOGLE CREDENTIAL:",
      result.credential
        ? "MEVCUT"
        : "YOK"
    );

    console.log(
      "🔐 OPERATION TYPE:",
      result.operationType
    );

    console.log(
      "👤 Firestore profili hazırlanıyor..."
    );

    const profile =
      await ensureUserProfile(
        result.user
      );

    console.log(
      "======================================"
    );

    console.log(
      "🎉 GOOGLE GİRİŞİ BAŞARILI"
    );

    console.log(
      "======================================"
    );

    console.log(
      "👤 PROFILE:",
      {
        id: profile.id,
        email: profile.email,
        role: profile.role,
      }
    );

    return profile;
  } catch (error) {
    console.error(
      "======================================"
    );

    console.error(
      "🚨 GOOGLE REDIRECT GERÇEK HATASI"
    );

    console.error(
      "======================================"
    );

    logDetailedError(
      "GOOGLE REDIRECT RESULT HATASI",
      error
    );

    console.error(
      "🔴 ERROR CODE:",
      getFirebaseErrorCode(error)
    );

    console.error(
      "🔴 ERROR MESSAGE:",
      getFirebaseErrorMessage(error)
    );

    console.error(
      "🔴 ERROR OBJECT:",
      error
    );

    throw error;
  }
}

/**
 * =========================================================
 * LOGOUT
 * =========================================================
 */

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);

    console.log(
      "🚪 Firebase logout başarılı."
    );
  } catch (error) {
    logDetailedError(
      "LOGOUT HATASI",
      error
    );

    throw error;
  }
}

/**
 * =========================================================
 * CURRENT USER
 * =========================================================
 */

export function getCurrentFirebaseUser(): User | null {
  return auth.currentUser;
}

/**
 * =========================================================
 * AUTH STATE
 * =========================================================
 */

export function subscribeToAuth(
  callback: (
    user: User | null
  ) => void
): () => void {
  console.log(
    "👂 Firebase Auth listener başlatılıyor..."
  );

  return onAuthStateChanged(
    auth,
    (user) => {
      console.log(
        "🔄 Firebase Auth state:",
        user?.email ?? "YOK",
        {
          uid: user?.uid ?? "YOK",

          emailVerified:
            user?.emailVerified ?? false,

          providers:
            user?.providerData?.map(
              (provider) =>
                provider.providerId
            ) ?? [],
        }
      );

      callback(user);
    },
    (error) => {
      logDetailedError(
        "AUTH STATE LISTENER HATASI",
        error
      );

      callback(null);
    }
  );
}

/**
 * =========================================================
 * ADMIN CHECK
 * =========================================================
 */

export function isAdminEmail(
  email: string | null | undefined
): boolean {
  return (
    String(email ?? "")
      .trim()
      .toLowerCase() ===
    ADMIN_EMAIL.toLowerCase()
  );
}
