import {
  getApp,
  getApps,
  initializeApp,
  type FirebaseApp,
} from "firebase/app";

import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  type Auth,
  type User,
} from "firebase/auth";

import {
  getFirestore,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

/*
 * Firebase Auth'u manuel başlatıyoruz.
 *
 * Önemli:
 * browserPopupRedirectResolver'ı burada vermiyoruz.
 *
 * Böylece uygulama açılırken Firebase'in popup/redirect
 * altyapısı gereksiz yere yüklenmiyor.
 *
 * Google girişinde gerektiği zaman auth.ts içinden
 * resolver kullanılacak.
 */
export const auth: Auth =
  initializeAuth(app, {
    persistence: [
      indexedDBLocalPersistence,
      browserLocalPersistence,
    ],
  });

export const db: Firestore =
  getFirestore(app);

let authReadyPromise:
  | Promise<User | null>
  | null = null;

/*
 * Firebase'in ilk Auth durumunu bekle.
 */
export function waitForAuthState(): Promise<User | null> {
  if (authReadyPromise) {
    return authReadyPromise;
  }

  authReadyPromise =
    new Promise<User | null>(
      (resolve) => {
        let finished = false;

        let unsubscribe:
          | (() => void)
          | null = null;

        const finish = (
          user: User | null
        ) => {
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

        unsubscribe =
          auth.onAuthStateChanged(
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
      }
    );

  return authReadyPromise;
}

/*
 * Auth state listener.
 */
export function subscribeToAuthState(
  callback: (
    user: User | null
  ) => void
): () => void {
  return auth.onAuthStateChanged(
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

/*
 * Mevcut Firebase kullanıcısı.
 */
export function getFirebaseUser(): User | null {
  return auth.currentUser;
}

/*
 * Firebase Auth durumu.
 */
export function isFirebaseAuthenticated(): boolean {
  return !!auth.currentUser;
}

/*
 * Firebase durum bilgisi.
 */
export function getFirebaseStatus() {
  const user =
    auth.currentUser;

  return {
    appInitialized:
      getApps().length > 0,

    authenticated:
      !!user,

    userId:
      user?.uid ?? null,

    email:
      user?.email ?? null,

    hasFirestore:
      !!db,

    projectId:
      firebaseConfig.projectId,

    authDomain:
      firebaseConfig.authDomain,
  };
}

export { app };
