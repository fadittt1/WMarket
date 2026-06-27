import express from "express";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import twilio from "twilio";
import { Order } from "../models/Order.js";
import { Product } from "../models/Product.js";
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

// ── Twilio WhatsApp notification ──────────────────────────────────────────────
// Sends a WhatsApp message to the admin number using the Twilio sandbox / production account.
// Required env vars: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM, ADMIN_WHATSAPP_TO
function sendWhatsApp(order) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM; // e.g. "whatsapp:+14155238886" (sandbox) or your approved number
  const to = process.env.ADMIN_WHATSAPP_TO;      // e.g. "whatsapp:+21627737131"

  if (!sid || !token || !from || !to) return; // Silently skip if not configured

  const client = twilio(sid, token);

  const itemLines = order.items.map((i) => `  • ${i.qty}x ${i.name} — ${i.price.toFixed(3)} TND`).join("\n");
  const body = [
    `🛒 *New Order Received!*`,
    ``,
    `👤 *Name:* ${order.name}`,
    `📞 *Phone:* ${order.phone}`,
    ``,
    `*Items:*`,
    itemLines,
    ``,
    `💰 *Total:* ${order.total.toFixed(3)} TND`,
    order.notes ? `📝 *Notes:* ${order.notes}` : null,
  ].filter(Boolean).join("\n");

  client.messages
    .create({ from, to, body })
    .then((msg) => console.log(`[Twilio] WhatsApp sent — SID: ${msg.sid}`))
    .catch((err) => console.error("[Twilio] WhatsApp error:", err.message));
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
    const { name, phone, notes, items } = req.body;

    if (
      !name ||
      typeof name !== "string" ||
      !phone ||
      typeof phone !== "string" ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({ error: "Invalid order payload" });
    }

    // ── Recompute prices & total from the database ────────────────────────────
    // Never trust client-supplied prices/total — look each product up by id and
    // use the authoritative price from MongoDB.
    const ids = items
      .map((i) => i?.id)
      .filter((id) => typeof id === "string" && mongoose.isValidObjectId(id));

    const products = await Product.find({ _id: { $in: ids } });
    const productById = new Map(products.map((p) => [String(p._id), p]));

    const validatedItems = [];
    let total = 0;
    for (const item of items) {
      const product = productById.get(String(item?.id));
      if (!product) {
        return res.status(400).json({ error: "One or more products are no longer available" });
      }
      const qty = Number(item?.qty);
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: "Invalid quantity in order" });
      }
      validatedItems.push({ name: product.name, qty, price: product.price });
      total += product.price * qty;
    }

    if (total <= 0) {
      return res.status(400).json({ error: "Invalid order total" });
    }

    const order = await Order.create({
      name: name.trim(),
      phone: phone.trim(),
      notes: typeof notes === "string" ? notes.trim() : "",
      items: validatedItems,
      total,
      status: "pending",
      date: new Date().toLocaleDateString("en-GB"),
    });

    // ── Fire-and-forget notifications (non-blocking) ──────────────────────────
    // 1. WhatsApp via Twilio
    sendWhatsApp(order);

    // 2. Email notification (if configured)
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
