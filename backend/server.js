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
      process.env.FRONTEND_URL, // Set this in Render: https://your-app.onrender.com
    ].filter(Boolean)
  : ["http://localhost:8080", "http://localhost:3000", "http://localhost:5173"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Render's health checks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
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

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/packs", packsRouter);
app.use("/api/auth", authRouter);
app.use("/api/upload", uploadRouter);

// ── Serve static frontend in production ──────────────────────────────────────
app.use(express.static(path.join(__dirname, "../dist")));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

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
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/missing_uri")
  .then(() => {
    console.log("Connected to MongoDB");
    // Only start the server locally or on Render. Vercel handles this automatically.
    if (!process.env.VERCEL) {
      app.listen(PORT, () => {
        console.log(`Server listening on port ${PORT} [${isProduction ? "production" : "development"}]`);
      });
    }
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    if (!process.env.VERCEL) process.exit(1);
  });

// ── Export app for Vercel Serverless Functions ───────────────────────────────
export default app;
