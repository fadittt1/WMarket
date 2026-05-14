import express from "express";
import nodemailer from "nodemailer";
import { Order } from "../models/Order.js";
import { requireAdmin } from "../middleware/auth.middleware.js";

export const router = express.Router();

// ── Email transporter — only initialised if credentials are present ────────────
function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return null;
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

// ── Get all orders (admin only) ───────────────────────────────────────────────
router.get("/", requireAdmin, async (req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    next(err);
  }
});

// ── Create order (public) ─────────────────────────────────────────────────────
router.post("/", async (req, res, next) => {
  try {
    const { name, phone, notes, items, total } = req.body;

    if (
      !name ||
      typeof name !== "string" ||
      !phone ||
      typeof phone !== "string" ||
      !Array.isArray(items) ||
      items.length === 0 ||
      typeof total !== "number" ||
      total <= 0
    ) {
      return res.status(400).json({ error: "Invalid order payload" });
    }

    const order = await Order.create({
      name: name.trim(),
      phone: phone.trim(),
      notes: typeof notes === "string" ? notes.trim() : "",
      items,
      total,
      status: "pending",
      date: new Date().toLocaleDateString("en-GB"),
    });

    // Send email notification non-blocking, only if email is configured
    const transporter = getTransporter();
    if (transporter) {
      const emailText = [
        `New Order from ${name}!`,
        ``,
        `Phone: ${phone}`,
        `Total: ${total} TND`,
        `Notes: ${notes || "—"}`,
        ``,
        `Items:`,
        ...items.map((i) => `  - ${i.qty}x ${i.name}`),
      ].join("\n");

      transporter
        .sendMail({
          from: `"Store Notifications" <${process.env.EMAIL_USER}>`,
          to: process.env.EMAIL_USER,
          subject: `New Order! ${total} TND — ${name}`,
          text: emailText,
        })
        .catch((e) => console.error("Email notification failed:", e.message));
    }

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});

// ── Mark order as done (admin only) ──────────────────────────────────────────
router.patch("/:id/done", requireAdmin, async (req, res, next) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: "done" },
      { new: true }
    );
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

// ── Delete order (admin only) ─────────────────────────────────────────────────
router.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const result = await Order.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ error: "Order not found" });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
