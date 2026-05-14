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

const PackSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    emoji: { type: String, default: "📦" },
    img: { type: String, default: "" },
    productIds: { type: [String], default: [] },
    visible: { type: Boolean, default: true },
    isHero: { type: Boolean, default: false },
    reactions: { type: ReactionsSchema, default: () => ({}) },
    comments: { type: [CommentSchema], default: [] },
  },
  { timestamps: true }
);

export const Pack = mongoose.model("Pack", PackSchema, "packs");
