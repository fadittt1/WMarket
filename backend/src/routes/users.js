import express from "express";
import { User } from "../models/User.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

export const router = express.Router();

// ── List all users (admin only) ───────────────────────────────────────────────
router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// ── Update a user's role (admin only) ─────────────────────────────────────────
router.patch("/:id/role", requireAdmin, async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!["admin", "user"].includes(role)) {
      return res.status(400).json({ error: "Role must be 'admin' or 'user'" });
    }
    // Prevent admin from accidentally demoting themselves
    if (req.user._id.toString() === req.params.id && role === "user") {
      return res.status(400).json({ error: "You cannot demote yourself" });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// ── Delete a user (admin only) ────────────────────────────────────────────────
router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: "You cannot delete yourself" });
    }
    const result = await User.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: "User not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
