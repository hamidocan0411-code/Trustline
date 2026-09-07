import {
  initializeApp,
  getApps,
  getApp,
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
const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);
export const auth: Auth =
  getAuth(app);
export const db: Firestore =
  getFirestore(app);
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
export function getFirebaseUser(): User | null {
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
    hasFirestore:
      !!db,
  };
}
export { app };