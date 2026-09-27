const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

function buildPushClickUrl(user, notification) {
  const params = new URLSearchParams();

  if (notification.orderId) {
    params.set("orderId", String(notification.orderId));
  }

  if (notification.type) {
    params.set("notificationType", String(notification.type));
  }

  if (typeof user.role === "string" && user.role) {
    params.set("notificationRole", user.role);
  }

  const query = params.toString();
  return query
    ? `https://trustlineexpress.com.tr/?${query}`
    : "https://trustlineexpress.com.tr/";
}

exports.sendTrustlineWebPush = onDocumentCreated(
  {
    document: "notifications/{notificationId}",
    region: "europe-west1",
    retry: true,
  },
  async (event) => {
    const notificationId = event.params.notificationId;
    const notification = event.data?.data();

    if (!notification || !notification.userId) {
      return;
    }

    // The notification document is also our delivery state.
    // No extra Firestore collection is created.
    if (notification.pushSentAt || notification.pushStatus === "sent") {
      return;
    }

    const userRef = db.collection("users").doc(String(notification.userId));
    const userSnapshot = await userRef.get();

    if (!userSnapshot.exists) {
      return;
    }

    const user = userSnapshot.data() || {};
    const tokens = Array.isArray(user.pushTokens)
      ? [...new Set(
          user.pushTokens.filter(
            (token) => typeof token === "string" && token.length > 0
          )
        )]
      : [];

    if (tokens.length === 0) {
      return;
    }

    const title =
      typeof notification.title === "string" && notification.title.trim()
        ? notification.title.trim()
        : "TrustLine Express";

    const body =
      typeof notification.message === "string" && notification.message.trim()
        ? notification.message.trim()
        : "Yeni bir bildiriminiz var.";

    const clickUrl = buildPushClickUrl(user, notification);

    // FCM multicast supports up to 500 registration tokens per request.
    const batches = [];
    for (let i = 0; i < tokens.length; i += 500) {
      batches.push(tokens.slice(i, i + 500));
    }

    let successCount = 0;
    let failureCount = 0;
    const invalidTokens = [];

    for (const batch of batches) {
      const response = await messaging.sendEachForMulticast({
        tokens: batch,
        data: {
          notificationId: String(notificationId),
          userId: String(notification.userId),
          notificationType: String(notification.type || "info"),
          orderId: String(notification.orderId || ""),
          clickUrl,
          title,
          body,
        },
        webpush: {
          headers: {
            TTL: "86400",
          },
        },
      });

      successCount += response.successCount;
      failureCount += response.failureCount;

      response.responses.forEach((result, index) => {
        if (!result.success) {
          const code = result.error?.code || "";

          if (
            code === "messaging/registration-token-not-registered" ||
            code === "messaging/invalid-registration-token"
          ) {
            invalidTokens.push(batch[index]);
          }
        }
      });
    }

    if (invalidTokens.length > 0) {
      const invalidSet = new Set(invalidTokens);
      await userRef.update({
        pushTokens: FieldValue.arrayRemove(...invalidTokens),
        pushTokensUpdatedAt: new Date().toISOString(),
      });

      logger.info("FCM invalid token cleanup", {
        userId: notification.userId,
        removed: invalidSet.size,
      });
    }

    // Mark the existing notification as delivered; no new collection is needed.
    await event.data.ref.update({
      pushStatus: "sent",
      pushSentAt: new Date().toISOString(),
      pushSuccessCount: successCount,
      pushFailureCount: failureCount,
    });

    logger.info("TrustLine web push sent", {
      notificationId,
      userId: notification.userId,
      type: notification.type || "info",
      orderId: notification.orderId || null,
      successCount,
      failureCount,
    });
  }
);
