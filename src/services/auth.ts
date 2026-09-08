import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "./firebase";

export const ADMIN_EMAIL = "hamidocan0411@gmail.com";

export type UserRole = "customer" | "courier" | "admin";

export interface AuthUserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  vehicle?: string;
  plate?: string;
  courierStatus?: "Müsait" | "Meşgul" | "Çevrimdışı";
  totalDeliveries?: number;
  rating?: number;
  createdAt: string;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

function getDefaultRole(email: string): UserRole {
  return email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase()
    ? "admin"
    : "customer";
}

function normalizeRole(value: unknown, email: string): UserRole {
  if (
    value === "admin" ||
    value === "courier" ||
    value === "customer"
  ) {
    return value;
  }

  return getDefaultRole(email);
}

function normalizeProfile(
  uid: string,
  data: Record<string, unknown>,
  fallbackUser?: User
): AuthUserProfile {
  const email =
    typeof data.email === "string"
      ? data.email
      : fallbackUser?.email ?? "";

  const name =
    typeof data.name === "string" && data.name.trim()
      ? data.name
      : fallbackUser?.displayName ?? "Trustline Kullanıcısı";

  const phone =
    typeof data.phone === "string"
      ? data.phone
      : fallbackUser?.phoneNumber ?? "";

  const createdAt =
    typeof data.createdAt === "string"
      ? data.createdAt
      : new Date().toISOString();

  return {
    id: uid,
    name,
    email,
    phone,
    role: normalizeRole(data.role, email),
    avatar:
      typeof data.avatar === "string"
        ? data.avatar
        : fallbackUser?.photoURL ?? undefined,
    vehicle:
      typeof data.vehicle === "string"
        ? data.vehicle
        : undefined,
    plate:
      typeof data.plate === "string"
        ? data.plate
        : undefined,
    courierStatus:
      data.courierStatus === "Müsait" ||
      data.courierStatus === "Meşgul" ||
      data.courierStatus === "Çevrimdışı"
        ? data.courierStatus
        : undefined,
    totalDeliveries:
      typeof data.totalDeliveries === "number"
        ? data.totalDeliveries
        : 0,
    rating:
      typeof data.rating === "number"
        ? data.rating
        : 5,
    createdAt,
  };
}

/**
 * Firebase Auth kullanıcısının Firestore profilini getirir.
 *
 * ÖNEMLİ:
 * Var olan kullanıcı için eksik profil varsa customer olarak
 * otomatik oluşturur.
 *
 * Böylece Google ile ilk giriş yapan müşteri de otomatik olarak
 * users/{uid} altında kayıt edilir.
 */
export async function ensureUserProfile(
  user: User
): Promise<AuthUserProfile> {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    return normalizeProfile(
      user.uid,
      snapshot.data(),
      user
    );
  }

  const role = getDefaultRole(user.email ?? "");

  const profileData = {
    id: user.uid,
    name:
      user.displayName?.trim() ||
      "Trustline Kullanıcısı",
    email: user.email ?? "",
    phone: user.phoneNumber ?? "",
    role,
    avatar: user.photoURL ?? "",
    totalDeliveries: 0,
    rating: 5,
    createdAt: new Date().toISOString(),
    createdAtServer: serverTimestamp(),
  };

  await setDoc(userRef, profileData);

  return normalizeProfile(
    user.uid,
    profileData,
    user
  );
}

/**
 * Email + şifre ile yeni müşteri kaydı.
 */
export async function registerUser({
  name,
  email,
  password,
  phone = "",
}: RegisterData): Promise<AuthUserProfile> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  const cleanPhone = phone.trim();

  if (!cleanName) {
    throw new Error("Ad soyad gerekli.");
  }

  if (!cleanEmail) {
    throw new Error("E-posta adresi gerekli.");
  }

  if (password.length < 6) {
    throw new Error(
      "Şifre en az 6 karakter olmalıdır."
    );
  }

  const credential =
    await createUserWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    );

  const user = credential.user;

  try {
    await updateProfile(user, {
      displayName: cleanName,
    });

    const role = getDefaultRole(cleanEmail);

    const profileData = {
      id: user.uid,
      name: cleanName,
      email: cleanEmail,
      phone: cleanPhone,
      role,
      avatar: "",
      totalDeliveries: 0,
      rating: 5,
      createdAt: new Date().toISOString(),
      createdAtServer: serverTimestamp(),
    };

    await setDoc(
      doc(db, "users", user.uid),
      profileData
    );

    return normalizeProfile(
      user.uid,
      profileData,
      user
    );
  } catch (error) {
    /*
     * Auth hesabı oluşturuldu ama Firestore profili
     * oluşturulamadıysa kullanıcı yine de giriş yapmış
     * durumda kalmasın.
     */
    await signOut(auth).catch(() => undefined);

    throw error;
  }
}

/**
 * Email + şifre ile giriş.
 */
export async function loginUser(
  email: string,
  password: string
): Promise<AuthUserProfile> {
  const cleanEmail = email.trim().toLowerCase();

  if (!cleanEmail) {
    throw new Error("E-posta adresi gerekli.");
  }

  if (!password) {
    throw new Error("Şifre gerekli.");
  }

  const credential =
    await signInWithEmailAndPassword(
      auth,
      cleanEmail,
      password
    );

  return ensureUserProfile(
    credential.user
  );
}

/**
 * Google ile giriş/kayıt.
 *
 * Kullanıcı daha önce kayıt olmadıysa Firebase Auth
 * hesabını oluşturur ve users/{uid} profiline otomatik
 * olarak customer kaydı açılır.
 */
export async function loginWithGoogle(): Promise<AuthUserProfile> {
  const provider =
    new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account",
  });

  const credential =
    await signInWithPopup(
      auth,
      provider
    );

  return ensureUserProfile(
    credential.user
  );
}

/**
 * Çıkış.
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Mevcut Firebase kullanıcısının Firestore profilini getirir.
 */
export async function getCurrentUserProfile(): Promise<AuthUserProfile | null> {
  const user = auth.currentUser;

  if (!user) {
    return null;
  }

  try {
    return await ensureUserProfile(user);
  } catch {
    return null;
  }
}

/**
 * Kullanıcı auth durumunu dinler.
 */
export function subscribeToAuth(
  callback: (
    user: User | null,
    profile: AuthUserProfile | null
  ) => void
): () => void {
  return onAuthStateChanged(
    auth,
    async (user) => {
      if (!user) {
        callback(null, null);
        return;
      }

      try {
        const profile =
          await ensureUserProfile(user);

        callback(user, profile);
      } catch (error) {
        console.error(
          "Kullanıcı profili alınamadı:",
          error
        );

        callback(user, null);
      }
    }
  );
}

/**
 * Admin kontrolü.
 */
export function isAdminUser(
  profile: AuthUserProfile | null
): boolean {
  if (!profile) {
    return false;
  }

  return (
    profile.role === "admin" ||
    profile.email.toLowerCase() ===
      ADMIN_EMAIL.toLowerCase()
  );
}

/**
 * Kurye kontrolü.
 */
export function isCourierUser(
  profile: AuthUserProfile | null
): boolean {
  return profile?.role === "courier";
}

/**
 * Müşteri kontrolü.
 */
export function isCustomerUser(
  profile: AuthUserProfile | null
): boolean {
  return profile?.role === "customer";
}

/**
 * Firebase Auth kullanıcısını doğrudan döndürür.
 */
export function getFirebaseUser(): User | null {
  return auth.currentUser;
}