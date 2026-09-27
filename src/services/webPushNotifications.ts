import { arrayRemove, arrayUnion, doc, updateDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_VAPID_PUBLIC_KEY as string | undefined;
const SERVICE_WORKER_PATH = "/web-push-sw.js";

type StoredWebPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

function isIOSDevice() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isIOSHomeScreenApp() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function isIOSWebPushEnvironment() {
  return (
    typeof window !== "undefined" &&
    isIOSDevice() &&
    isIOSHomeScreenApp() &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    !!VAPID_PUBLIC_KEY
  );
}

function base64UrlToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function serializeSubscription(
  subscription: PushSubscription
): StoredWebPushSubscription {
  const json = subscription.toJSON();

  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Web Push aboneliği eksik.");
  }

  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime ?? null,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}

export async function enableIOSWebPush(userId: string) {
  if (!userId || auth.currentUser?.uid !== userId) {
    throw new Error("Web Push için geçerli kullanıcı oturumu gerekli.");
  }

  if (!isIOSWebPushEnvironment()) {
    return null;
  }

  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;
  }

  const registration = await navigator.serviceWorker.register(SERVICE_WORKER_PATH);
  await navigator.serviceWorker.ready;

  const subscription =
    await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlToUint8Array(VAPID_PUBLIC_KEY!),
    });

  const serialized = serializeSubscription(subscription);

  await updateDoc(doc(db, "users", userId), {
    webPushSubscriptions: arrayUnion(serialized),
    webPushSubscriptionsUpdatedAt: new Date().toISOString(),
  });

  return serialized;
}

export async function disableIOSWebPush(userId: string) {
  if (!userId || auth.currentUser?.uid !== userId) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration(SERVICE_WORKER_PATH);
    const subscription = await registration?.pushManager.getSubscription();

    if (subscription) {
      const serialized = serializeSubscription(subscription);
      await updateDoc(doc(db, "users", userId), {
        webPushSubscriptions: arrayRemove(serialized),
        webPushSubscriptionsUpdatedAt: new Date().toISOString(),
      });
      await subscription.unsubscribe();
    }
  } catch (error) {
    console.warn("Web Push aboneliği temizlenemedi:", error);
  }
}
