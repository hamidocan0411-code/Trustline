import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import { auth, db } from "./firebase";
import type { UserProfile, UserRole } from "../types";

const ADMIN_EMAIL = "hamidocan0411@gmail.com";

function getDefaultName(user: User): string {
  return (
    user.displayName?.trim() ||
    user.email?.split("@")[0] ||
    "Trustline Kullanıcısı"
  );
}

function mapUserProfile(
  user: User,
  data: Partial<UserProfile> = {}
): UserProfile {
  const isAdmin =
    user.email?.toLowerCase() ===
    ADMIN_EMAIL.toLowerCase();

  return {
    id: user.uid,
    name:
      data.name?.trim() ||
      getDefaultName(user),
    email:
      user.email ||
      data.email ||
      "",
    phone:
      data.phone ||
      "",
    role:
      isAdmin
        ? "admin"
        : data.role || "customer",
    avatar:
      data.avatar ||
      user.photoURL ||
      undefined,
    vehicle:
      data.vehicle,
    plate:
      data.plate,
    courierStatus:
      data.courierStatus,
    totalDeliveries:
      data.totalDeliveries || 0,
    rating:
      data.rating || 5,
    createdAt:
      data.createdAt ||
      new Date().toISOString(),
  };
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
  phone: string = ""
): Promise<UserProfile> {
  const credential =
    await createUserWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

  const user = credential.user;

  await updateProfile(user, {
    displayName: name.trim(),
  });

  const profile = mapUserProfile(user, {
    name: name.trim(),
    email: user.email || email.trim(),
    phone: phone.trim(),
    role: "customer",
    createdAt:
      new Date().toISOString(),
  });

  await setDoc(
    doc(db, "users", user.uid),
    profile
  );

  return profile;
}

export async function loginUser(
  email: string,
  password: string
): Promise<UserProfile> {
  const credential =
    await signInWithEmailAndPassword(
      auth,
      email.trim(),
      password
    );

  return ensureUserProfile(
    credential.user
  );
}

export async function ensureUserProfile(
  user: User
): Promise<UserProfile> {
  const userRef =
    doc(db, "users", user.uid);

  const snapshot =
    await getDoc(userRef);

  if (snapshot.exists()) {
    const existing =
      snapshot.data() as Partial<UserProfile>;

    const profile =
      mapUserProfile(user, existing);

    if (
      user.email?.toLowerCase() ===
        ADMIN_EMAIL.toLowerCase() &&
      existing.role !== "admin"
    ) {
      await setDoc(
        userRef,
        {
          ...existing,
          ...profile,
          role: "admin",
          updatedAt:
            new Date().toISOString(),
        },
        { merge: true }
      );
    }

    return profile;
  }

  const profile =
    mapUserProfile(user);

  await setDoc(
    userRef,
    {
      ...profile,
      createdAt:
        serverTimestamp(),
    }
  );

  return {
    ...profile,
    createdAt:
      new Date().toISOString(),
  };
}

export async function getUserProfile(
  uid: string
): Promise<UserProfile | null> {
  const snapshot =
    await getDoc(
      doc(db, "users", uid)
    );

  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as UserProfile;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(
  callback: (
    user: User | null
  ) => void
) {
  return onAuthStateChanged(
    auth,
    callback
  );
}

export function getCurrentFirebaseUser(): User | null {
  return auth.currentUser;
}

export function isLoggedIn(): boolean {
  return !!auth.currentUser;
}