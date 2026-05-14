import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, unique: true }, // Empty string allowed
    password: { type: String, required: true },
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true }
);

export const User = mongoose.model("User", UserSchema);
