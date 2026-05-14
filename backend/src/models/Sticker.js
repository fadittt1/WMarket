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

const StickerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    price: { type: Number, required: true },
    category: { type: String, default: "" },
    categories: { type: [String], default: [] },
    emoji: { type: String, default: "🌸" },
    img: { type: String, default: "" }, // base64 or URL
    badge: { type: String, default: "" },
    packOnly: { type: Boolean, default: false },
    reactions: { type: ReactionsSchema, default: () => ({}) },
    comments: { type: [CommentSchema], default: [] },
  },
  { timestamps: true }
);

export const Sticker = mongoose.model("Sticker", StickerSchema);

