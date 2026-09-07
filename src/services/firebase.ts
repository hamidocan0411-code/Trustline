import {
  initializeApp,
  getApps,
  getApp,
} from "firebase/app";

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

const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

/* ================================
   FIREBASE AUTH
================================ */

export const auth: Auth =
  getAuth(app);

/* ================================
   FIRESTORE
   Named database varsa onu kullanır.
   Yoksa default database kullanılır.
================================ */

export const db: Firestore =
  firebaseConfig.firestoreDatabaseId
    ? getFirestore(
        app,
        firebaseConfig.firestoreDatabaseId
      )
    : getFirestore(app);

/* ================================
   FIREBASE STORAGE
================================ */

export const storage: FirebaseStorage =
  getStorage(app);

/* ================================
   AUTH STATE
================================ */

let authReadyPromise:
  | Promise<User | null>
  | null = null;

export function waitForAuthState(): Promise<User | null> {
  if (auth.currentUser) {
    return Promise.resolve(
      auth.currentUser
    );
  }

  if (authReadyPromise) {
    return authReadyPromise;
  }

  authReadyPromise =
    new Promise<User | null>((resolve) => {
      const unsubscribe =
        onAuthStateChanged(
          auth,
          (user) => {
            unsubscribe();
            resolve(user);
          }
        );
    });

  return authReadyPromise;
}

/* ================================
   AUTH
   Geçiş sürecinde anonymous auth
   desteğini koruyoruz.
================================ */

export async function ensureFirebaseAuth(): Promise<User | null> {
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

  try {
    const credential =
      await signInAnonymously(auth);

    return credential.user;
  } catch (error) {
    console.error(
      "Firebase anonymous authentication başarısız:",
      error
    );

    return null;
  }
}

/* ================================
   CURRENT USER
================================ */

export function getFirebaseUser(): User | null {
  return auth.currentUser;
}

export function isFirebaseAuthenticated(): boolean {
  return !!auth.currentUser;
}

/* ================================
   FIREBASE STATUS
================================ */

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

/* ================================
   APP EXPORT
================================ */

export { app };