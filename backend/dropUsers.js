import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/happy_helper";

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    await mongoose.connection.collection("users").drop();
    console.log("Old Users collection dropped successfully");
  } catch (e) {
    console.error("Collection drop ignored or failed: ", e.message);
  } finally {
    process.exit(0);
  }
}

run();
