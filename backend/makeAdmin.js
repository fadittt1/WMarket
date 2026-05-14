import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "./src/models/User.js";

dotenv.config();

const phoneNum = process.argv[2];

if (!phoneNum) {
  console.error("Please provide a phone number.");
  process.exit(1);
}

async function makeAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const user = await User.findOne({ phone: phoneNum });
    if (!user) {
      console.log(`User with phone ${phoneNum} not found.`);
      process.exit(1);
    }

    user.role = "admin";
    await user.save();
    
    console.log(`SUCCESS: User ${user.name} (${user.phone}) is now an admin!`);
  } catch (err) {
    console.error("Error making user admin:", err);
  } finally {
    mongoose.connection.close();
  }
}

makeAdmin();
