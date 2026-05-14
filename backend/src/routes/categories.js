import express from "express";
import { Category } from "../models/Category.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

export const router = express.Router();

// Get all categories (public)
router.get("/", async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});

// Create category (admin)
router.post("/", requireAdmin, async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name is required" });
    const existing = await Category.findOne({ name });
    if (existing) return res.status(200).json(existing);
    const category = await Category.create({ name });
    res.status(201).json(category);
  } catch (err) {
    next(err);
  }
});

// Delete category (admin)
router.delete("/:name", requireAdmin, async (req, res, next) => {
  try {
    const result = await Category.findOneAndDelete({ name: req.params.name });
    if (!result) return res.status(404).json({ error: "Category not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

