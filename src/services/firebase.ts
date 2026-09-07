import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";
import {
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import {
  getStorage,
  type FirebaseStorage,
} from "firebase/storage";

import firebaseConfig from "../../firebase-applet-config.json";

/**
 * =========================================================
 * TRUSTLINE EXPRESS
 * Firebase V1 Configuration
 * =========================================================
 *
 * Bu dosyanın görevleri:
 *
 * 1. Firebase App başlatmak
 * 2. Firestore bağlantısını sağlamak
 * 3. Authentication bağlantısını sağlamak
 * 4. Firebase Storage bağlantısını sağlamak
 * 5. Mevcut storage.ts ile geriye dönük uyumluluğu korumak
 *
 * Gerçek kullanıcı login/register işlemleri:
 *
 *     src/services/auth.ts
 *
 * içerisinde yönetilecek.
 *
 * NOT:
 * Firebase Web config'in public olması tek başına
 * güvenlik problemi değildir.
 *
 * Asıl güvenlik:
 *
 *     Firebase Authentication
 *     +
 *     Firestore Rules
 *     +
 *     Storage Rules
 *
 * üzerinden sağlanacaktır.
 */

// =========================================================
// FIREBASE APP
// =========================================================

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

// =========================================================
// FIREBASE AUTH
// =========================================================

export const auth: Auth =
  getAuth(app);

// =========================================================
// FIRESTORE
// =========================================================

export const db: Firestore =
  getFirestore(app);

// =========================================================
// FIREBASE STORAGE
// =========================================================

export const storage: FirebaseStorage =
  getStorage(app);

// =========================================================
// AUTH STATE
// =========================================================

let authReadyPromise:
  | Promise<User | null>
  | null = null;

/**
 * Firebase Authentication'ın hazır olmasını bekler.
 *
 * Bu fonksiyon özellikle storage.ts tarafından
 * Firestore işlemlerinden önce kullanılmaktadır.
 */
export function waitForAuthState(): Promise<
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
        const unsubscribe =
          onAuthStateChanged(
            auth,
            (user) => {
              unsubscribe();

              resolve(user);
            }
          );
      }
    );

  return authReadyPromise;
}

// =========================================================
// ANONYMOUS AUTH — GEÇİŞ UYUMLULUĞU
// =========================================================

/**
 * Geçici olarak mevcut uygulamanın Firebase
 * bağlantısını koparmamak için anonymous auth
 * desteğini koruyoruz.
 *
 * V1'in sonraki aşamasında gerçek login/register
 * sistemi auth.ts üzerinden kullanılacak.
 *
 * Bu fonksiyon:
 *
 *     storage.ts
 *
 * tarafından çağrılmaktadır.
 */
export async function ensureFirebaseAuth(): Promise<
  User | null
> {
  if (auth.currentUser) {
    return auth.currentUser;
  }

  try {
    const currentUser =
      await waitForAuthState();

    if (currentUser) {
      return currentUser;
    }
  } catch (error) {
    console.warn(
      "Firebase auth state okunamadı:",
      error
    );
  }

  /**
   * Geçiş aşamasında anonymous authentication.
   *
   * Gerçek authentication sistemi devreye
   * girdiğinde auth.ts kullanılacak ve bu
   * fallback kaldırılacaktır.
   */
  try {
    const credential =
      await signInAnonymously(
        auth
      );

    return credential.user;
  } catch (error) {
    console.error(
      "Firebase anonymous authentication başarısız:",
      error
    );

    return null;
  }
}

// =========================================================
// AUTH HELPERS
// =========================================================

/**
 * Şu anda Firebase tarafından doğrulanmış
 * kullanıcıyı döndürür.
 */
export function getFirebaseUser(): User | null {
  return auth.currentUser;
}

/**
 * Kullanıcının Firebase'de oturum açıp
 * açmadığını kontrol eder.
 */
export function isFirebaseAuthenticated(): boolean {
  return !!auth.currentUser;
}

// =========================================================
// DEVELOPMENT / DEBUG
// =========================================================

/**
 * Firebase bağlantısının durumunu hızlıca
 * kontrol etmek için kullanılır.
 *
 * Production kullanıcı arayüzünde kullanılmaz.
 */
export function getFirebaseStatus() {
  return {
    appInitialized:
      getApps().length > 0,

    authenticated:
      !!auth.currentUser,

    userId:
      auth.currentUser?.uid ||
      null,

    hasFirestore:
      !!db,

    hasStorage:
      !!storage,
  };
}

// =========================================================
// EXPORT APP
// =========================================================

export { app };