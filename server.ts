import express, { Request, Response, NextFunction } from "express";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set("trust proxy", 1);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "trustline-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
    },
  }),
);

app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// Vite build çıktısı.
// server.js -> dist/server.js
// Frontend -> dist/
const distPath = path.resolve(__dirname);

app.use(express.static(distPath));

app.get("*", (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  res.sendFile(path.join(distPath, "index.html"));
});

const PORT = Number(process.env.PORT) || 10000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Trustline Express Server running on http://0.0.0.0:${PORT}`,
  );
});