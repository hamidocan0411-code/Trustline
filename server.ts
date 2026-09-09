import express, {
  Request,
  Response,
  NextFunction,
} from "express";

import session from "express-session";
import path from "path";
import https from "https";
import { fileURLToPath } from "url";

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const app = express();

app.set("trust proxy", 1);

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

    console.log(
      "🔥 FIREBASE AUTH PROXY REQUEST:",
      {
        method: req.method,
        incomingHost:
          req.headers.host,
        targetHost,
        targetPath,
      }
    );

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
            "🔥 FIREBASE AUTH PROXY RESPONSE:",
            {
              statusCode:
                proxyResponse.statusCode,

              path:
                targetPath,

              location:
                proxyResponse
                  .headers.location,
            }
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
                  "🔁 FIREBASE LOCATION REWRITTEN:",
                  {
                    original:
                      locations,
                    rewritten,
                  }
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
                  "🍪 FIREBASE COOKIE REWRITTEN"
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

              message:
                error.message,
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

app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "trustline-secret-key",

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
 * SERVER
 * ============================================================
 */

const PORT =
  process.env.PORT ||
  10000;

app.listen(
  Number(PORT),
  "0.0.0.0",
  () => {
    console.log(
      `Trustline Express Server running on http://0.0.0.0:${PORT}`
    );
  }
);
