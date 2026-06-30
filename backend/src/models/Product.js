import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema(
  {
    author: { type: String, required: true },
    text: { type: String, required: true },
    date: { type: String, required: true },
  },
  { _id: true }
);

const ReactionsSchema = new mongoose.Schema(
  {
    love: { type: Number, default: 0 },
    haha: { type: Number, default: 0 },
    like: { type: Number, default: 0 },
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    // Stable identity of a row coming from an external sheet sync (e.g. a barcode).
    // Sparse + unique so manually-added products (no sourceKey) are unaffected, and
    // re-syncing the same row updates in place instead of creating duplicates.
    sourceKey: { type: String, default: null, index: { unique: true, sparse: true } },
    category: { type: String, default: "" },
    categories: { type: [String], default: [] },
    emoji: { type: String, default: "📦" },
    img: { type: String, default: "" }, // base64 or URL
    badge: { type: String, default: "" },
    // Stock status from the sheet's Etat field: available (En cours), sold (Vendu),
    // or unavailable (Non trouver). Sold/unavailable items are shown but can't be ordered.
    status: { type: String, enum: ["available", "sold", "unavailable"], default: "available" },
    // Homme / Femme (or empty) — shown as a badge for shoes/clothes.
    sex: { type: String, default: "" },
    packOnly: { type: Boolean, default: false },
    reactions: { type: ReactionsSchema, default: () => ({}) },
    comments: { type: [CommentSchema], default: [] },
  },
  { timestamps: true }
);

// Third argument keeps the existing "stickers" collection name for backward compatibility
export const Product = mongoose.model("Product", ProductSchema, "stickers");
