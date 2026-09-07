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
} from "firebase/firestore";

import { auth, db } from "./firebase";

import type {
  UserProfile,
} from "../types";

const ADMIN_EMAIL =
  "hamidocan0411@gmail.com";

function createProfile(
  user: User,
  existing?: Partial<UserProfile>
): UserProfile {
  const isAdmin =
    user.email?.toLowerCase() ===
    ADMIN_EMAIL.toLowerCase();

  return {
    id: user.uid,

    name:
      existing?.name?.trim() ||
      user.displayName?.trim() ||
      user.email?.split("@")[0] ||
      "Trustline Kullanıcısı",

    email:
      user.email ||
      existing?.email ||
      "",

    phone:
      existing?.phone ||
      "",

    role:
      isAdmin
        ? "admin"
        : existing?.role ||
          "customer",

    avatar:
      existing?.avatar ||
      user.photoURL ||
      undefined,

    vehicle:
      existing?.vehicle,

    plate:
      existing?.plate,

    courierStatus:
      existing?.courierStatus,

    totalDeliveries:
      existing?.totalDeliveries ||
      0,

    rating:
      existing?.rating ||
      5,

    createdAt:
      existing?.createdAt ||
      new Date().toISOString(),
  };
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
      createProfile(
        user,
        existing
      );

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
        {
          merge: true,
        }
      );
    }

    return profile;
  }

  const profile =
    createProfile(user);

  await setDoc(
    userRef,
    profile
  );

  return profile;
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

  const user =
    credential.user;

  await updateProfile(user, {
    displayName:
      name.trim(),
  });

  const profile =
    createProfile(user, {
      name: name.trim(),
      email:
        user.email ||
        email.trim(),
      phone: phone.trim(),
      role: "customer",
      createdAt:
        new Date().toISOString(),
    });

  await setDoc(
    doc(
      db,
      "users",
      user.uid
    ),
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

export async function getUserProfile(
  uid: string
): Promise<UserProfile | null> {
  const snapshot =
    await getDoc(
      doc(
        db,
        "users",
        uid
      )
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
    user: User | null,
    profile?: UserProfile | null
  ) => void
) {
  return onAuthStateChanged(
    auth,
    async (user) => {
      if (!user) {
        callback(
          null,
          null
        );
        return;
      }

      try {
        const profile =
          await ensureUserProfile(
            user
          );

        callback(
          user,
          profile
        );
      } catch (error) {
        console.error(
          "Firebase kullanıcı profili oluşturulamadı:",
          error
        );

        callback(
          user,
          null
        );
      }
    }
  );
}

export function getCurrentFirebaseUser(): User | null {
  return auth.currentUser;
}

export function isLoggedIn(): boolean {
  return !!auth.currentUser;
}