import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { User } from "../models/User.js";

export const router = express.Router();


// ── Rate limiters ─────────────────────────────────────────────────────────────
// Max 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please try again in 15 minutes." },
});

// Max 5 registrations per hour per IP
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many registration attempts. Please try again later." },
});

// ── Register ──────────────────────────────────────────────────────────────────
router.post("/register", registerLimiter, async (req, res, next) => {
  try {
    const { name, phone, password } = req.body;

    if (!name || typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({ error: "Please provide a valid name (at least 2 characters)" });
    }
    if (typeof phone !== "string" || phone.trim().length < 6) {
      return res.status(400).json({ error: "Please provide a valid phone number" });
    }
    if (!password || typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const normalizedPhone = phone.trim();

    const existing = await User.findOne({ phone: normalizedPhone });
    if (existing) {
      return res.status(400).json({ error: "Phone number already in use" });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      name: name.trim(),
      phone: normalizedPhone,
      password: hashedPassword,
      role: "user",
    });

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(201).json({
      user: { id: user._id, name: user.name, phone: user.phone, role: user.role },
      token,
    });
  } catch (err) {
    next(err);
  }
});

// ── Login ─────────────────────────────────────────────────────────────────────
router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (typeof phone !== "string" || !phone.trim()) {
      return res.status(400).json({ error: "Phone and password are required" });
    }
    if (!password || typeof password !== "string") {
      return res.status(400).json({ error: "Phone and password are required" });
    }

    const user = await User.findOne({ phone: phone.trim() });
    // Avoid timing attacks: always run bcrypt.compare even if user not found
    const dummyHash = "$2b$12$invalidhashfortimingnormalization";
    const isMatch = user
      ? await bcrypt.compare(password, user.password)
      : await bcrypt.compare(password, dummyHash).then(() => false);

    if (!user || !isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      user: { id: user._id, name: user.name, phone: user.phone, role: user.role },
      token,
    });
  } catch (err) {
    next(err);
  }
});
