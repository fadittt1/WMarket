import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "./src/models/User.js";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/happy_helper";

async function run() {
  await mongoose.connect(MONGODB_URI);
  const phone = ""; // Blank phone for admin bypass
  const password = "admin26";
  const existing = await User.findOne({ phone });
  try {
    if (!existing) {
      const salt = await bcrypt.genSalt(10);
      const hashed = await bcrypt.hash(password, salt);
      await User.create({ name: "Eya", phone, password: hashed, role: "admin" });
      console.log("Admin created");
    } else {
      const salt = await bcrypt.genSalt(10);
      existing.password = await bcrypt.hash(password, salt);
      existing.name = "Eya";
      existing.role = "admin";
      await existing.save();
      console.log("Admin updated");
    }
  } catch(e) { console.error(e); }
  process.exit(0);
}
run();
