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

import firebaseConfig from "../firebase-applet-config.json";

/**
 * =========================================================
 * FIREBASE APP
 * =========================================================
 *
 * Firebase uygulamasının yalnızca bir kez başlatılmasını
 * sağlar.
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
 * Firebase'in mevcut oturumu yüklemesini bekler.
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

export function getFirebaseUser(): User | null {
  return auth.currentUser;
}

export function isFirebaseAuthenticated(): boolean {
  return !!auth.currentUser;
}

/**
 * Firebase bağlantı durumunu kontrol etmek için.
 */
export function getFirebaseStatus() {
  const user = auth.currentUser;

  return {
    appInitialized: getApps().length > 0,
    authenticated: !!user,
    userId: user?.uid ?? null,
    email: user?.email ?? null,
    hasFirestore: !!db,

    /**
     * Hangi Firebase projesine bağlandığımızı
     * konsolda doğrulamayı kolaylaştırır.
     */
    projectId: firebaseConfig.projectId,
    authDomain: firebaseConfig.authDomain,
  };
}

/**
 * Firebase App instance
 */
export { app };