const PROJECT_ID = "trustline-8729d";
const FIRESTORE_BASE =
  \`https://firestore.googleapis.com/v1/projects/\${PROJECT_ID}/databases/(default)/documents\`;
const FCM_ENDPOINT =
  \`https://fcm.googleapis.com/v1/projects/\${PROJECT_ID}/messages:send\`;
const OAUTH_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const OAUTH_SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const MAX_PENDING = 3;
const MAX_TOKENS_PER_USER = 10;

function b64url(input) {
  const bytes =
    input instanceof ArrayBuffer
      ? new Uint8Array(input)
      : new TextEncoder().encode(input);

  let binary = "";
  const chunk = 0x8000;

  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromB64Url(value) {
  const normalized = value
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(value.length / 4) * 4, "=");

  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function pemToArrayBuffer(pem) {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");

  return fromB64Url(body.replace(/\+/g, "-").replace(/\//g, "_")).buffer;
}

async function createGoogleAccessToken(serviceAccountJson) {
  const serviceAccount = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(
    JSON.stringify({
      iss: serviceAccount.client_email,
      scope: OAUTH_SCOPE,
      aud: OAUTH_TOKEN_ENDPOINT,
      iat: now,
      exp: now + 3600,
    })
  );

  const unsignedToken = \`\${header}.\${claim}\`;

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(serviceAccount.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    privateKey,
    new TextEncoder().encode(unsignedToken)
  );

  const assertion = \`\${unsignedToken}.\${b64url(signature)}\`;

  const response = await fetch(OAUTH_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:
      "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer" +
      "&assertion=" +
      encodeURIComponent(assertion),
  });

  if (!response.ok) {
    throw new Error(
      \`Google OAuth token request failed: \${response.status} \${await response.text()}\`
    );
  }

  const tokenResponse = await response.json();

  if (!tokenResponse.access_token) {
    throw new Error("Google OAuth response did not contain access_token.");
  }

  return tokenResponse.access_token;
}

function firestoreValueToJs(value) {
  if (!value) return undefined;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return Number(value.doubleValue);
  if ("booleanValue" in value) return value.booleanValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) {
    return (value.arrayValue.values || []).map(firestoreValueToJs);
  }
  if ("mapValue" in value) {
    return Object.fromEntries(
      Object.entries(value.mapValue.fields || {}).map(([key, child]) => [
        key,
        firestoreValueToJs(child),
      ])
    );
  }
  return undefined;
}

function fieldsToJs(fields = {}) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [
      key,
      firestoreValueToJs(value),
    ])
  );
}

function jsToFirestoreValue(value) {
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number" && Number.isInteger(value)) {
    return { integerValue: String(value) };
  }
  if (typeof value === "number") return { doubleValue: value };
  if (value === null) return { nullValue: null };
  throw new Error("Unsupported Firestore value type.");
}

async function firestoreRequest(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: \`Bearer \${accessToken}\`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    throw new Error(
      \`Firestore request failed: \${response.status} \${await response.text()}\`
    );
  }

  return response;
}

async function findPendingNotifications(accessToken) {
  const response = await firestoreRequest(
    \`\${FIRESTORE_BASE}:runQuery\`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: "notifications" }],
          where: {
            fieldFilter: {
              field: { fieldPath: "pushStatus" },
              op: "EQUAL",
              value: { stringValue: "pending" },
            },
          },
          limit: MAX_PENDING,
        },
      }),
    }
  );

  const rows = await response.json();

  return rows
    .filter((row) => row.document)
    .map((row) => ({
      id: row.document.name.split("/").pop(),
      fields: fieldsToJs(row.document.fields || {}),
      name: row.document.name,
    }));
}

async function getUser(accessToken, userId) {
  const response = await firestoreRequest(
    \`\${FIRESTORE_BASE}/users/\${encodeURIComponent(userId)}\`,
    accessToken
  );

  const document = await response.json();
  return fieldsToJs(document.fields || {});
}

function buildClickUrl(user, notification) {
  const params = new URLSearchParams();

  if (notification.orderId) {
    params.set("orderId", String(notification.orderId));
  }

  if (notification.type) {
    params.set("notificationType", String(notification.type));
  }

  if (user.role) {
    params.set("notificationRole", String(user.role));
  }

  const query = params.toString();

  return query
    ? \`https://trustlineexpress.com.tr/?\${query}\`
    : "https://trustlineexpress.com.tr/";
}

async function sendFcmMessage(accessToken, token, notification, user) {
  const title =
    typeof notification.title === "string" && notification.title.trim()
      ? notification.title.trim()
      : "TrustLine Express";

  const body =
    typeof notification.message === "string" && notification.message.trim()
      ? notification.message.trim()
      : "Yeni bir bildiriminiz var.";

  const response = await fetch(FCM_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: \`Bearer \${accessToken}\`,
      "Content-Type": "application/json; UTF-8",
    },
    body: JSON.stringify({
      message: {
        token,
        data: {
          notificationId: String(notification.id),
          userId: String(notification.userId),
          notificationType: String(notification.type || "info"),
          orderId: String(notification.orderId || ""),
          clickUrl: buildClickUrl(user, notification),
          title,
          body,
        },
        webpush: {
          headers: { TTL: "86400" },
        },
      },
    }),
  });

  if (response.ok) {
    return { ok: true, invalid: false };
  }

  let code = "";
  try {
    const errorBody = await response.json();
    code =
      errorBody?.error?.details?.find(
        (item) =>
          item["@type"] ===
          "type.googleapis.com/google.firebase.fcm.v1.FcmError"
      )?.errorCode || "";
  } catch {
    // Ignore malformed error bodies.
  }

  return {
    ok: false,
    invalid: code === "UNREGISTERED" || code === "INVALID_ARGUMENT",
  };
}

async function updateNotification(accessToken, documentName, fields) {
  const params = new URLSearchParams();

  for (const field of Object.keys(fields)) {
    params.append("updateMask.fieldPaths", field);
  }

  await firestoreRequest(
    \`\${FIRESTORE_BASE}/\${documentName}?\${params.toString()}\`,
    accessToken,
    {
      method: "PATCH",
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(fields).map(([key, value]) => [
            key,
            jsToFirestoreValue(value),
          ])
        ),
      }),
    }
  );
}

async function processPending(env) {
  if (!env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    throw new Error(
      "FIREBASE_SERVICE_ACCOUNT_JSON secret is not configured."
    );
  }

  const accessToken = await createGoogleAccessToken(
    env.FIREBASE_SERVICE_ACCOUNT_JSON
  );

  const pending = await findPendingNotifications(accessToken);

  if (pending.length === 0) {
    return { processed: 0 };
  }

  let processed = 0;

  for (const notification of pending) {
    if (!notification.fields.userId) {
      await updateNotification(accessToken, notification.name, {
        pushStatus: "invalid",
        pushProcessedAt: new Date().toISOString(),
      });
      processed++;
      continue;
    }

    const user = await getUser(
      accessToken,
      String(notification.fields.userId)
    );

    const tokens = Array.isArray(user.pushTokens)
      ? [...new Set(
          user.pushTokens.filter(
            (token) => typeof token === "string" && token.length > 0
          )
        )].slice(0, MAX_TOKENS_PER_USER)
      : [];

    if (tokens.length === 0) {
      await updateNotification(accessToken, notification.name, {
        pushStatus: "no_tokens",
        pushProcessedAt: new Date().toISOString(),
      });
      processed++;
      continue;
    }

    const results = [];

    for (const token of tokens) {
      results.push(
        await sendFcmMessage(
          accessToken,
          token,
          { ...notification.fields, id: notification.id },
          user
        )
      );
    }

    const successCount = results.filter((result) => result.ok).length;
    const invalidCount = results.filter((result) => result.invalid).length;

    await updateNotification(accessToken, notification.name, {
      pushStatus: successCount > 0 ? "sent" : "failed",
      pushProcessedAt: new Date().toISOString(),
      pushSuccessCount: successCount,
      pushFailureCount: results.length - successCount,
      pushInvalidTokenCount: invalidCount,
    });

    processed++;
  }

  return { processed };
}

export default {
  async scheduled(_controller, env) {
    try {
      const result = await processPending(env);
      console.log("TrustLine FCM Worker", result);
    } catch (error) {
      console.error("TrustLine FCM Worker error", error);
      throw error;
    }
  },

  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        ok: true,
        service: "trustline-fcm-push",
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};
