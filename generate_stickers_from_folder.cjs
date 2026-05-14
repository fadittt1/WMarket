const XLSX = require("xlsx");
const path = require("path");

// ── Sticker data matched to actual images in /stickers folder ─────────────────
// img field = relative path to the image file (for reference only;
// you'll need to upload each image to Cloudinary and paste the URL back in)
//
// MULTI-CATEGORY: separate multiple categories with a comma, e.g. "Anime, One Piece"
// The importer will split by comma and assign all listed categories to the sticker.
const stickers = [
  {
    name: "Chopper",
    price: 0.5,
    category: "Anime, One Piece",
    img: "stickers/WhatsApp Image 2026-04-05 at 00.04.45.jpeg",
    badge: "One Piece",
  },
  {
    name: "Chopper Hat",
    price: 0.5,
    category: "Anime, One Piece",
    img: "stickers/WhatsApp Image 2026-04-05 at 00.04.45 (1).jpeg",
    badge: "One Piece",
  },
  {
    name: "Naruto Ramen",
    price: 0.5,
    category: "Anime, Naruto",
    img: "stickers/WhatsApp Image 2026-04-05 at 00.04.45 (2).jpeg",
    badge: "Naruto",
  },
  {
    name: "Anime Girl",
    price: 0.5,
    category: "Anime, Cute",
    img: "stickers/WhatsApp Image 2026-04-05 at 00.04.45 (3).jpeg",
    badge: "",
  },
  {
    name: "Bakugo",
    price: 0.5,
    category: "Anime, My Hero Academia",
    img: "stickers/WhatsApp Image 2026-04-05 at 00.04.46.jpeg",
    badge: "MHA",
  },
  {
    name: "Nanami",
    price: 0.5,
    category: "Anime, Jujutsu Kaisen",
    img: "stickers/WhatsApp Image 2026-04-05 at 00.04.46 (1).jpeg",
    badge: "JJK",
  },
  {
    name: "Megumi Fushiguro",
    price: 0.5,
    category: "Anime, Jujutsu Kaisen",
    img: "stickers/WhatsApp Image 2026-04-05 at 00.04.46 (2).jpeg",
    badge: "JJK",
  },
  {
    name: "Toji Fushiguro",
    price: 0.5,
    category: "Anime, Jujutsu Kaisen",
    img: "stickers/WhatsApp Image 2026-04-05 at 00.04.46 (3).jpeg",
    badge: "JJK",
  },
  {
    name: "Roronoa Zoro",
    price: 0.5,
    category: "Anime, One Piece",
    img: "stickers/WhatsApp Image 2026-04-05 at 00.04.47.jpeg",
    badge: "One Piece",
  },
  {
    name: "One Piece Logo",
    price: 0.5,
    category: "Anime, One Piece",
    img: "stickers/WhatsApp Image 2026-04-05 at 00.04.47 (1).jpeg",
    badge: "One Piece",
  },
];

const ws = XLSX.utils.json_to_sheet(stickers);

// Auto-size columns
const colWidths = Object.keys(stickers[0]).map((key) => ({
  wch: Math.max(key.length, ...stickers.map((s) => String(s[key]).length)) + 2,
}));
ws["!cols"] = colWidths;

const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Stickers");

const outputPath = path.join(__dirname, "stickers_to_import.xlsx");
XLSX.writeFile(wb, outputPath);

console.log(`✅ Generated ${outputPath} with ${stickers.length} stickers.`);
console.log(`\n⚠️  NOTE: The 'img' column contains local file paths.`);
console.log(`   After uploading images to Cloudinary, paste the Cloudinary URLs`);
console.log(`   into the 'img' column before importing into the Admin panel.\n`);
