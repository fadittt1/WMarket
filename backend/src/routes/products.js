import express from "express";
import { Product } from "../models/Product.js";
import { requireAdmin, requireAuth } from "../middleware/auth.middleware.js";

export const router = express.Router();

// Get all products
router.get("/", async (req, res, next) => {
  try {
    const products = await Product.find().sort({ createdAt: 1 });
    res.json(products);
  } catch (err) {
    next(err);
  }
});

// Create product (admin)
router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name, price, category, categories, emoji, img, badge, packOnly } = req.body;
    if (!name || typeof price !== "number") {
      return res.status(400).json({ error: "name and price are required" });
    }
    const cats = Array.isArray(categories) && categories.length > 0 ? categories : (category ? [category] : ["General"]);
    const product = await Product.create({ name, price, category: cats[0] || "General", categories: cats, emoji, img, badge, packOnly: !!packOnly });
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// Update product (admin)
router.put("/:id", requireAdmin, async (req, res, next) => {
  try {
    const updates = req.body || {};
    const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// Delete product (admin)
router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await Product.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: "Product not found" });
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
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    const reactions = product.reactions
      ? { love: product.reactions.love, haha: product.reactions.haha, like: product.reactions.like }
      : { love: 0, haha: 0, like: 0 };
    reactions[type] = (reactions[type] || 0) + 1;
    product.reactions = reactions;
    product.markModified("reactions");
    await product.save();
    res.json(product);
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
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });
    const comment = {
      author,
      text,
      date: new Date().toLocaleDateString("en-GB"),
    };
    product.comments = [...(product.comments || []), comment];
    await product.save();
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
});

// Delete comment (admin)
router.delete("/:productId/comments/:commentId", requireAdmin, async (req, res, next) => {
  try {
    const { productId, commentId } = req.params;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: "Product not found" });
    product.comments = (product.comments || []).filter(
      (c) => String(c._id) !== String(commentId)
    );
    await product.save();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// Edit comment (admin)
router.patch("/:productId/comments/:commentId", requireAdmin, async (req, res, next) => {
  try {
    const { productId, commentId } = req.params;
    const { text } = req.body;
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: "Product not found" });
    const comments = product.comments || [];
    const idx = comments.findIndex((c) => String(c._id) === String(commentId));
    if (idx === -1) return res.status(404).json({ error: "Comment not found" });
    comments[idx].text = text ?? comments[idx].text;
    product.comments = comments;
    await product.save();
    res.json(product);
  } catch (err) {
    next(err);
  }
});
