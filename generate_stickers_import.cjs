const XLSX = require("xlsx");
const path = require("path");

const stickers = [
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

const ws = XLSX.utils.json_to_sheet(stickers);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Stickers");

const outputPath = path.join(__dirname, "stickers_import.xlsx");
XLSX.writeFile(wb, outputPath);

console.log(`Successfully generated ${outputPath} with ${stickers.length} stickers.`);
