import express, {
  Request,
  Response,
  NextFunction,
} from "express";

import session from "express-session";
import path from "path";
import https from "https";
import { randomBytes } from "crypto";
import { fileURLToPath } from "url";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";


const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const app = express();

app.set("trust proxy", 1);

// Baseline security headers without adding a runtime dependency.
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(self), microphone=(self), geolocation=(self), payment=()"
  );
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }
  next();
});

/**
 * ============================================================
 * FIREBASE AUTH REVERSE PROXY
 * ============================================================
 *
 * Trustline Express:
 *
 * https://trustlineexpress.com.tr/__/auth/*
 *
 *                  ↓
 *
 * https://trustline-8729d.firebaseapp.com/__/auth/*
 *
 * IMPORTANT:
 *
 * Bu 302 redirect değildir.
 * İstek server tarafında Firebase'e proxy edilir.
 *
 * Ayrıca Firebase'in:
 *
 * - Location
 * - Set-Cookie
 *
 * header'ları Trustline domainine göre yeniden yazılır.
 *
 * Böylece redirect state Firebase domainine kaçmaz.
 * ============================================================
 */

app.use(
  "/__/auth",
  (
    req: Request,
    res: Response
  ) => {
    const targetHost =
      "trustline-8729d.firebaseapp.com";

    const appHost =
      "trustlineexpress.com.tr";

    const targetPath =
      `/__/auth${req.url}`;

    // Do not log auth query strings, cookies, or redirect state.

    const headers: Record<
      string,
      string | string[] | undefined
    > = {
      ...req.headers,

      /**
       * Firebase upstream Host
       */
      host: targetHost,

      /**
       * Proxy bilgisini Firebase'e ilet.
       */
      "x-forwarded-host":
        req.headers.host ??
        appHost,

      "x-forwarded-proto":
        "https",

      "x-forwarded-for":
        req.ip,
    };

    /**
     * Hop-by-hop header'ları kaldır.
     */
    delete headers.connection;
    delete headers["keep-alive"];
    delete headers["proxy-authenticate"];
    delete headers["proxy-authorization"];
    delete headers.te;
    delete headers.trailer;
    delete headers["transfer-encoding"];
    delete headers.upgrade;

    const proxyRequest =
      https.request(
        {
          hostname:
            targetHost,

          port: 443,

          path:
            targetPath,

          method:
            req.method,

          headers,

          servername:
            targetHost,
        },

        (
          proxyResponse
        ) => {
          console.log(
            "Firebase Auth proxy response:",
            proxyResponse.statusCode
          );

          /**
           * ==================================================
           * RESPONSE HEADERS
           * ==================================================
           */

          Object.entries(
            proxyResponse.headers
          ).forEach(
            ([key, value]) => {
              if (
                value === undefined
              ) {
                return;
              }

              /**
               * ----------------------------------------------
               * LOCATION
               * ----------------------------------------------
               *
               * Firebase upstream bazen kendi
               * firebaseapp.com domainini döndürebilir.
               *
               * Tarayıcıyı firebaseapp.com'a göndermiyoruz.
               *
               * Trustline domaininde tutuyoruz.
               */

              if (
                key.toLowerCase() ===
                "location"
              ) {
                const locations =
                  Array.isArray(
                    value
                  )
                    ? value
                    : [value];

                const rewritten =
                  locations.map(
                    (location) =>
                      location
                        .replace(
                          "https://trustline-8729d.firebaseapp.com",
                          `https://${appHost}`
                        )
                        .replace(
                          "http://trustline-8729d.firebaseapp.com",
                          `https://${appHost}`
                        )
                  );

                res.setHeader(
                  "Location",
                  rewritten.length ===
                    1
                    ? rewritten[0]
                    : rewritten
                );

                console.log(
                  "Firebase Auth proxy location rewritten."
                );

                return;
              }

              /**
               * ----------------------------------------------
               * SET-COOKIE
               * ----------------------------------------------
               *
               * Firebase upstream cookie'yi kendi domainine
               * göre gönderirse tarayıcı Trustline domaininde
               * bunu kullanamayabilir.
               *
               * Domain'i Trustline'a çeviriyoruz.
               */

              if (
                key.toLowerCase() ===
                "set-cookie"
              ) {
                const cookies =
                  Array.isArray(
                    value
                  )
                    ? value
                    : [value];

                const rewrittenCookies =
                  cookies.map(
                    (cookie) =>
                      cookie
                        .replace(
                          /;\s*Domain=\.?trustline-8729d\.firebaseapp\.com/gi,
                          `; Domain=${appHost}`
                        )
                        .replace(
                          /;\s*Domain=trustline-8729d\.firebaseapp\.com/gi,
                          `; Domain=${appHost}`
                        )
                  );

                res.setHeader(
                  "Set-Cookie",
                  rewrittenCookies
                );

                console.log(
                  "Firebase Auth proxy cookie rewritten."
                );

                return;
              }

              /**
               * Diğer header'ları aynen geçir.
               */
              res.setHeader(
                key,
                value
              );
            }
          );

          res.status(
            proxyResponse.statusCode ||
              200
          );

          proxyResponse.pipe(
            res
          );
        }
      );

    proxyRequest.on(
      "error",
      (error) => {
        console.error(
          "❌ FIREBASE AUTH PROXY HATASI:",
          error
        );

        if (
          !res.headersSent
        ) {
          res
            .status(502)
            .json({
              error:
                "Firebase Auth proxy error",
            });
        } else {
          res.end();
        }
      }
    );

    req.pipe(
      proxyRequest
    );
  }
);

/**
 * ============================================================
 * NORMAL EXPRESS MIDDLEWARE
 * ============================================================
 */

app.use(
  express.json()
);

app.use(
  express.urlencoded({
    extended: true,
  })
);

/**
 * ============================================================
 * SESSION
 * ============================================================
 */

const sessionSecret =
  process.env.SESSION_SECRET ||
  randomBytes(32).toString("hex");

app.use(
  session({
    secret: sessionSecret,

    resave: false,

    saveUninitialized: false,

    cookie: {
      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite: "lax",

      httpOnly: true,

      maxAge:
        24 *
        60 *
        60 *
        1000,
    },
  })
);

/**
 * ============================================================
 * HEALTH
 * ============================================================
 */

app.get(
  "/api/health",
  (
    req: Request,
    res: Response
  ) => {
    res.json({
      status: "ok",

      timestamp:
        new Date().toISOString(),
    });
  }
);

/**
 * ============================================================
 * STATIC FRONTEND
 * ============================================================
 */

const distPath =
  path.join(
    __dirname,
    "../dist"
  );

app.use(
  express.static(
    distPath
  )
);

/**
 * ============================================================
 * SPA FALLBACK
 * ============================================================
 */

app.get(
  "*",
  (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (
      req.path.startsWith(
        "/api"
      )
    ) {
      return next();
    }

    /**
     * Firebase Auth proxy buraya düşmemeli.
     */
    if (
      req.path.startsWith(
        "/__/auth"
      )
    ) {
      return next();
    }

    res.sendFile(
      path.join(
        distPath,
        "index.html"
      )
    );
  }
);


/**
 * ============================================================
 * FIREBASE FCM PUSH BRIDGE
 * ============================================================
 *
 * Mevcut /notifications eventlerini izler ve ilgili kullanıcının
 * kayıtlı web push cihazlarına FCM gönderir.
 *
 * Frontend'deki notification üretim mantığına dokunmaz.
 * İlk snapshot yalnızca mevcut kayıtları senkronize eder; eski
 * bildirimler yeniden push edilmez.
 * ============================================================
 */

type PushNotificationRecord = {
  userId?: string;
  orderId?: string;
  title?: string;
  message?: string;
  type?: string;
  createdAt?: string;
};

let pushBridgeStarted = false;

function getFirebaseAdminApp() {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const rawServiceAccount =
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();

  if (rawServiceAccount) {
    const serviceAccount = JSON.parse(rawServiceAccount);
    return initializeApp({
      credential: cert(serviceAccount),
      projectId: "trustline-8729d",
    });
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return initializeApp({
      projectId: "trustline-8729d",
    });
  }

  return null;
}

function buildPushClickUrl(
  role: string | undefined,
  orderId: string | undefined,
  type: string | undefined
): string {
  const params = new URLSearchParams();

  if (orderId) {
    params.set("orderId", orderId);
  }

  if (type) {
    params.set("notificationType", type);
  }

  if (role) {
    params.set("notificationRole", role);
  }

  const query = params.toString();
  return query
    ? `https://trustlineexpress.com.tr/?${query}`
    : "https://trustlineexpress.com.tr/";
}

async function sendPushForNotification(
  notificationId: string,
  notification: PushNotificationRecord
): Promise<void> {
  if (!notification.userId) {
    return;
  }

  const adminApp = getFirebaseAdminApp();
  if (!adminApp) {
    return;
  }

  const firestore = getFirestore(adminApp);
  const messaging = getMessaging(adminApp);

  const userSnapshot = await firestore
    .collection("users")
    .doc(notification.userId)
    .get();

  if (!userSnapshot.exists) {
    return;
  }

  const user = userSnapshot.data() || {};
  const tokens = Array.isArray(user.pushTokens)
    ? user.pushTokens.filter(
        (token): token is string =>
          typeof token === "string" && token.length > 0
      )
    : [];

  if (tokens.length === 0) {
    return;
  }

  const role =
    typeof user.role === "string"
      ? user.role
      : undefined;

  const title =
    notification.title?.trim() ||
    "TrustLine Express";

  const body =
    notification.message?.trim() ||
    "Yeni bir bildiriminiz var.";

  const clickUrl = buildPushClickUrl(
    role,
    notification.orderId,
    notification.type
  );

  const data: Record<string, string> = {
    notificationId,
    userId: notification.userId,
    notificationType: notification.type || "info",
    orderId: notification.orderId || "",
    clickUrl,
  };

  const response = await messaging.sendEachForMulticast({
    tokens: tokens.slice(0, 500),
    data: {
      ...data,
      title,
      body,
    },
    webpush: {
      headers: {
        TTL: "86400",
      },
    },
  });

  const invalidTokens: string[] = [];

  response.responses.forEach((result, index) => {
    if (!result.success) {
      const code =
        (result.error as { code?: string } | undefined)?.code || "";

      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        invalidTokens.push(tokens[index]);
      }
    }
  });

  if (invalidTokens.length > 0) {
    await firestore
      .collection("users")
      .doc(notification.userId)
      .update({
        pushTokens:
          tokens.filter(
            (token) => !invalidTokens.includes(token)
          ),
        pushTokensUpdatedAt:
          new Date().toISOString(),
      });
  }

  console.log(
    "[FCM PUSH]",
    JSON.stringify({
      recipient: notification.userId,
      event: notification.type || "info",
      orderId: notification.orderId || null,
      success: response.successCount,
      failed: response.failureCount,
      cleaned: invalidTokens.length,
    })
  );
}

function startPushNotificationBridge(): void {
  if (pushBridgeStarted) {
    return;
  }

  const adminApp = getFirebaseAdminApp();

  if (!adminApp) {
    console.warn(
      "⚠️ FCM push bridge başlatılmadı. FIREBASE_SERVICE_ACCOUNT_JSON veya GOOGLE_APPLICATION_CREDENTIALS gerekli."
    );
    return;
  }

  pushBridgeStarted = true;

  const firestore = getFirestore(adminApp);
  const notificationsRef =
    firestore.collection("notifications");

  let initialSnapshot = true;

  notificationsRef.onSnapshot(
    (snapshot) => {
      if (initialSnapshot) {
        initialSnapshot = false;
        return;
      }

      for (const change of snapshot.docChanges()) {
        if (change.type !== "added") {
          continue;
        }

        const notification =
          change.doc.data() as PushNotificationRecord;

        void sendPushForNotification(
          change.doc.id,
          notification
        ).catch((error) => {
          console.error(
            "❌ FCM push gönderimi başarısız:",
            error
          );
        });
      }
    },
    (error) => {
      pushBridgeStarted = false;
      console.error(
        "❌ FCM notification listener hatası:",
        error
      );
    }
  );

  console.log(
    "🔔 FCM push bridge aktif: Firestore notifications → FCM"
  );
}

/**
 * ============================================================
 * SERVER
 * ============================================================
 */

const PORT =
  process.env.PORT ||
  10000;

startPushNotificationBridge();

app.listen(
  Number(PORT),
  "0.0.0.0",
  () => {
    console.log(
      `Trustline Express Server running on http://0.0.0.0:${PORT}`
    );
  }
);
