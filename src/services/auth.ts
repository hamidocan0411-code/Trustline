import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
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
} from "firebase/firestore";

import {
  auth,
  db,
} from "./firebase";

import type {
  UserProfile,
} from "../types";

/*
 * GOOGLE PROVIDER
 */
const googleProvider =
  new GoogleAuthProvider();

googleProvider.setCustomParameters({
  prompt: "select_account",
});

googleProvider.addScope(
  "https://www.googleapis.com/auth/userinfo.email"
);

googleProvider.addScope(
  "https://www.googleapis.com/auth/userinfo.profile"
);

/*
 * MOBİL TARAYICI TESPİTİ
 *
 * Bilgisayarda mevcut popup sistemi korunur.
 * Mobilde ise doğrudan redirect kullanılır.
 */
function isMobileBrowser(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const userAgent =
    navigator.userAgent ||
    navigator.vendor ||
    "";

  const mobilePattern =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i;

  return mobilePattern.test(
    userAgent
  );
}

/*
 * AUTH PERSISTENCE
 */
let persistencePromise:
  | Promise<void>
  | null = null;

async function ensurePersistence(): Promise<void> {
  if (!persistencePromise) {
    persistencePromise =
      setPersistence(
        auth,
        browserLocalPersistence
      ).catch((error) => {
        console.warn(
          "⚠️ Firebase Auth persistence ayarlanamadı:",
          error
        );
      });
  }

  await persistencePromise;
}

/*
 * FIREBASE USER -> TRUSTLINE PROFILE
 */
export async function ensureUserProfile(
  firebaseUser: User
): Promise<UserProfile> {
  const userRef =
    doc(
      db,
      "users",
      firebaseUser.uid
    );

  const snapshot =
    await getDoc(userRef);

  if (snapshot.exists()) {
    const data =
      snapshot.data() as Partial<UserProfile>;

    /*
     * Eski veya eksik kullanıcı belgelerinde telefon alanı
     * bulunmayabilir. Sipariş oluştururken Firestore `undefined`
     * kabul etmediği için profili her zaman güvenli bir metin
     * değeriyle döndürüyoruz.
     */
    const phone =
      typeof data.phone === "string"
        ? data.phone
        : "";

    return {
      ...(data as UserProfile),

      id:
        firebaseUser.uid,

      email:
        firebaseUser.email ??
        data.email ??
        "",

      name:
        firebaseUser.displayName ??
        data.name ??
        "TrustLine Kullanıcısı",

      phone,

      role:
        data.role ??
        "customer",
    };
  }

const now = new Date().toISOString();

const profile: UserProfile = {
  id: firebaseUser.uid,
  email: firebaseUser.email || "",
  name: firebaseUser.displayName || "",
  role: "customer",
  phone: "",
  createdAt: now,
};

  await setDoc(
  userRef,
  {
    ...profile,
    createdAt: profile.createdAt,
    updatedAt: now,
  },
  {
    merge: true,
  }
);

  console.log(
    "🆕 Yeni Firebase kullanıcı profili oluşturuldu:",
    profile
  );

  return profile;
}

/*
 * GOOGLE LOGIN
 *
 * BİLGİSAYAR:
 *   Popup kullanılır.
 *
 * MOBİL:
 *   Doğrudan redirect kullanılır.
 *
 * Böylece mobilde popup -> redirect arasında
 * oluşabilecek Auth state yarışını engelliyoruz.
 */
export async function loginWithGoogle(): Promise<
  UserProfile | null
> {
  await ensurePersistence();

  const mobile =
    isMobileBrowser();

  console.log(
    "🔐 Google giriş başlatılıyor..."
  );

  console.log(
    "🌐 Auth domain:",
    auth.app.options.authDomain
  );

  console.log(
    "📱 Mobil tarayıcı:",
    mobile
  );

  /*
   * MOBİL AKIŞ
   *
   * Mobilde popup denemiyoruz.
   * Direkt Google redirect başlatıyoruz.
   */
  if (mobile) {
    console.log(
      "📲 Mobil cihaz algılandı. Google redirect başlatılıyor..."
    );

    await signInWithRedirect(
      auth,
      googleProvider,
      browserPopupRedirectResolver
    );

    /*
     * Sayfa Firebase tarafından Google'a
     * yönlendirileceği için burada profile
     * beklemiyoruz.
     */
    return null;
  }

  /*
   * MASAÜSTÜ AKIŞ
   *
   * Mevcut çalışan bilgisayar akışına
   * dokunmuyoruz.
   */
  try {
    console.log(
      "🪟 Masaüstü Google popup başlatılıyor..."
    );

    const result =
      await signInWithPopup(
        auth,
        googleProvider,
        browserPopupRedirectResolver
      );

    const firebaseUser =
      result.user;

    console.log(
      "🟢 Google popup Firebase kullanıcısı:",
      {
        uid:
          firebaseUser.uid,

        email:
          firebaseUser.email,

        displayName:
          firebaseUser.displayName,
      }
    );

    const profile =
      await ensureUserProfile(
        firebaseUser
      );

    console.log(
      "✅ Google popup profil hazır:",
      {
        uid:
          profile.id,

        email:
          profile.email,

        role:
          profile.role,
      }
    );

    return profile;
  } catch (error) {
    const authError =
      error as {
        code?: string;
        message?: string;
      };

    console.error(
      "❌ Google popup hatası:",
      {
        code:
          authError?.code,

        message:
          authError?.message,

        error,
      }
    );

    const redirectCodes = [
      "auth/popup-blocked",
      "auth/operation-not-supported-in-this-environment",
      "auth/web-storage-unsupported",
    ];

    if (
      !authError?.code ||
      !redirectCodes.includes(
        authError.code
      )
    ) {
      throw error;
    }

    console.log(
      "📲 Popup kullanılamadı. Google redirect başlatılıyor..."
    );

    await signInWithRedirect(
      auth,
      googleProvider,
      browserPopupRedirectResolver
    );

    return null;
  }
}

/*
 * GOOGLE REDIRECT RESULT
 *
 * Mobil Google girişinden sonra uygulama
 * tekrar açıldığında burası çalışır.
 */
let redirectResultPromise:
  | Promise<UserProfile | null>
  | null = null;

export function handleGoogleRedirectResult(): Promise<
  UserProfile | null
> {
  if (redirectResultPromise) {
    return redirectResultPromise;
  }

  redirectResultPromise =
    (async () => {
      try {
        console.log(
          "🔎 Google redirect sonucu kontrol ediliyor..."
        );

        await ensurePersistence();

        const result =
          await getRedirectResult(
            auth,
            browserPopupRedirectResolver
          );

        /*
         * Google redirect sonucu doğrudan geldiyse
         */
        if (result) {
          const firebaseUser =
            result.user;

          console.log(
            "🟢 Google redirect Firebase kullanıcısı bulundu:",
            {
              uid:
                firebaseUser.uid,

              email:
                firebaseUser.email,

              displayName:
                firebaseUser.displayName,
            }
          );

          const profile =
            await ensureUserProfile(
              firebaseUser
            );

          console.log(
            "✅ Google redirect profil hazır:",
            {
              uid:
                profile.id,

              email:
                profile.email,

              role:
                profile.role,
            }
          );

          return profile;
        }

        /*
         * Redirect sonucu null olsa bile Firebase
         * kullanıcısı hazır olmuş olabilir.
         */
        if (auth.currentUser) {
          console.log(
            "🟢 Redirect sonucu null fakat Firebase kullanıcısı mevcut."
          );

          return await ensureUserProfile(
            auth.currentUser
          );
        }

        console.log(
          "ℹ️ Google redirect sonucu yok."
        );

        return null;
      } catch (error) {
        console.error(
          "❌ Google redirect sonucu alınamadı:",
          error
        );

        redirectResultPromise =
          null;

        throw error;
      }
    })();

  return redirectResultPromise;
}

/*
 * EMAIL REGISTER
 */
export async function registerWithEmail(
  email: string,
  password: string,
  name: string
): Promise<UserProfile> {
  await ensurePersistence();

  const credential =
    await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

  const firebaseUser =
    credential.user;

  if (name.trim()) {
    await updateProfile(
      firebaseUser,
      {
        displayName:
          name.trim(),
      }
    );
  }

  try {
    await sendEmailVerification(
      firebaseUser
    );
  } catch (error) {
    console.warn(
      "⚠️ E-posta doğrulama gönderilemedi:",
      error
    );
  }

  return await ensureUserProfile(
    firebaseUser
  );
}

/*
 * EMAIL LOGIN
 */
export async function loginWithEmail(
  email: string,
  password: string
): Promise<UserProfile> {
  await ensurePersistence();

  const credential =
    await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

  const firebaseUser =
    credential.user;

  if (
    !firebaseUser.emailVerified
  ) {
    const error =
      new Error(
        "E-posta adresiniz doğrulanmamış."
      ) as Error & {
        code?: string;
      };

    error.code =
      "auth/email-not-verified";

    throw error;
  }

  return await ensureUserProfile(
    firebaseUser
  );
}

/*
 * AUTH STATE
 */
export function subscribeToAuth(
  callback: (
    user: User | null
  ) => void
): () => void {
  return onAuthStateChanged(
    auth,
    (user) => {
      console.log(
        "🔄 Firebase Auth state:",
        user?.email ?? "YOK"
      );

      callback(user);
    },
    (error) => {
      console.error(
        "❌ Firebase Auth listener hatası:",
        error
      );

      callback(null);
    }
  );
}

/*
 * FIREBASE USER WAIT
 */
let authReadyPromise:
  | Promise<User | null>
  | null = null;

export function waitForFirebaseUser(): Promise<
  User | null
> {
  if (auth.currentUser) {
    return Promise.resolve(
      auth.currentUser
    );
  }

  if (authReadyPromise) {
    return authReadyPromise;
  }

  authReadyPromise =
    new Promise<User | null>(
      (resolve) => {
        let unsubscribe:
          | (() => void)
          | null = null;

        unsubscribe =
          onAuthStateChanged(
            auth,
            (user) => {
              if (unsubscribe) {
                unsubscribe();

                unsubscribe =
                  null;
              }

              resolve(user);
            },
            () => {
              if (unsubscribe) {
                unsubscribe();

                unsubscribe =
                  null;
              }

              resolve(null);
            }
          );
      }
    );

  return authReadyPromise;
}

/*
 * LOGOUT
 */
export async function logout(): Promise<void> {
  console.log(
    "🔒 Firebase logout başlatılıyor..."
  );

  await signOut(auth);

  console.log(
    "✅ Firebase logout tamamlandı."
  );
}

export async function logoutUser(): Promise<void> {
  await logout();
}

export function getCurrentFirebaseUser(): User | null {
  return auth.currentUser;
}
