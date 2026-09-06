import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  Order,
  OrderStatus,
  PricingConfig,
  UserProfile,
  NotificationItem,
} from '../types';
import { DEFAULT_PRICING } from '../utils/pricing';
import { SEED_ADMIN, SEED_COURIERS, SEED_CUSTOMERS, SEED_ORDERS } from '../data/seedData';

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore with custom database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Authentication helper
export async function ensureFirebaseAuth(): Promise<FirebaseUser> {
  if (auth.currentUser) {
    return auth.currentUser;
  }
  return new Promise((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        try {
          const cred = await signInAnonymously(auth);
          resolve(cred.user);
        } catch (err) {
          console.warn('Firebase anonymous sign in fallback:', err);
          // In sandboxed environments if network is restricted, resolve with null-safe object
          reject(err);
        }
      }
    });
  });
}

// Initial Seeding to Firestore if cloud collection is empty
export async function seedFirestoreIfEmpty(): Promise<void> {
  try {
    // Check pricing
    const pricingRef = doc(db, 'pricing', 'current');
    const pricingSnap = await getDoc(pricingRef);
    if (!pricingSnap.exists()) {
      await setDoc(pricingRef, {
        ...DEFAULT_PRICING,
        updatedAt: new Date().toISOString(),
      });
    }

    // Check users
    const usersCol = collection(db, 'users');
    const usersSnap = await getDocs(usersCol);
    if (usersSnap.empty) {
      const allUsers = [SEED_ADMIN, ...SEED_COURIERS, ...SEED_CUSTOMERS];
      for (const u of allUsers) {
        await setDoc(doc(db, 'users', u.id), u);
      }
    }

    // Check orders
    const ordersCol = collection(db, 'orders');
    const ordersSnap = await getDocs(ordersCol);
    if (ordersSnap.empty) {
      for (const ord of SEED_ORDERS) {
        await setDoc(doc(db, 'orders', ord.id), ord);
      }
    }
  } catch (err) {
    console.warn('Firestore seeding notice (using local sync mode if offline):', err);
  }
}
