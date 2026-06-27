import express from "express";
import { requireAdmin } from "../middleware/auth.middleware.js";
import { getSyncConfig, SyncConfig } from "../models/SyncConfig.js";
import { syncFromSheets } from "../lib/sheetSync.js";

export const router = express.Router();

// Allow an external scheduler (cron-job.org, Vercel Cron, etc.) to trigger a sync
// without an admin token, by sending the shared secret. Falls back to admin auth.
function allowCronOrAdmin(req, res, next) {
  const secret = process.env.SYNC_SECRET;
  const provided = req.get("x-sync-key") || req.query.key;
  if (secret && provided && provided === secret) return next();
  return requireAdmin(req, res, next);
}

// ── Get current sync config + last run info (admin) ───────────────────────────
router.get("/config", requireAdmin, async (_req, res, next) => {
  try {
    const cfg = await getSyncConfig();
    res.json({ sources: cfg.sources, lastRunAt: cfg.lastRunAt, lastReport: cfg.lastReport });
  } catch (err) {
    next(err);
  }
});

// ── Replace the list of sheet sources (admin) ─────────────────────────────────
router.put("/config", requireAdmin, async (req, res, next) => {
  try {
    const { sources } = req.body || {};
    if (!Array.isArray(sources)) {
      return res.status(400).json({ error: "sources must be an array" });
    }
    const clean = sources
      .map((s) => ({ label: String(s?.label || "").trim(), url: String(s?.url || "").trim() }))
      .filter((s) => s.url);
    // Reject obviously wrong URLs early.
    for (const s of clean) {
      if (!/^https?:\/\//i.test(s.url)) {
        return res.status(400).json({ error: `Invalid URL: ${s.url}` });
      }
    }
    const cfg = await getSyncConfig();
    await SyncConfig.updateOne({ _id: cfg._id }, { $set: { sources: clean } });
    res.json({ sources: clean });
  } catch (err) {
    next(err);
  }
});

// ── Run a sync now (admin or cron secret) ─────────────────────────────────────
router.post("/run", allowCronOrAdmin, async (_req, res, next) => {
  try {
    const report = await syncFromSheets();
    res.json(report);
  } catch (err) {
    next(err);
  }
});

export { router as syncRouter };
