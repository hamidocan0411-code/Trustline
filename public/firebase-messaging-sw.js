/* TrustLine Express FCM Web Push Service Worker */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification?.data || {};
  const targetUrl =
    typeof data.clickUrl === "string" && data.clickUrl
      ? data.clickUrl
      : "https://trustlineexpress.com.tr/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const existing = windows.find(
        (client) =>
          client.url.startsWith("https://trustlineexpress.com.tr/")
      );

      if (existing) {
        await existing.navigate(targetUrl);
        await existing.focus();
        return;
      }

      await self.clients.openWindow(targetUrl);
    })()
  );
});

importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyCFNecgQj3kBN6Dj5mqycy0Io7kDMofQEM",
  authDomain: "trustlineexpress.com.tr",
  projectId: "trustline-8729d",
  storageBucket: "trustline-8729dfirebasestorage.app",
  messagingSenderId: "95555518174",
  appId: "1:95555518174:web:14be6958f3d0ada29a8c4f",
  measurementId: "G-RRLL4QMFXP",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  const data = payload.data || {};

  const title =
    typeof notification.title === "string"
      ? notification.title
      : typeof data.title === "string"
        ? data.title
        : "TrustLine Express";

  const body =
    typeof notification.body === "string"
      ? notification.body
      : typeof data.body === "string"
        ? data.body
        : "Yeni bir bildiriminiz var.";

  const clickUrl =
    typeof data.clickUrl === "string" && data.clickUrl
      ? data.clickUrl
      : "https://trustlineexpress.com.tr/";

  self.registration.showNotification(title, {
    body,
    icon: "https://i.ibb.co/wZpW2m4v/3-E0-E545-B-ADD8-46-F8-A01-F-83-D5-D61-E6-DA5.png",
    badge: "https://i.ibb.co/wZpW2m4v/3-E0-E545-B-ADD8-46-F8-A01-F-83-D5-D61-E6-DA5.png",
    data: {
      ...data,
      clickUrl,
    },
  });
});
