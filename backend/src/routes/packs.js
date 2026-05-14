import express from "express";
import { Pack } from "../models/Pack.js";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware.js";

export const router = express.Router();

router.get("/", async (req, res, next) => {
  try {
    const packs = await Pack.find().sort({ createdAt: 1 });
    res.json(packs);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name, description, price, emoji, img, productIds, visible, isHero } = req.body;
    if (!name || typeof price !== "number") {
      return res.status(400).json({ error: "name and price are required" });
    }
    const pack = await Pack.create({ name, description, price, emoji, img, productIds, visible, isHero });
    res.status(201).json(pack);
  } catch (err) {
    next(err);
  }
});

router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const updates = req.body || {};
    const pack = await Pack.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!pack) return res.status(404).json({ error: "Pack not found" });
    res.json(pack);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await Pack.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: "Pack not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.post("/:id/reactions", requireAuth, async (req, res, next) => {
  try {
    const { type } = req.body;
    if (!["love", "haha", "like"].includes(type)) {
      return res.status(400).json({ error: "Invalid reaction type" });
    }
    const pack = await Pack.findById(req.params.id);
    if (!pack) return res.status(404).json({ error: "Pack not found" });
    const reactions = pack.reactions || { love: 0, haha: 0, like: 0 };
    reactions[type] = (reactions[type] || 0) + 1;
    pack.reactions = reactions;
    pack.markModified("reactions");
    await pack.save();
    res.json(pack);
  } catch (err) {
    next(err);
  }
});

router.post("/:id/comments", requireAuth, async (req, res, next) => {
  try {
    const { author, text } = req.body;
    if (!author || !text) {
      return res.status(400).json({ error: "author and text are required" });
    }
    const pack = await Pack.findById(req.params.id);
    if (!pack) return res.status(404).json({ error: "Pack not found" });
    const comment = { author, text, date: new Date().toLocaleDateString("en-GB") };
    pack.comments = [...(pack.comments || []), comment];
    await pack.save();
    res.status(201).json(pack);
  } catch (err) {
    next(err);
  }
});

router.delete("/:packId/comments/:commentId", requireAdmin, async (req, res, next) => {
  try {
    const { packId, commentId } = req.params;
    const pack = await Pack.findById(packId);
    if (!pack) return res.status(404).json({ error: "Pack not found" });
    pack.comments = (pack.comments || []).filter(c => String(c._id) !== String(commentId));
    await pack.save();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.patch("/:packId/comments/:commentId", requireAdmin, async (req, res, next) => {
  try {
    const { packId, commentId } = req.params;
    const { text } = req.body;
    const pack = await Pack.findById(packId);
    if (!pack) return res.status(404).json({ error: "Pack not found" });
    const comments = pack.comments || [];
    const idx = comments.findIndex(c => String(c._id) === String(commentId));
    if (idx === -1) return res.status(404).json({ error: "Comment not found" });
    comments[idx].text = text ?? comments[idx].text;
    pack.comments = comments;
    await pack.save();
    res.json(pack);
  } catch (err) {
    next(err);
  }
});
