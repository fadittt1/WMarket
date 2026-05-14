import express from "express";
import { Sticker } from "../models/Sticker.js";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware.js";

export const router = express.Router();

// Get all stickers
router.get("/", async (req, res, next) => {
  try {
    const stickers = await Sticker.find().sort({ createdAt: 1 });
    res.json(stickers);
  } catch (err) {
    next(err);
  }
});

// Create sticker (admin)
router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name, price, category, categories, emoji, img, badge, packOnly } = req.body;
    if (!name || typeof price !== "number") {
      return res.status(400).json({ error: "name and price are required" });
    }
    const cats = Array.isArray(categories) && categories.length > 0 ? categories : (category ? [category] : ["General"]);
    const sticker = await Sticker.create({ name, price, category: cats[0] || "General", categories: cats, emoji, img, badge, packOnly: !!packOnly });
    res.status(201).json(sticker);
  } catch (err) {
    next(err);
  }
});

// Update sticker (admin)
router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const updates = req.body || {};
    const sticker = await Sticker.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!sticker) return res.status(404).json({ error: "Sticker not found" });
    res.json(sticker);
  } catch (err) {
    next(err);
  }
});

// Delete sticker (admin)
router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await Sticker.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: "Sticker not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Add reaction
router.post("/:id/reactions", requireAuth, async (req, res, next) => {
  try {
    const { type } = req.body;
    if (!["love", "haha", "like"].includes(type)) {
      return res.status(400).json({ error: "Invalid reaction type" });
    }
    const sticker = await Sticker.findById(req.params.id);
    if (!sticker) return res.status(404).json({ error: "Sticker not found" });
    const reactions = sticker.reactions
      ? { love: sticker.reactions.love, haha: sticker.reactions.haha, like: sticker.reactions.like }
      : { love: 0, haha: 0, like: 0 };
    reactions[type] = (reactions[type] || 0) + 1;
    sticker.reactions = reactions;
    sticker.markModified("reactions");
    await sticker.save();
    res.json(sticker);
  } catch (err) {
    next(err);
  }
});

// Add comment
router.post("/:id/comments", requireAuth, async (req, res, next) => {
  try {
    const { author, text } = req.body;
    if (!author || !text) {
      return res.status(400).json({ error: "author and text are required" });
    }
    const sticker = await Sticker.findById(req.params.id);
    if (!sticker) return res.status(404).json({ error: "Sticker not found" });
    const comment = {
      author,
      text,
      date: new Date().toLocaleDateString("en-GB"),
    };
    sticker.comments = [...(sticker.comments || []), comment];
    await sticker.save();
    res.status(201).json(sticker);
  } catch (err) {
    next(err);
  }
});

// Delete comment (admin)
router.delete("/:stickerId/comments/:commentId", requireAdmin, async (req, res, next) => {
  try {
    const { stickerId, commentId } = req.params;
    const sticker = await Sticker.findById(stickerId);
    if (!sticker) return res.status(404).json({ error: "Sticker not found" });
    sticker.comments = (sticker.comments || []).filter(
      (c) => String(c._id) !== String(commentId)
    );
    await sticker.save();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Edit comment (admin)
router.patch("/:stickerId/comments/:commentId", requireAdmin, async (req, res, next) => {
  try {
    const { stickerId, commentId } = req.params;
    const { text } = req.body;
    const sticker = await Sticker.findById(stickerId);
    if (!sticker) return res.status(404).json({ error: "Sticker not found" });
    const comments = sticker.comments || [];
    const idx = comments.findIndex((c) => String(c._id) === String(commentId));
    if (idx === -1) return res.status(404).json({ error: "Comment not found" });
    comments[idx].text = text ?? comments[idx].text;
    sticker.comments = comments;
    await sticker.save();
    res.json(sticker);
  } catch (err) {
    next(err);
  }
});

