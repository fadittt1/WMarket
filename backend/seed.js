import mongoose from "mongoose";
import { Sticker } from "./src/models/Sticker.js";
import { Category } from "./src/models/Category.js";
import { Pack } from "./src/models/Pack.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/happy_helper";

const stickersData = [
  // Default ones
  { name: "Lunar Glow", price: 1.5, category: "Dreamy", emoji: "🌙", img: "", badge: "New" },
  { name: "Soft Fern", price: 1.2, category: "Nature", emoji: "🌿", img: "", badge: "" },
  { name: "Late Latte", price: 1.2, category: "Cozy", emoji: "☕", img: "", badge: "Hot" },
  { name: "Film Reel", price: 2.0, category: "Aesthetic", emoji: "🎞", img: "", badge: "" },
  { name: "Moonflower", price: 1.5, category: "Dreamy", emoji: "🌸", img: "", badge: "New" },
  { name: "Dark Wings", price: 1.8, category: "Dark", emoji: "🦋", img: "", badge: "" },

  // Cute
  { name: "Pink Heart", price: 1.5, category: "Cute", emoji: "💖", img: "/pics/pink-heart.png", badge: "Best Seller" },
  { name: "Star Boy", price: 1.2, category: "Cute", emoji: "🌟", img: "/pics/star-boy.png", badge: "" },
  { name: "Rainbow Cloud", price: 1.8, category: "Cute", emoji: "🌈", img: "/pics/rainbow-cloud.png", badge: "New" },
  
  // Vintage
  { name: "Retro Camera", price: 2.0, category: "Vintage", emoji: "📷", img: "/pics/retro-camera.png", badge: "" },
  { name: "Cassette Tape", price: 1.5, category: "Vintage", emoji: "📼", img: "/pics/cassette-tape.png", badge: "" },
  { name: "Old Telephone", price: 2.2, category: "Vintage", emoji: "☎️", img: "/pics/old-telephone.png", badge: "Limited" },
  
  // Nature
  { name: "Sunflower", price: 1.0, category: "Nature", emoji: "🌻", img: "/pics/sunflower.png", badge: "" },
  { name: "Monstera Leaf", price: 1.5, category: "Nature", emoji: "🌿", img: "/pics/monstera.png", badge: "Hot" },
  { name: "Red Mushroom", price: 1.3, category: "Nature", emoji: "🍄", img: "/pics/red-mushroom.png", badge: "" },
  { name: "Cactus Pot", price: 1.8, category: "Nature", emoji: "🌵", img: "/pics/cactus.png", badge: "Cute" },
  
  // Animals
  { name: "Derpy Dog", price: 1.5, category: "Animals", emoji: "🐶", img: "/pics/derpy-dog.png", badge: "" },
  { name: "Grumpy Cat", price: 1.5, category: "Animals", emoji: "😾", img: "/pics/grumpy-cat.png", badge: "Mood" },
  { name: "Lil Frog", price: 1.2, category: "Animals", emoji: "🐸", img: "/pics/lil-frog.png", badge: "" },
  { name: "Tiny Turtle", price: 1.4, category: "Animals", emoji: "🐢", img: "/pics/tiny-turtle.png", badge: "" },
  
  // Dreamy
  { name: "Crescent Moon", price: 1.6, category: "Dreamy", emoji: "🌙", img: "/pics/crescent-moon.png", badge: "Sparkle" },
  { name: "Sparkles", price: 1.0, category: "Dreamy", emoji: "✨", img: "/pics/sparkles.png", badge: "" },
  { name: "Crystal Ball", price: 2.5, category: "Dreamy", emoji: "🔮", img: "/pics/crystal-ball.png", badge: "Magic" },
  
  // Cozy
  { name: "Matcha Latte", price: 1.8, category: "Cozy", emoji: "🍵", img: "/pics/matcha-latte.png", badge: "" },
  { name: "Warm Coffee", price: 1.5, category: "Cozy", emoji: "☕", img: "/pics/warm-coffee.png", badge: "Hot" },
  { name: "Open Book", price: 2.0, category: "Cozy", emoji: "📖", img: "/pics/open-book.png", badge: "" }
];

const categoriesData = ["All", "Dreamy", "Nature", "Cozy", "Aesthetic", "Dark", "Cute", "Vintage", "Animals"];

async function runSeed() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to DB, clearing old data...");

    await Sticker.deleteMany({});
    await Category.deleteMany({});
    await Pack.deleteMany({});

    console.log("Seeding categories...");
    for (const c of categoriesData) {
      if (c !== "All") await Category.create({ name: c });
    }

    console.log("Seeding stickers...");
    const publicPath = path.join(__dirname, "../public");

    const createdStickers = [];
    for (const s of stickersData) {
      // Validate image path fallback
      if (s.img) {
        const fullPath = path.join(publicPath, s.img);
        if (!fs.existsSync(fullPath)) {
          console.warn(`[Warning] Image missing for ${s.name}, falling back to emoji...`);
          s.img = "";
        }
      }
      const newSticker = await Sticker.create(s);
      createdStickers.push(newSticker);
    }

    console.log("Seeding packs...");
    // Find IDs for default pack stickers
    const s1 = createdStickers.find(s => s.name === "Lunar Glow")?._id;
    const s2 = createdStickers.find(s => s.name === "Moonflower")?._id;
    const s3 = createdStickers.find(s => s.name === "Soft Fern")?._id;
    const s4 = createdStickers.find(s => s.name === "Dark Wings")?._id;

    const packsData = [
      { name: "Dreamy Starter Pack", description: "Begin your sticker journey with our most-loved dreamy designs.", price: 3.5, emoji: "✨", img: "", stickerIds: s1 && s2 ? [s1, s2] : [], visible: true, isHero: true },
      { name: "Nature Pack", description: "Fresh greens and natural vibes.", price: 2.5, emoji: "🌿", img: "", stickerIds: s3 ? [s3] : [], visible: true, isHero: false },
      { name: "Dark Mood Pack", description: "For the bold and moody aesthetic.", price: 3.0, emoji: "🦋", img: "", stickerIds: s4 ? [s4] : [], visible: true, isHero: false },
    ];

    for (const p of packsData) {
      await Pack.create(p);
    }

    console.log("Successfully seeded database!");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

runSeed();
