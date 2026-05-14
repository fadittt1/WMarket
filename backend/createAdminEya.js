import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { User } from "./src/models/User.js";

dotenv.config();

async function createAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    // Check if user already exists
    const existing = await User.findOne({ phone: "54999568" });
    if (existing) {
      // Update role to admin and reset password
      existing.role = "admin";
      existing.name = "eya";
      const salt = await bcrypt.genSalt(12);
      existing.password = await bcrypt.hash("stickyy2026", salt);
      await existing.save();
      console.log("SUCCESS: Existing user updated to admin!");
    } else {
      // Create new admin user
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash("stickyy2026", salt);
      await User.create({
        name: "eya",
        phone: "54999568",
        password: hashedPassword,
        role: "admin",
      });
      console.log("SUCCESS: Admin user 'eya' created!");
    }

    console.log("Phone: 54999568 | Role: admin");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    mongoose.connection.close();
  }
}

createAdmin();
