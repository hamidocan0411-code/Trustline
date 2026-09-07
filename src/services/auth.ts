import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import type {
  UserProfile,
  UserRole,
} from '../types';

const ADMIN_EMAIL = 'hamidocan0411@gmail.com';

function getDefaultRole(email: string): UserRole {
  return email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
    ? 'admin'
    : 'customer';
}

export async function ensureUserProfile(
  user: User
): Promise<UserProfile> {
  const userRef = doc(db, 'users', user.uid);
  const snapshot = await getDoc(userRef);
  if (snapshot.exists()) {
    const data = snapshot.data() as Partial<UserProfile>;
    const profile: UserProfile = {
      id: user.uid,
      name: data.name || user.displayName || 'Kullanıcı',
      email: data.email || user.email || '',
      phone: data.phone || '',
      role: data.role || getDefaultRole(user.email || ''),
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      isActive: data.isActive !== false,
    };
    if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
      profile.role = 'admin';
    }
    return profile;
  }
  const role = getDefaultRole(user.email || '');
  const profile: UserProfile = {
    id: user.uid,
    name: user.displayName || 'Kullanıcı',
    email: user.email || '',
    phone: '',
    role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
  };
  await setDoc(userRef, {
    ...profile,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return profile;
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
  phone: string = ''
): Promise<UserProfile> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
  const user = credential.user;

  await updateProfile(user, {
    displayName: name.trim(),
  });

  const role = getDefaultRole(user.email || '');
  const userRef = doc(db, 'users', user.uid);

  const profile: UserProfile = {
    id: user.uid,
    name: name.trim(),
    email: user.email || email.trim(),
    phone: phone.trim(),
    role,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isActive: true,
  };

  try {
    await setDoc(userRef, {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      isActive: true,
    });
    console.log('Firestore kullanıcı kaydı başarıyla tamamlandı:', user.uid);
  } catch (firestoreErr) {
    console.error('Firestore kullanıcı kaydı yazılırken kritik hata:', firestoreErr);
    throw firestoreErr;
  }

  return profile;
}

export async function loginUser(
  email: string,
  password: string
): Promise<UserProfile> {
  const credential = await signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
  return ensureUserProfile(credential.user);
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuth(
  callback: (
    user: User | null,
    profile: UserProfile | null
  ) => void
): () => void {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      callback(null, null);
      return;
    }
    try {
      const profile = await ensureUserProfile(user);
      callback(user, profile);
    } catch (error) {
      console.error('Kullanıcı profili alınamadı:', error);
      callback(user, null);
    }
  });
}

export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }
  return ensureUserProfile(user);
}

export function isAdminUser(user: User | null): boolean {
  return (
    !!user?.email &&
    user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}
