import { motion } from "framer-motion";

const floatingEmojis = [
  { emoji: "🛒", x: "8%", y: "15%", delay: 0, size: "text-3xl" },
  { emoji: "📦", x: "78%", y: "20%", delay: 0.3, size: "text-2xl" },
  { emoji: "☕", x: "88%", y: "55%", delay: 0.6, size: "text-xl" },
  { emoji: "🎁", x: "15%", y: "65%", delay: 0.9, size: "text-2xl" },
  { emoji: "✨", x: "50%", y: "10%", delay: 0.2, size: "text-lg" },
  { emoji: "🏷️", x: "65%", y: "70%", delay: 0.7, size: "text-xl" },
  { emoji: "🛍️", x: "35%", y: "75%", delay: 0.5, size: "text-lg" },
];

const Hero = () => (
  <div className="relative overflow-hidden">
    <div className="px-5 pt-8 pb-2 relative z-10 md:pt-14 md:pb-4 md:px-10">
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-[10px] md:text-xs tracking-[0.2em] uppercase text-muted-foreground mb-2"
      >
        Your marketplace
      </motion.p>
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="font-display text-[56px] md:text-[72px] lg:text-[84px] leading-none tracking-[-2px] mb-1"
      >
        W<em style={{ fontSize: 65 }} className="text-gradient italic">Market</em>
      </motion.h1>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="font-display italic text-xs text-muted-foreground tracking-wide"
      >
        shop it. love it.
      </motion.p>
    </div>

    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, delay: 0.3 }}
      className="relative w-full h-[180px] md:h-[300px] flex items-center justify-center overflow-hidden"
    >
      {/* Floating emojis */}
      {floatingEmojis.map((item, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 0.15, scale: 1 }}
          transition={{ duration: 0.6, delay: item.delay + 0.4 }}
          className={`absolute ${item.size} animate-float`}
          style={{
            left: item.x,
            top: item.y,
            animationDelay: `${item.delay}s`,
          }}
        >
          {item.emoji}
        </motion.span>
      ))}

      {/* Central quote */}
      <div className="relative z-10 text-center px-6">
        <motion.p
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="font-display italic text-xl md:text-3xl text-foreground leading-snug"
        >
          "Everything you need,<br />in one place."
        </motion.p>
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="inline-block text-[10px] tracking-[0.2em] uppercase text-muted-foreground mt-2.5 border-t border-border pt-2.5 px-4"
        >
          New products every week
        </motion.span>
      </div>
    </motion.div>
  </div>
);

export default Hero;
