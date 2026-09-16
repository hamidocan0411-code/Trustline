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

import { doc, getDoc, setDoc } from "firebase/firestore";

import { auth, db } from "./firebase";

import type { UserProfile } from "../types";

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.email");
googleProvider.addScope("https://www.googleapis.com/auth/userinfo.profile");

function isMobileBrowser(): boolean {
  if (typeof window === "undefined") return false;
  const userAgent = navigator.userAgent || navigator.vendor || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(userAgent);
}

let persistencePromise: Promise<void> | null = null;
async function ensurePersistence(): Promise<void> {
  if (!persistencePromise) {
    persistencePromise = setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn("⚠️ Firebase Auth persistence ayarlanamadı:", error);
    });
  }
  await persistencePromise;
}

export async function ensureUserProfile(firebaseUser: User): Promise<UserProfile> {
  const userRef = doc(db, "users", firebaseUser.uid);
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    const data = snapshot.data() as Partial<UserProfile>;
    return {
      ...(data as UserProfile),
      id: firebaseUser.uid,
      email: firebaseUser.email ?? data.email ?? "",
      name: firebaseUser.displayName ?? data.name ?? "TrustLine Kullanıcısı",
      phone: typeof data.phone === "string" ? data.phone : "",
      role: data.role ?? "customer",
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

  await setDoc(userRef, { ...profile, createdAt: profile.createdAt, updatedAt: now }, { merge: true });
  return profile;
}

export async function loginWithGoogle(): Promise<UserProfile | null> {
  await ensurePersistence();

  if (isMobileBrowser()) {
    await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
    return null;
  }

  try {
    const result = await signInWithPopup(auth, googleProvider, browserPopupRedirectResolver);
    return await ensureUserProfile(result.user);
  } catch (error) {
    const authError = error as { code?: string };
    const redirectCodes = [
      "auth/popup-blocked",
      "auth/operation-not-supported-in-this-environment",
      "auth/web-storage-unsupported",
    ];

    if (!authError?.code || !redirectCodes.includes(authError.code)) throw error;

    await signInWithRedirect(auth, googleProvider, browserPopupRedirectResolver);
    return null;
  }
}

let redirectResultPromise: Promise<UserProfile | null> | null = null;

/**
 * Google redirect kontrolü yalnızca login akışının gerçekten redirect başlattığını
 * gösteren sessionStorage işareti varsa çalıştırılır. Normal ziyaretçide Firebase
 * getRedirectResult çağrısı yapılmaz; bu ilk açılışta gereksiz Auth/redirect işini azaltır.
 */
const GOOGLE_REDIRECT_FLAG = "trustline:google-redirect";

export function handleGoogleRedirectResult(): Promise<UserProfile | null> {
  if (redirectResultPromise) return redirectResultPromise;

  const shouldCheckRedirect =
    typeof window !== "undefined" &&
    window.sessionStorage.getItem(GOOGLE_REDIRECT_FLAG) === "1";

  if (!shouldCheckRedirect) return Promise.resolve(null);

  window.sessionStorage.removeItem(GOOGLE_REDIRECT_FLAG);

  redirectResultPromise = (async () => {
    try {
      await ensurePersistence();
      const result = await getRedirectResult(auth, browserPopupRedirectResolver);
      if (result) return await ensureUserProfile(result.user);
      if (auth.currentUser) return await ensureUserProfile(auth.currentUser);
      return null;
    } catch (error) {
      redirectResultPromise = null;
      throw error;
    }
  })();

  return redirectResultPromise;
}

export async function registerWithEmail(email: string, password: string, name: string): Promise<UserProfile> {
  await ensurePersistence();
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const firebaseUser = credential.user;

  if (name.trim()) await updateProfile(firebaseUser, { displayName: name.trim() });

  try {
    await sendEmailVerification(firebaseUser);
  } catch (error) {
    console.warn("⚠️ E-posta doğrulama gönderilemedi:", error);
  }

  return await ensureUserProfile(firebaseUser);
}

export async function loginWithEmail(email: string, password: string): Promise<UserProfile> {
  await ensurePersistence();
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  const firebaseUser = credential.user;

  if (!firebaseUser.emailVerified) {
    const error = new Error("E-posta adresiniz doğrulanmamış.") as Error & { code?: string };
    error.code = "auth/email-not-verified";
    throw error;
  }

  return await ensureUserProfile(firebaseUser);
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(
    auth,
    (user) => callback(user),
    (error) => {
      console.error("❌ Firebase Auth listener hatası:", error);
      callback(null);
    },
  );
}

let authReadyPromise: Promise<User | null> | null = null;
export function waitForFirebaseUser(): Promise<User | null> {
  if (auth.currentUser) return Promise.resolve(auth.currentUser);
  if (authReadyPromise) return authReadyPromise;

  authReadyPromise = new Promise<User | null>((resolve) => {
    let unsubscribe: (() => void) | null = null;
    unsubscribe = onAuthStateChanged(
      auth,
      (user) => {
        unsubscribe?.();
        unsubscribe = null;
        resolve(user);
      },
      () => {
        unsubscribe?.();
        unsubscribe = null;
        resolve(null);
      },
    );
  });

  return authReadyPromise;
}

export async function logout(): Promise<void> {
  await signOut(auth);
}

export async function logoutUser(): Promise<void> {
  await logout();
}

export function getCurrentFirebaseUser(): User | null {
  return auth.currentUser;
}
