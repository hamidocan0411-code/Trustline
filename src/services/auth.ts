import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  auth,
  db,
} from "./firebase";

import type {
  UserProfile,
  UserRole,
} from "../types";

export interface AuthResult {
  success: boolean;
  user?: UserProfile;
  error?: string;
}

function firebaseErrorMessage(error: any): string {
  const code = error?.code || "";

  switch (code) {
    case "auth/invalid-email":
      return "Geçerli bir e-posta adresi girin.";

    case "auth/email-already-in-use":
      return "Bu e-posta adresi zaten kayıtlı.";

    case "auth/weak-password":
      return "Şifre en az 6 karakter olmalıdır.";

    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-posta veya şifre hatalı.";

    case "auth/too-many-requests":
      return "Çok fazla başarısız deneme yapıldı. Biraz sonra tekrar deneyin.";

    case "auth/network-request-failed":
      return "İnternet bağlantınızı kontrol edin.";

    default:
      return error?.message || "Bir hata oluştu.";
  }
}

export async function registerUser(params: {
  name: string;
  email: string;
  password: string;
  phone: string;
  role?: UserRole;
}): Promise<AuthResult> {
  try {
    const credential =
      await createUserWithEmailAndPassword(
        auth,
        params.email.trim().toLowerCase(),
        params.password
      );

    const firebaseUser = credential.user;

    await updateProfile(firebaseUser, {
      displayName: params.name.trim(),
    });

    const profile: UserProfile = {
      id: firebaseUser.uid,
      name: params.name.trim(),
      email: firebaseUser.email || params.email.trim().toLowerCase(),
      phone: params.phone.trim(),
      role: params.role || "customer",
      createdAt: new Date().toISOString(),
    };

    await setDoc(
      doc(db, "users", firebaseUser.uid),
      {
        ...profile,
        createdAt: serverTimestamp(),
      }
    );

    return {
      success: true,
      user: profile,
    };
  } catch (error: any) {
    console.error("Kayıt hatası:", error);

    return {
      success: false,
      error: firebaseErrorMessage(error),
    };
  }
}

export async function loginUser(
  email: string,
  password: string
): Promise<AuthResult> {
  try {
    const credential =
      await signInWithEmailAndPassword(
        auth,
        email.trim().toLowerCase(),
        password
      );

    const profile =
      await getUserProfile(credential.user);

    if (!profile) {
      return {
        success: false,
        error:
          "Hesabınız bulundu ancak kullanıcı profiliniz oluşturulmamış.",
      };
    }

    return {
      success: true,
      user: profile,
    };
  } catch (error: any) {
    console.error("Giriş hatası:", error);

    return {
      success: false,
      error: firebaseErrorMessage(error),
    };
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export async function getUserProfile(
  firebaseUser: User
): Promise<UserProfile | null> {
  try {
    const snapshot = await getDoc(
      doc(db, "users", firebaseUser.uid)
    );

    if (!snapshot.exists()) {
      return null;
    }

    const data = snapshot.data();

    return {
      id: firebaseUser.uid,
      name:
        data.name ||
        firebaseUser.displayName ||
        "Kullanıcı",
      email:
        data.email ||
        firebaseUser.email ||
        "",
      phone:
        data.phone ||
        "",
      role:
        data.role ||
        "customer",
      avatar:
        data.avatar,
      vehicle:
        data.vehicle,
      plate:
        data.plate,
      courierStatus:
        data.courierStatus,
      totalDeliveries:
        data.totalDeliveries,
      rating:
        data.rating,
      createdAt:
        data.createdAt?.toDate?.()?.toISOString?.() ||
        data.createdAt ||
        new Date().toISOString(),
    };
  } catch (error) {
    console.error(
      "Kullanıcı profili alınamadı:",
      error
    );

    return null;
  }
}

export function subscribeToAuth(
  callback: (
    user: User | null,
    profile: UserProfile | null
  ) => void
) {
  return onAuthStateChanged(
    auth,
    async (firebaseUser) => {
      if (!firebaseUser) {
        callback(null, null);
        return;
      }

      const profile =
        await getUserProfile(firebaseUser);

      callback(firebaseUser, profile);
    }
  );
}

export function getCurrentFirebaseUser(): User | null {
  return auth.currentUser;
}

export function isLoggedIn(): boolean {
  return !!auth.currentUser;
}