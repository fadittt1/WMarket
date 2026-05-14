import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const SuccessPage = () => (
  <div className="px-5 pt-20 pb-10 text-center min-h-screen flex flex-col items-center justify-center">
    <motion.div
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 15 }}
      className="text-[64px] mb-5"
    >
      🎉
    </motion.div>
    <motion.h2
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="font-display text-[32px] mb-2"
    >
      Order placed!
    </motion.h2>
    <motion.p
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.5 }}
      className="text-muted-foreground text-sm leading-relaxed max-w-[280px] mx-auto mb-8"
    >
      Thanks! We'll reach out on the number you provided to confirm and arrange delivery.
    </motion.p>
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.5 }}
      className="w-full"
    >
      <Link
        to="/"
        className="inline-block bg-primary text-primary-foreground w-full py-4 rounded-2xl text-sm font-medium shadow-soft hover:shadow-elevated active:scale-[0.98] transition-all duration-200"
      >
        Back to shop
      </Link>
    </motion.div>
  </div>
);

export default SuccessPage;
