import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { User } from "./src/models/User.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, ".env") });

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ phone: "27737131" });
  if (!user) {
    console.error("User with phone 27737131 not found.");
    process.exit(1);
  }
  user.superAdmin = true;
  user.role = "admin";
  await user.save();
  console.log(`✅ ${user.name} (${user.phone}) is now marked as superAdmin.`);
  await mongoose.disconnect();
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
