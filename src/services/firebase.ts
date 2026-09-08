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

/**
 * Firebase App
 *
 * Uygulama daha önce başlatılmışsa mevcut instance kullanılır.
 * Böylece Vite/React geliştirme ortamında duplicate app hatası oluşmaz.
 */
const app =
  getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig);

/**
 * Firebase Authentication
 */
export const auth: Auth = getAuth(app);

/**
 * Firebase Firestore
 */
export const db: Firestore = getFirestore(app);

/**
 * Auth durumunun ilk kez belirlenmesini beklemek için
 * tek bir Promise kullanıyoruz.
 *
 * Böylece birden fazla component aynı anda çağırsa bile
 * birden fazla listener oluşturulmaz.
 */
let authReadyPromise: Promise<User | null> | null = null;

export function waitForAuthState(): Promise<User | null> {
  /**
   * Firebase zaten kullanıcıyı biliyorsa beklemeye gerek yok.
   */
  if (auth.currentUser) {
    return Promise.resolve(auth.currentUser);
  }

  /**
   * Daha önce başlatılmış bir bekleme varsa onu kullan.
   */
  if (authReadyPromise) {
    return authReadyPromise;
  }

  /**
   * Firebase Auth'un ilk durumunu bekle.
   */
  authReadyPromise = new Promise<User | null>((resolve) => {
    let resolved = false;

    const finish = (user: User | null) => {
      if (resolved) return;

      resolved = true;
      unsubscribe();
      resolve(user);
    };

    const unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        finish(user);
      },
      () => {
        /**
         * Auth durumunda hata oluşursa uygulamanın
         * sonsuza kadar "bağlanıyor" ekranında kalmasını önle.
         */
        finish(null);
      }
    );
  });

  return authReadyPromise;
}

/**
 * Firebase'deki mevcut kullanıcıyı döndürür.
 */
export function getFirebaseUser(): User | null {
  return auth.currentUser;
}

/**
 * Kullanıcı Firebase'e giriş yapmış mı?
 */
export function isFirebaseAuthenticated(): boolean {
  return !!auth.currentUser;
}

/**
 * Firebase bağlantı / Auth durumunu kontrol etmek için
 * yardımcı bilgi döndürür.
 */
export function getFirebaseStatus() {
  return {
    appInitialized: getApps().length > 0,
    authenticated: !!auth.currentUser,
    userId: auth.currentUser?.uid || null,
    hasFirestore: !!db,
  };
}

export { app };