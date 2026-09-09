import express, { Request, Response, NextFunction } from 'express';
import session from 'express-session';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// 1. KRİTİK DÜZELTME: Render (Reverse Proxy) arkasında çalıştığı için IP ve protokol doğrul యేsi
app.set('trust proxy', 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Oturum ve Güvenli Çerez (Cookie) Yapılandırması
app.use(session({
  secret: process.env.SESSION_SECRET || 'trustline-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Render HTTPS kullandığı için canlıda true olmalı
    sameSite: 'lax',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 1 Gün
  }
}));

// API Rotalarınız buraya gelebilir...
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Vite / Frontend Statik Dosya Sunumu (Production)
const distPath = path.join(__dirname, '../dist');
app.use(express.static(distPath));

app.get('*', (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`Trustline Express Server running on http://0.0.0.0:${PORT}`);
});
