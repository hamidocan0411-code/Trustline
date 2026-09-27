import {
  arrayRemove,
  arrayUnion,
  doc,
  updateDoc,
} from "firebase/firestore";
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
} from "firebase/messaging";
import { auth, app, db } from "./firebase";

const FCM_VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
const SERVICE_WORKER_PATH = "/firebase-messaging-sw.js";
const TOKEN_STORAGE_KEY = "trustline_fcm_token";

async function getMessagingIfSupported() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  if (!(await isSupported())) {
    return null;
  }

  return getMessaging(app);
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }

  return navigator.serviceWorker.register(SERVICE_WORKER_PATH);
}

export function getPushPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return Notification.permission;
}

export async function isPushSupported(): Promise<boolean> {
  try {
    return !!(await getMessagingIfSupported());
  } catch {
    return false;
  }
}

export async function enablePushNotifications(userId: string): Promise<string | null> {
  if (!userId || auth.currentUser?.uid !== userId) {
    throw new Error("Push bildirimi için geçerli kullanıcı oturumu gerekli.");
  }

  if (!FCM_VAPID_KEY) {
    throw new Error("FCM Web Push anahtarı yapılandırılmamış.");
  }

  const messaging = await getMessagingIfSupported();
  if (!messaging) {
    return null;
  }

  const permission =
    typeof Notification !== "undefined"
      ? await Notification.requestPermission()
      : "denied";

  if (permission !== "granted") {
    return null;
  }

  const serviceWorkerRegistration = await getServiceWorkerRegistration();
  if (!serviceWorkerRegistration) {
    return null;
  }

  const token = await getToken(messaging, {
    vapidKey: FCM_VAPID_KEY,
    serviceWorkerRegistration,
  });

  if (!token) {
    return null;
  }

  await updateDoc(doc(db, "users", userId), {
    pushTokens: arrayUnion(token),
    pushTokensUpdatedAt: new Date().toISOString(),
  });

  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // Local storage is only a convenience cache.
  }

  return token;
}

export async function registerPushIfAlreadyGranted(userId: string): Promise<string | null> {
  if (getPushPermission() !== "granted") {
    return null;
  }

  try {
    return await enablePushNotifications(userId);
  } catch (error) {
    console.warn("FCM mevcut izinle kaydedilemedi:", error);
    return null;
  }
}

export async function disablePushNotifications(userId: string): Promise<void> {
  if (!userId || auth.currentUser?.uid !== userId) {
    return;
  }

  let token: string | null = null;

  try {
    token = localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    token = null;
  }

  if (!token) {
    return;
  }

  try {
    await updateDoc(doc(db, "users", userId), {
      pushTokens: arrayRemove(token),
      pushTokensUpdatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn("FCM token kullanıcıdan temizlenemedi:", error);
  }

  try {
    const messaging = await getMessagingIfSupported();
    if (messaging) {
      await deleteToken(messaging);
    }
  } catch (error) {
    console.warn("FCM cihaz kaydı temizlenemedi:", error);
  }

  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export async function subscribeToForegroundPush(
  callback?: (payload: MessagePayload) => void
): Promise<() => void> {
  const messaging = await getMessagingIfSupported();
  if (!messaging) {
    return () => {};
  }

  return onMessage(messaging, (payload) => {
    callback?.(payload);
  });
}
