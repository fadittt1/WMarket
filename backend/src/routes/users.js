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

// ── Update a user's role (superAdmin only for admins; admin for regular users) ─
router.patch("/:id/role", requireAdmin, async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!["admin", "user"].includes(role)) {
      return res.status(400).json({ error: "Role must be 'admin' or 'user'" });
    }

    // Prevent any admin from touching themselves
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: "You cannot change your own role" });
    }

    const target = await User.findById(req.params.id).select("-password");
    if (!target) return res.status(404).json({ error: "User not found" });

    // Only superAdmin can promote/demote other admins
    if (target.role === "admin" && !req.user.superAdmin) {
      return res.status(403).json({ error: "Only the super admin can manage other admins" });
    }

    // Nobody can grant superAdmin via API
    if (target.superAdmin) {
      return res.status(403).json({ error: "The super admin account cannot be modified" });
    }

    target.role = role;
    await target.save();
    res.json({ ...target.toObject(), id: target._id });
  } catch (err) {
    next(err);
  }
});

// ── Delete a user (superAdmin for admins; admin for regular users) ─────────────
router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ error: "You cannot delete yourself" });
    }

    const target = await User.findById(req.params.id).select("-password");
    if (!target) return res.status(404).json({ error: "User not found" });

    if (target.superAdmin) {
      return res.status(403).json({ error: "The super admin account cannot be deleted" });
    }

    // Only superAdmin can delete other admins
    if (target.role === "admin" && !req.user.superAdmin) {
      return res.status(403).json({ error: "Only the super admin can delete other admins" });
    }

    await User.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
