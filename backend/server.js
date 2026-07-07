import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load backend/.env BEFORE any imports that depend on env vars
dotenv.config({ path: path.join(__dirname, ".env") });

import { router as productsRouter } from "./src/routes/products.js";
import { router as ordersRouter } from "./src/routes/orders.js";
import { router as categoriesRouter } from "./src/routes/categories.js";
import { router as packsRouter } from "./src/routes/packs.js";
import { router as authRouter } from "./src/routes/auth.js";
import { router as uploadRouter } from "./src/routes/upload.js";
import { router as usersRouter } from "./src/routes/users.js";
import { syncRouter } from "./src/routes/sync.js";
import { syncFromSheets } from "./src/lib/sheetSync.js";
import { dbConnect } from "./src/lib/mongodb.js";

// ── Mandatory env guards ──────────────────────────────────────────────────────
let missingEnvs = [];
if (!process.env.MONGODB_URI) missingEnvs.push("MONGODB_URI");
if (!process.env.JWT_SECRET) missingEnvs.push("JWT_SECRET");
if (!process.env.ADMIN_PASSWORD) missingEnvs.push("ADMIN_PASSWORD");

if (missingEnvs.length > 0) {
  console.error(`FATAL: Missing environment variables: ${missingEnvs.join(", ")}`);
  if (!process.env.VERCEL) {
    process.exit(1);
  } else {
    console.error("Running on Vercel without mandatory env variables. API requests may fail.");
  }
}

const app = express();
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";

// ── Security headers ──────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled because the SPA manages its own CSP needs
    crossOriginEmbedderPolicy: false,
  })
);

// ── CORS — lock down to your deployed origin in production ────────────────────
const allowedOrigins = isProduction
  ? [
      process.env.FRONTEND_URL, // Manually set
      "https://www.wmarket.tn/", // Main production domain
      "https://wmarket.tn/"
    ].filter(Boolean)
  : ["http://localhost:8080", "http://localhost:3000", "http://localhost:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Render's health checks)
      if (!origin) return callback(null, true);
      
      // Exact match check
      if (allowedOrigins.includes(origin)) return callback(null, true);
      
      // Dynamic check for Vercel preview branches
      if (isProduction && origin.endsWith(".vercel.app")) {
        return callback(null, true);
      }
      
      callback(new Error(`CORS: Origin '${origin}' not allowed`));
    },
    credentials: true,
  })
);

// ── Request logging ───────────────────────────────────────────────────────────
app.use(morgan(isProduction ? "combined" : "dev"));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ── Database Connection Middleware ────────────────────────────────────────────
// Ensures MongoDB is connected before handling any API requests, especially important for serverless.
app.use("/api", async (req, res, next) => {
  if (req.path === "/health") return next(); // Skip DB check for simple health check
  try {
    await dbConnect();
    next();
  } catch (error) {
    console.error("Database connection error in middleware:", error);
    res.status(500).json({ error: "Database connection failed" });
  }
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/packs", packsRouter);
app.use("/api/auth", authRouter);
app.use("/api/upload", uploadRouter);
app.use("/api/users", usersRouter);
app.use("/api/sync", syncRouter);

// ── Static frontend (only in non-Vercel environments like Render) ─────────────
if (!process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, "../dist")));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(__dirname, "../dist/index.html"));
  });
}

// ── Global error handler ─────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err.status || 500;
  // Never leak stack traces or internal messages to the client in production
  if (isProduction) {
    console.error(`[${new Date().toISOString()}] ${status} ${req.method} ${req.path}:`, err.message);
    res.status(status).json({
      error: status < 500 ? err.message : "Internal server error",
    });
  } else {
    console.error(err);
    res.status(status).json({ error: err.message, stack: err.stack });
  }
});

// ── Database & server startup ─────────────────────────────────────────────────
// Only start the server locally or on Render. Vercel handles this automatically.
if (!process.env.VERCEL) {
  dbConnect()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT} [${isProduction ? "production" : "development"}]`);
      });

      // ── Periodic sheet sync (while the server is awake) ──────────────────────
      // Serverless platforms can't run timers — there, use an external cron hitting
      // POST /api/sync/run with the SYNC_SECRET header instead.
      const intervalMin = Number(process.env.SYNC_INTERVAL_MINUTES) || 15;
      const runSync = () =>
        syncFromSheets()
          .then((r) => console.log(`[sync] upserted=${r.upserted} removed=${r.removed} skipped=${r.skipped} errors=${r.errors.length}`))
          .catch((e) => console.error("[sync] failed:", e.message));
      runSync(); // initial run shortly after boot
      setInterval(runSync, intervalMin * 60 * 1000);
    })
    .catch((err) => {
      console.error("Initial MongoDB connection error:", err);
      process.exit(1);
    });
}

// ── Export app for Vercel Serverless Functions ───────────────────────────────
export default app;
