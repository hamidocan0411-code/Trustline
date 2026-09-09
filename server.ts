import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Render (Reverse Proxy) arkasında çalıştığı için IP ve protokol doğrulaması
app.set('trust proxy', 1);

/**
 * ============================================================
 * FIREBASE AUTH REDIRECT PROXY
 * ============================================================
 *
 * Trustline Express Render üzerinde çalışıyor.
 *
 * Firebase Auth redirect helper normalde:
 *
 * https://trustline-8729d.firebaseapp.com/__/auth/...
 *
 * adresini kullanıyor.
 *
 * Burada bu istekleri kendi domainimiz üzerinden Firebase'e
 * transparan şekilde iletiyoruz:
 *
 * https://trustlineexpress.com.tr/__/auth/...
 *              ↓
 * https://trustline-8729d.firebaseapp.com/__/auth/...
 *
 * Bu bölüm express.json(), session ve static dosyalardan
 * ÖNCE çalışmalıdır.
 */
app.use('/__/auth', (req: Request, res: Response) => {
  const targetHost = 'trustline-8729d.firebaseapp.com';

  const targetPath = `/__/auth${req.url}`;

  console.log('🔥 Firebase Auth Proxy:', {
    method: req.method,
    path: targetPath,
    host: targetHost,
  });

  const headers: Record<string, string | string[] | undefined> = {
    ...req.headers,
    host: targetHost,
  };

  // Hop-by-hop header'ları Firebase'e göndermiyoruz.
  delete headers.connection;
  delete headers['keep-alive'];
  delete headers['proxy-authenticate'];
  delete headers['proxy-authorization'];
  delete headers.te;
  delete headers.trailer;
  delete headers['transfer-encoding'];
  delete headers.upgrade;

  const proxyRequest = https.request(
    {
      hostname: targetHost,
      port: 443,
      path: targetPath,
      method: req.method,
      headers,
      servername: targetHost,
    },
    (proxyResponse) => {
      console.log('🔥 Firebase Auth Proxy Response:', {
        statusCode: proxyResponse.statusCode,
        path: targetPath,
      });

      // Firebase'in response header'larını mümkün olduğunca koru.
      Object.entries(proxyResponse.headers).forEach(
        ([key, value]) => {
          if (value !== undefined) {
            res.setHeader(key, value);
          }
        }
      );

      res.status(proxyResponse.statusCode || 200);

      proxyResponse.pipe(res);
    }
  );

  proxyRequest.on('error', (error) => {
    console.error('❌ Firebase Auth Proxy Hatası:', error);

    if (!res.headersSent) {
      res.status(502).json({
        error: 'Firebase Auth proxy error',
        message: error.message,
      });
    } else {
      res.end();
    }
  });

  req.pipe(proxyRequest);
});

/**
 * ============================================================
 * NORMAL EXPRESS MIDDLEWARE
 * ============================================================
 */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Oturum ve Güvenli Çerez (Cookie) Yapılandırması
app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      'trustline-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure:
        process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  })
);

/**
 * ============================================================
 * API ROTALARI
 * ============================================================
 */

app.get(
  '/api/health',
  (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }
);

/**
 * ============================================================
 * VITE / FRONTEND STATİK DOSYA SUNUMU
 * ============================================================
 */

const distPath = path.join(
  __dirname,
  '../dist'
);

app.use(express.static(distPath));

app.get(
  '*',
  (
    req: Request,
    res: Response,
    next: NextFunction
  ) => {
    if (req.path.startsWith('/api')) {
      return next();
    }

    // Firebase Auth proxy istekleri buraya düşmemeli.
    if (req.path.startsWith('/__/auth')) {
      return next();
    }

    res.sendFile(
      path.join(
        distPath,
        'index.html'
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
  process.env.PORT || 10000;

app.listen(
  Number(PORT),
  '0.0.0.0',
  () => {
    console.log(
      `Trustline Express Server running on http://0.0.0.0:${PORT}`
    );
  }
);
