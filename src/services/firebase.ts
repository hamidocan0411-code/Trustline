import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from "firebase/app";

import {
  getAuth,
  onAuthStateChanged,
  type Auth,
  type User,
} from "firebase/auth";

import {
  getFirestore,
  type Firestore,
} from "firebase/firestore";

import firebaseConfig from "../../firebase-applet-config.json";

/**
 * =========================================================
 * FIREBASE APP
 * =========================================================
 *
 * Vite Hot Reload / React Strict Mode nedeniyle Firebase
 * uygulaması birden fazla kez initialize edilmesin.
 */
const app: FirebaseApp =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

/**
 * =========================================================
 * FIREBASE AUTH
 * =========================================================
 */
export const auth: Auth = getAuth(app);

/**
 * =========================================================
 * FIRESTORE
 * =========================================================
 */
export const db: Firestore = getFirestore(app);

/**
 * =========================================================
 * AUTH READY STATE
 * =========================================================
 *
 * Firebase Auth, mevcut oturumu ilk açılışta async olarak
 * yükler.
 *
 * Uygulamanın farklı bölümlerinin bu işlemi ayrı ayrı
 * beklemesini önlemek için tek Promise kullanıyoruz.
 */
let authReadyPromise: Promise<User | null> | null = null;

export function waitForAuthState(): Promise<User | null> {
  if (authReadyPromise) {
    return authReadyPromise;
  }

  authReadyPromise = new Promise<User | null>((resolve) => {
    let finished = false;
    let unsubscribe: (() => void) | null = null;

    const finish = (user: User | null) => {
      if (finished) {
        return;
      }

      finished = true;

      resolve(user);

      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };

    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        console.log(
          "🔥 Firebase ilk Auth durumu:",
          user?.email ?? "YOK"
        );

        finish(user);
      },
      (error) => {
        console.error(
          "❌ Firebase Auth initial state hatası:",
          error
        );

        finish(null);
      }
    );
  });

  return authReadyPromise;
}

/**
 * =========================================================
 * AUTH STATE SUBSCRIPTION
 * =========================================================
 *
 * Login / logout / Google redirect sonrasında Firebase Auth
 * state değişikliklerini takip eder.
 *
 * Bu listener özellikle Google OAuth dönüşünde önemlidir:
 * Google hesabı başarıyla oluşturulduktan sonra Firebase
 * currentUser durumunu burada yakalarız.
 */
export function subscribeToAuthState(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(
    auth,
    (user) => {
      console.log(
        "🔄 Firebase Auth state değişti:",
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

/**
 * =========================================================
 * HELPERS
 * =========================================================
 */

/**
 * Firebase'deki mevcut kullanıcıyı döndürür.
 */
export function getFirebaseUser(): User | null {
  return auth.currentUser;
}

/**
 * Firebase'de aktif kullanıcı var mı?
 */
export function isFirebaseAuthenticated(): boolean {
  return !!auth.currentUser;
}

/**
 * Firebase bağlantı / Auth durumunu kontrol etmek için
 * yardımcı bilgi.
 */
export function getFirebaseStatus() {
  const user = auth.currentUser;

  return {
    appInitialized: getApps().length > 0,

    authenticated: !!user,

    userId: user?.uid ?? null,

    email: user?.email ?? null,

    hasFirestore: !!db,
  };
}

/**
 * Firebase App instance
 */
export { app };