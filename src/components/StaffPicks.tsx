import { useAppStore } from "@/store/StoreContext";
import { motion } from "framer-motion";

const StaffPicks = () => {
  const { db, addToCart } = useAppStore();
  const picks = db.products.filter((p) => p.badge === "New" || p.badge === "Hot");

  if (!picks.length) return null;

  return (
    <div className="mt-2">
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <div className="flex-1 h-px bg-border/60" />
        <span className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground whitespace-nowrap font-medium">
          Staff picks
        </span>
        <div className="flex-1 h-px bg-border/60" />
      </div>

      <div className="flex gap-3 px-5 overflow-x-auto scrollbar-hide pb-2">
        {picks.map((p, i) => (
          <motion.div
            key={p.id}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            className="shrink-0 w-[130px] bg-card rounded-2xl overflow-hidden shadow-card hover:shadow-elevated transition-shadow"
          >
            <div className="h-[100px] bg-muted/50 flex items-center justify-center overflow-hidden relative">
              {p.img ? (
                <img src={p.img} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-[44px]">{p.emoji || "📦"}</span>
              )}
              {p.badge && (
                <div className="absolute top-2 left-2 bg-accent text-accent-foreground text-[8px] tracking-[0.1em] uppercase px-2 py-0.5 rounded-full font-medium shadow-soft">
                  {p.badge}
                </div>
              )}
            </div>
            <div className="p-2.5">
              <div className="text-[12px] font-medium leading-tight truncate">{p.name}</div>
              <div className="flex items-center justify-between mt-1.5">
                <span className="font-display text-[13px] text-accent">{p.price.toFixed(3)}</span>
                <button
                  onClick={() => addToCart(p.id)}
                  className="bg-accent text-accent-foreground w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shadow-soft active:scale-90 transition-all"
                >
                  +
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default StaffPicks;
