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

export const ADMIN_EMAIL =
  "hamidocan0411@gmail.com";

const EXPECTED_PROJECT_ID =
  "trustline-8729d";

/**
 * =========================================================
 * FIREBASE DEBUG
 * =========================================================
 */

function logFirebaseConnection(): void {
  const projectId =
    auth.app.options.projectId;

  const authDomain =
    auth.app.options.authDomain;

  console.log(
    "🔥 FIREBASE AUTH BAĞLANTISI:",
    {
      projectId,
      authDomain,
      expectedProjectId:
        EXPECTED_PROJECT_ID,
      projectCorrect:
        projectId ===
        EXPECTED_PROJECT_ID,
    }
  );

  console.log(
    "🌐 CURRENT ORIGIN:",
    window.location.origin
  );

  console.log(
    "🌐 CURRENT URL:",
    window.location.href
  );

  if (
    projectId !==
    EXPECTED_PROJECT_ID
  ) {
    console.error(
      "🚨 KRİTİK: YANLIŞ FIREBASE PROJESİ!",
      {
        actualProjectId:
          projectId,
        expectedProjectId:
          EXPECTED_PROJECT_ID,
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

function getFirebaseErrorCode(
  error: unknown
): string {
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

function getFirebaseErrorMessage(
  error: unknown
): string {
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
  console.error(
    `❌ ${title}`,
    error
  );

  console.error(
    `❌ ${title} DETAY:`,
    {
      code:
        getFirebaseErrorCode(
          error
        ),

      message:
        getFirebaseErrorMessage(
          error
        ),

      name:
        typeof error ===
          "object" &&
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
        typeof error ===
          "object" &&
        error !== null &&
        "customData" in error
          ? (
              error as {
                customData?: unknown;
              }
            ).customData
          : undefined,

      email:
        typeof error ===
          "object" &&
        error !== null &&
        "email" in error
          ? (
              error as {
                email?: unknown;
              }
            ).email
          : undefined,

      credential:
        typeof error ===
          "object" &&
        error !== null &&
        "credential" in error
          ? "MEVCUT"
          : "YOK",

      projectId:
        auth.app.options
          .projectId,

      authDomain:
        auth.app.options
          .authDomain,

      origin:
        window.location.origin,

      url:
        window.location.href,
    }
  );
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

  const cleanEmail =
    String(email)
      .trim()
      .toLowerCase();

  const cleanName =
    String(name).trim();

  const cleanPhone =
    String(phone ?? "").trim();

  try {
    console.log(
      "📝 Yeni kullanıcı kaydı başlıyor:",
      {
        email: cleanEmail,
        projectId:
          auth.app.options
            .projectId,
      }
    );

    const credential =
      await createUserWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

    const user =
      credential.user;

    console.log(
      "✅ Firebase Authentication kullanıcı oluşturdu:",
      {
        uid: user.uid,
        email: user.email,
        emailVerified:
          user.emailVerified,
        provider:
          user.providerData.map(
            (provider) =>
              provider.providerId
          ),
      }
    );

    await updateProfile(
      user,
      {
        displayName:
          cleanName,
      }
    );

    try {
      await sendEmailVerification(
        user
      );

      console.log(
        "📧 E-posta doğrulama bağlantısı gönderildi."
      );
    } catch (
      verificationError
    ) {
      logDetailedError(
        "E-POSTA DOĞRULAMA HATASI",
        verificationError
      );

      await signOut(
        auth
      ).catch(
        () => undefined
      );

      throw verificationError;
    }

    await signOut(
      auth
    ).catch(
      () => undefined
    );

    const verificationError =
      new Error(
        "Kayıt başarılı. E-posta adresinize gönderilen doğrulama bağlantısına tıklayın."
      );

    (
      verificationError as Error & {
        code?: string;
      }
    ).code =
      "auth/email-verification-required";

    throw verificationError;
  } catch (error) {
    logDetailedError(
      "REGISTER HATASI",
      error
    );

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

  const cleanEmail =
    String(email)
      .trim()
      .toLowerCase();

  console.log(
    "🔐 LOGIN BAŞLIYOR:",
    {
      email: cleanEmail,
      projectId:
        auth.app.options
          .projectId,
      authDomain:
        auth.app.options
          .authDomain,
    }
  );

  try {
    await setPersistence(
      auth,
      browserLocalPersistence
    );

    const credential =
      await signInWithEmailAndPassword(
        auth,
        cleanEmail,
        password
      );

    const user =
      credential.user;

    console.log(
      "✅ FIREBASE AUTH GİRİŞ BAŞARILI:",
      {
        uid: user.uid,
        email: user.email,
        emailVerified:
          user.emailVerified,
        providers:
          user.providerData.map(
            (provider) =>
              provider.providerId
          ),
      }
    );

    const hasPasswordProvider =
      user.providerData.some(
        (provider) =>
          provider.providerId ===
          "password"
      );

    if (
      !hasPasswordProvider
    ) {
      await signOut(
        auth
      );

      const providerError =
        new Error(
          "Bu hesap email/şifre ile giriş için yapılandırılmamış."
        );

      (
        providerError as Error & {
          code?: string;
        }
      ).code =
        "auth/wrong-provider";

      throw providerError;
    }

    if (
      !user.emailVerified
    ) {
      await signOut(
        auth
      );

      const verificationError =
        new Error(
          "E-posta adresinizi doğrulamanız gerekiyor."
        );

      (
        verificationError as Error & {
          code?: string;
        }
      ).code =
        "auth/email-not-verified";

      throw verificationError;
    }

    return await ensureUserProfile(
      user
    );
  } catch (error) {
    logDetailedError(
      "LOGIN HATASI",
      error
    );

    throw error;
  }
}

/**
 * =========================================================
 * ENSURE USER PROFILE
 *
 * Firebase Auth kullanıcısı ile Trustline
 * Firestore kullanıcısını senkron tutar.
 * =========================================================
 */

export async function ensureUserProfile(
  user: User
): Promise<UserProfile> {
  if (!user?.uid) {
    throw new Error(
      "Geçersiz Firebase kullanıcı hesabı."
    );
  }

  const uid =
    user.uid;

  const email =
    user.email ?? "";

  const name =
    user.displayName?.trim() ||
    email.split("@")[0] ||
    "Trustline Kullanıcısı";

  const photoURL =
    user.photoURL ?? "";

  const isGoogleUser =
    user.providerData.some(
      (provider) =>
        provider.providerId ===
        "google.com"
    );

  console.log(
    "👤 TRUSTLINE PROFİL SENKRONİZASYONU:",
    {
      uid,
      email,
      name,
      google:
        isGoogleUser,
      path:
        `users/${uid}`,
    }
  );

  /**
   * Email/password kullanıcılarında
   * doğrulama zorunluluğunu koruyoruz.
   */
  if (
    !isGoogleUser &&
    !user.emailVerified
  ) {
    const verificationError =
      new Error(
        "E-posta adresinizi doğrulamanız gerekiyor."
      );

    (
      verificationError as Error & {
        code?: string;
      }
    ).code =
      "auth/email-not-verified";

    throw verificationError;
  }

  const userRef =
    doc(
      db,
      "users",
      uid
    );

  try {
    /**
     * -------------------------------------------------------
     * 1. MEVCUT FIRESTORE KAYDINI KONTROL ET
     * -------------------------------------------------------
     */

    const snapshot =
      await getDoc(
        userRef
      );

    if (
      snapshot.exists()
    ) {
      const data =
        snapshot.data();

      const existingRole =
        typeof data.role ===
        "string"
          ? data.role
          : null;

      const safeRole =
        existingRole ||
        (isAdminEmail(
          email
        )
          ? "admin"
          : "customer");

      /**
       * Mevcut kullanıcıyı bozma.
       * Sadece eksik temel alanları tamamla.
       */
      const updateData: Record<
        string,
        unknown
      > = {};

      if (
        typeof data.email !==
        "string" ||
        !data.email
      ) {
        updateData.email =
          email;
      }

      if (
        typeof data.name !==
          "string" ||
        !data.name.trim()
      ) {
        updateData.name =
          name;
      }

      if (
        typeof data.phone !==
        "string"
      ) {
        updateData.phone =
          "";
      }

      if (
        typeof data.role !==
        "string"
      ) {
        updateData.role =
          safeRole;
      }

      if (
        typeof data.photoURL !==
        "string"
      ) {
        updateData.photoURL =
          photoURL;
      }

      if (
        !data.uid
      ) {
        updateData.uid =
          uid;
      }

      if (
        !data.id
      ) {
        updateData.id =
          uid;
      }

      if (
        Object.keys(
          updateData
        ).length > 0
      ) {
        updateData.updatedAt =
          serverTimestamp();

        await setDoc(
          userRef,
          updateData,
          {
            merge: true,
          }
        );

        console.log(
          "🔧 Eksik kullanıcı alanları tamamlandı:",
          {
            uid,
            fields:
              Object.keys(
                updateData
              ),
          }
        );
      }

      /**
       * Güncel kaydı tekrar oku.
       */
      const refreshed =
        await getDoc(
          userRef
        );

      const finalData =
        refreshed.exists()
          ? refreshed.data()
          : data;

      console.log(
        "✅ EXISTING TRUSTLINE PROFİLİ HAZIR:",
        {
          uid,
          email:
            finalData.email,
          role:
            finalData.role,
        }
      );

      return {
        id: uid,
        uid,

        email:
          typeof finalData.email ===
          "string"
            ? finalData.email
            : email,

        name:
          typeof finalData.name ===
          "string"
            ? finalData.name
            : name,

        phone:
          typeof finalData.phone ===
          "string"
            ? finalData.phone
            : "",

        role:
          typeof finalData.role ===
          "string"
            ? finalData.role
            : isAdminEmail(email)
              ? "admin"
              : "customer",

        photoURL:
          typeof finalData.photoURL ===
          "string"
            ? finalData.photoURL
            : photoURL,

        createdAt:
          finalData.createdAt,

        updatedAt:
          finalData.updatedAt,
      };
    }

    /**
     * -------------------------------------------------------
     * 2. FIRESTORE KAYDI YOKSA YENİ TRUSTLINE KAYDI OLUŞTUR
     * -------------------------------------------------------
     */

    console.log(
      "🆕 YENİ TRUSTLINE KULLANICISI:",
      {
        uid,
        email,
        google:
          isGoogleUser,
      }
    );

    const role =
      isAdminEmail(email)
        ? "admin"
        : "customer";

    const newProfileData = {
      id: uid,
      uid,

      email,

      name,

      phone: "",

      role,

      photoURL,

      totalDeliveries: 0,

      rating: 5,

      createdAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    };

    console.log(
      "📝 Firestore users/%s oluşturuluyor...",
      uid
    );

    await setDoc(
      userRef,
      newProfileData,
      {
        merge: false,
      }
    );

    console.log(
      "✅ FIRESTORE YENİ KULLANICI KAYDI YAZILDI:",
      {
        uid,
        email,
        role,
        google:
          isGoogleUser,
      }
    );

    /**
     * -------------------------------------------------------
     * 3. KAYDIN GERÇEKTEN OLUŞTUĞUNU DOĞRULA
     * -------------------------------------------------------
     */

    const createdSnapshot =
      await getDoc(
        userRef
      );

    if (
      !createdSnapshot.exists()
    ) {
      const verifyError =
        new Error(
          `Firestore kullanıcı profili oluşturulduktan sonra doğrulanamadı: users/${uid}`
        );

      (
        verifyError as Error & {
          code?: string;
        }
      ).code =
        "trustline/profile-not-created";

      throw verifyError;
    }

    const createdData =
      createdSnapshot.data();

    console.log(
      "🎉 TRUSTLINE YENİ KAYIT DOĞRULANDI:",
      {
        uid,
        email:
          createdData.email,
        name:
          createdData.name,
        role:
          createdData.role,
      }
    );

    return {
      id: uid,
      uid,

      email:
        typeof createdData.email ===
        "string"
          ? createdData.email
          : email,

      name:
        typeof createdData.name ===
        "string"
          ? createdData.name
          : name,

      phone:
        typeof createdData.phone ===
        "string"
          ? createdData.phone
          : "",

      role:
        typeof createdData.role ===
        "string"
          ? createdData.role
          : role,

      photoURL:
        typeof createdData.photoURL ===
        "string"
          ? createdData.photoURL
          : photoURL,

      createdAt:
        createdData.createdAt,

      updatedAt:
        createdData.updatedAt,
    };
  } catch (error) {
    console.error(
      "❌❌❌ TRUSTLINE PROFİL OLUŞTURMA/OKUMA HATASI ❌❌❌"
    );

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

  const provider =
    new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt:
      "select_account",
  });

  provider.addScope(
    "profile"
  );

  provider.addScope(
    "email"
  );

  console.log(
    "🔵 GOOGLE PROVIDER OLUŞTURULDU"
  );

  console.log(
    "🔵 GOOGLE PROVIDER ID:",
    provider.providerId
  );

  console.log(
    "🔵 AUTH DOMAIN:",
    auth.app.options
      .authDomain
  );

  console.log(
    "🔵 PROJECT ID:",
    auth.app.options
      .projectId
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
    auth.app.options
      .authDomain
  );

  console.log(
    "🌐 PROJECT:",
    auth.app.options
      .projectId
  );

  try {
    console.log(
      "⏳ getRedirectResult(auth) çağrılıyor..."
    );

    const result =
      await getRedirectResult(
        auth
      );

    console.log(
      "📦 getRedirectResult sonucu:",
      result
    );

    if (!result) {
      console.log(
        "ℹ️ GOOGLE REDIRECT RESULT YOK."
      );

      return null;
    }

    console.log(
      "🎉 GOOGLE REDIRECT RESULT BULUNDU!"
    );

    const user =
      result.user;

    console.log(
      "👤 GOOGLE USER:",
      {
        uid: user.uid,
        email: user.email,
        displayName:
          user.displayName,
        emailVerified:
          user.emailVerified,
        photoURL:
          user.photoURL,
        providers:
          user.providerData.map(
            (provider) =>
              provider.providerId
          ),
      }
    );

    console.log(
      "👤 Trustline profili senkronize ediliyor..."
    );

    const profile =
      await ensureUserProfile(
        user
      );

    console.log(
      "======================================"
    );

    console.log(
      "🎉 GOOGLE GİRİŞİ / KAYDI BAŞARILI"
    );

    console.log(
      "======================================"
    );

    console.log(
      "👤 PROFILE:",
      {
        id: profile.id,
        email: profile.email,
        name: profile.name,
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
    await signOut(
      auth
    );

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

export function getCurrentFirebaseUser():
  User | null {
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
        user?.email ??
          "YOK",
        {
          uid:
            user?.uid ??
            "YOK",

          emailVerified:
            user?.emailVerified ??
            false,

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
  email:
    | string
    | null
    | undefined
): boolean {
  return (
    String(email ?? "")
      .trim()
      .toLowerCase() ===
    ADMIN_EMAIL.toLowerCase()
  );
}
