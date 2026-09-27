self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "Trustline Express",
      body: event.data ? event.data.text() : "Yeni bir bildiriminiz var.",
    };
  }

  const title =
    typeof data.title === "string" && data.title.trim()
      ? data.title
      : "Trustline Express";

  const body =
    typeof data.body === "string" && data.body.trim()
      ? data.body
      : "Yeni bir bildiriminiz var.";

  const url =
    typeof data.url === "string" && data.url
      ? data.url
      : "https://trustlineexpress.com.tr/";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "https://i.ibb.co/wZpW2m4v/3-E0-E545-B-ADD8-46-F8-A01-F-83-D5-D61-E6-DA5.png",
      badge: "https://i.ibb.co/wZpW2m4v/3-E0-E545-B-ADD8-46-F8-A01-F-83-D5-D61-E6-DA5.png",
      data: { url },
      tag: typeof data.tag === "string" ? data.tag : "trustline-notification",
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || "https://trustlineexpress.com.tr/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find((client) =>
        client.url.startsWith("https://trustlineexpress.com.tr/")
      );

      if (existing) {
        await existing.navigate(url);
        await existing.focus();
        return;
      }

      await self.clients.openWindow(url);
    })()
  );
});
