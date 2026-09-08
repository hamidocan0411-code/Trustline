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
 * Vite Hot Reload / React Strict Mode nedeniyle uygulama
 * birden fazla kez initialize edilmesin.
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
 * Firebase Auth ilk kullanıcı durumunu async olarak yükler.
 *
 * Bu Promise uygulama genelinde TEK bir kez oluşturulur.
 * Böylece Storage, App ve diğer componentler farklı farklı
 * Auth listener oluşturmaz.
 */
let authReadyPromise: Promise<User | null> | null =
  null;

/**
 * Firebase Auth ilk state yüklenmesini bekler.
 */
export function waitForAuthState(): Promise<User | null> {
  if (authReadyPromise) {
    return authReadyPromise;
  }

  authReadyPromise =
    new Promise<User | null>((resolve) => {
      let resolved = false;

      let unsubscribe:
        | (() => void)
        | null = null;

      const finish = (
        user: User | null
      ) => {
        if (resolved) {
          return;
        }

        resolved = true;

        resolve(user);

        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
      };

      unsubscribe = onAuthStateChanged(
        auth,
        (user) => {
          finish(user);
        },
        (error) => {
          console.error(
            "Firebase Auth initial state hatası:",
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
 * Uygulama genelinde güvenli Auth listener kullanımı.
 *
 * StorageService bunu kullanarak login/logout değişimlerini
 * otomatik takip eder.
 */
export function subscribeToAuthState(
  callback: (user: User | null) => void
): () => void {
  return onAuthStateChanged(
    auth,
    callback,
    (error) => {
      console.error(
        "Firebase Auth listener hatası:",
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

export function getFirebaseUser():
  | User
  | null {
  return auth.currentUser;
}

export function isFirebaseAuthenticated(): boolean {
  return !!auth.currentUser;
}

export function getFirebaseStatus() {
  return {
    appInitialized:
      getApps().length > 0,

    authenticated:
      !!auth.currentUser,

    userId:
      auth.currentUser?.uid || null,

    email:
      auth.currentUser?.email || null,

    hasFirestore:
      !!db,
  };
}

export { app };