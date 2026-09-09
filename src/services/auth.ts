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

function logFirebaseConnection() {
  const projectId = auth.app.options.projectId;
  const authDomain = auth.app.options.authDomain;

  console.log("🔥 FIREBASE AUTH BAĞLANTISI:", {
    projectId,
    authDomain,
    expectedProjectId: EXPECTED_PROJECT_ID,
    projectCorrect: projectId === EXPECTED_PROJECT_ID,
  });

  if (projectId !== EXPECTED_PROJECT_ID) {
    console.error(
      "🚨 KRİTİK: Uygulama yanlış Firebase projesine bağlanıyor!",
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
      (error as { code?: unknown }).code ?? "unknown"
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
      (error as { message?: unknown }).message ?? error
    );
  }

  return String(error);
}

/**
 * =========================================================
 * REGISTER
 * =========================================================
 *
 * ÖNEMLİ:
 *
 * Firebase Authentication hesabı kayıt sırasında oluşturulur.
 * Ancak kullanıcı e-postasını doğrulamadan Firestore profili
 * oluşturulmaz.
 *
 * Doğrulama maili gönderilir ve oturum kapatılır.
 */

export async function registerUser(
  email: string,
  password: string,
  name: string,
  phone?: string
): Promise<UserProfile> {
  logFirebaseConnection();

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanName = String(name).trim();
  const cleanPhone = String(phone ?? "").trim();

  try {
    console.log("📝 Yeni kullanıcı kaydı başlıyor:", {
      email: cleanEmail,
      projectId: auth.app.options.projectId,
    });

    const credential = await createUserWithEmailAndPassword(
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

    /**
     * Kullanıcı adını Firebase Auth profilinde tut.
     */
    await updateProfile(user, {
      displayName: cleanName,
    });

    /**
     * =====================================================
     * DOĞRULAMA MAİLİ
     * =====================================================
     */

    try {
      await sendEmailVerification(user);

      console.log(
        "📧 E-posta doğrulama bağlantısı gönderildi."
      );
    } catch (verificationError) {
      console.error(
        "❌ E-posta doğrulama maili gönderilemedi:",
        verificationError
      );

      await signOut(auth);

      throw verificationError;
    }

    /**
     * =====================================================
     * ÖNEMLİ
     * =====================================================
     *
     * Burada Firestore profili OLUŞTURMUYORUZ.
     *
     * Kullanıcı mailini doğruladıktan sonra ilk başarılı
     * girişte ensureUserProfile() profili oluşturacak.
     */

    console.log(
      "⏳ Kullanıcı e-posta doğrulamasını bekliyor."
    );

    await signOut(auth);

    console.log(
      "🚪 Kayıt sonrası kullanıcı oturumu kapatıldı."
    );

    const verificationError = new Error(
      "Kayıt başarılı. E-posta adresinize gönderilen doğrulama bağlantısına tıklayın."
    );

    (
      verificationError as Error & {
        code?: string;
      }
    ).code = "auth/email-verification-required";

    /**
     * Kullanıcı profilini henüz oluşturmuyoruz.
     */
    return Promise.reject(verificationError);
  } catch (error) {
    const code = getFirebaseErrorCode(error);
    const message = getFirebaseErrorMessage(error);

    console.error("❌ REGISTER HATASI:", {
      code,
      message,
      projectId: auth.app.options.projectId,
      authDomain: auth.app.options.authDomain,
    });

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

  const cleanEmail = String(email).trim().toLowerCase();

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

    /**
     * Email / Password giriş
     */
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

    /**
     * =====================================================
     * PASSWORD PROVIDER
     * =====================================================
     */

    const hasPasswordProvider =
      user.providerData.some(
        (provider) =>
          provider.providerId === "password"
      );

    if (!hasPasswordProvider) {
      console.error(
        "🚨 Kullanıcıda password provider görünmüyor:",
        user.providerData
      );

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

    /**
     * =====================================================
     * EMAIL VERIFICATION
     * =====================================================
     */

    if (!user.emailVerified) {
      console.warn(
        "⚠️ Kullanıcının e-posta adresi doğrulanmamış."
      );

      await signOut(auth);

      const verificationError = new Error(
        "E-posta adresinizi doğrulamanız gerekiyor. E-posta kutunuzu kontrol edin ve doğrulama bağlantısına tıklayın."
      );

      (
        verificationError as Error & {
          code?: string;
        }
      ).code = "auth/email-not-verified";

      throw verificationError;
    }

    /**
     * =====================================================
     * FIRESTORE PROFILE
     * =====================================================
     *
     * Buraya sadece doğrulanmış kullanıcı gelir.
     */

    const profile = await ensureUserProfile(user);

    console.log("✅ LOGIN TAMAMLANDI:", {
      uid: profile.id,
      email: profile.email,
      role: profile.role,
    });

    return profile;
  } catch (error) {
    const code = getFirebaseErrorCode(error);
    const message = getFirebaseErrorMessage(error);

    console.error("❌ LOGIN HATASI:", {
      code,
      message,
      email: cleanEmail,
      projectId: auth.app.options.projectId,
      authDomain: auth.app.options.authDomain,
    });

    /**
     * =====================================================
     * INVALID CREDENTIAL
     * =====================================================
     */

    if (code === "auth/invalid-credential") {
      const projectId =
        auth.app.options.projectId ?? "BİLİNMİYOR";

      const authDomain =
        auth.app.options.authDomain ?? "BİLİNMİYOR";

      console.error(
        "🚨🚨🚨 INVALID CREDENTIAL TEŞHİS 🚨🚨🚨",
        {
          projectId,
          authDomain,
          expectedProjectId: EXPECTED_PROJECT_ID,
          projectCorrect:
            projectId === EXPECTED_PROJECT_ID,
          email: cleanEmail,
        }
      );

      const diagnosticError = new Error(
        `Firebase giriş bilgilerini kabul etmedi. ` +
          `Bağlı proje: ${projectId}. ` +
          `Auth Domain: ${authDomain}.`
      );

      (
        diagnosticError as Error & {
          code?: string;
          firebaseProjectId?: string;
          firebaseAuthDomain?: string;
        }
      ).code = "auth/invalid-credential";

      (
        diagnosticError as Error & {
          firebaseProjectId?: string;
        }
      ).firebaseProjectId = projectId;

      (
        diagnosticError as Error & {
          firebaseAuthDomain?: string;
        }
      ).firebaseAuthDomain = authDomain;

      throw diagnosticError;
    }

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
  console.log("👤 Firestore profil kontrolü:", {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    path: `users/${user.uid}`,
  });

  /**
   * =====================================================
   * EN ÖNEMLİ KONTROL
   * =====================================================
   *
   * Doğrulanmamış kullanıcı Firestore'a hiç dokunamaz.
   */

  if (!user.emailVerified) {
    console.warn(
      "⚠️ Firestore profil işlemi engellendi: e-posta doğrulanmamış."
    );

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

    /**
     * =====================================================
     * PROFİL YOKSA OLUŞTUR
     * =====================================================
     */

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

    await setDoc(
      userRef,
      newProfile
    );

    console.log(
      "✅ Eksik Firestore profili oluşturuldu:",
      {
        uid: user.uid,
        role,
      }
    );

    return {
      ...newProfile,
      createdAt: undefined,
      updatedAt: undefined,
    };
  } catch (error) {
    console.error(
      "❌ FIRESTORE PROFİL HATASI:",
      {
        uid: user.uid,
        path: `users/${user.uid}`,
        code: getFirebaseErrorCode(error),
        message: getFirebaseErrorMessage(error),
      }
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

  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  try {
    await setPersistence(
      auth,
      browserLocalPersistence
    );

    if (
      typeof window !== "undefined" &&
      /iPhone|iPad|iPod|Android/i.test(
        window.navigator.userAgent
      )
    ) {
      console.log(
        "📱 Mobil cihaz algılandı. Google redirect başlıyor."
      );

      await signInWithRedirect(
        auth,
        provider
      );

      return;
    }

    console.log(
      "🖥️ Masaüstü cihaz. Google popup başlıyor."
    );

    await signInWithPopup(
      auth,
      provider
    );
  } catch (error) {
    console.error(
      "❌ GOOGLE LOGIN HATASI:",
      {
        code: getFirebaseErrorCode(error),
        message: getFirebaseErrorMessage(error),
        projectId: auth.app.options.projectId,
        authDomain: auth.app.options.authDomain,
      }
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

  try {
    const result =
      await getRedirectResult(auth);

    if (!result) {
      return null;
    }

    console.log(
      "✅ Google redirect sonucu alındı:",
      {
        uid: result.user.uid,
        email: result.user.email,
        emailVerified:
          result.user.emailVerified,
      }
    );

    const profile =
      await ensureUserProfile(
        result.user
      );

    return profile;
  } catch (error) {
    console.error(
      "❌ GOOGLE REDIRECT RESULT HATASI:",
      {
        code: getFirebaseErrorCode(error),
        message: getFirebaseErrorMessage(error),
        projectId: auth.app.options.projectId,
        authDomain: auth.app.options.authDomain,
      }
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
    console.error(
      "❌ LOGOUT HATASI:",
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
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(
    auth,
    (user) => {
      console.log(
        "🔄 Firebase Auth state:",
        user?.email ?? "YOK",
        {
          emailVerified:
            user?.emailVerified ?? false,
        }
      );

      callback(user);
    },
    (error) => {
      console.error(
        "❌ Auth state listener hatası:",
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