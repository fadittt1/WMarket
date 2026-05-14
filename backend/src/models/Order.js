import mongoose from "mongoose";

const OrderItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    qty: { type: Number, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true },
    notes: { type: String, default: "" },
    items: { type: [OrderItemSchema], required: true },
    total: { type: Number, required: true },
    status: { type: String, enum: ["pending", "done"], default: "pending" },
    date: { type: String, required: true },
  },
  { timestamps: true }
);

export const Order = mongoose.model("Order", OrderSchema);

