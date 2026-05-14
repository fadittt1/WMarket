import { useState } from "react";
import { useAppStore } from "@/store/StoreContext";
import { Pack } from "@/store/useStore";
import { motion } from "framer-motion";
import PackModal from "./PackModal";

const SpecialDrops = () => {
  const { db, addPackToCart } = useAppStore();
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  
  const visiblePacks = db.packs.filter((p) => p.visible);
  
  // Sort: Hero pack first, then mini packs
  const orderedPacks = [...visiblePacks].sort((a, b) => (b.isHero ? 1 : 0) - (a.isHero ? 1 : 0));

  // Keep modal pack in sync with db
  const livePack = selectedPack ? db.packs.find((p) => p.id === selectedPack.id) || null : null;

  if (!visiblePacks.length) return null;

  const isMobileSingle = visiblePacks.length === 1;

  return (
    <div className="mt-2">
      {/* Section header */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <div className="flex-1 h-px bg-border/60" />
        <span className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground whitespace-nowrap font-medium">
          Special drops
        </span>
        <div className="flex-1 h-px bg-border/60" />
      </div>

      {/* Responsive Grid */}
      <div 
        className={`px-5 md:px-8 mb-4 grid gap-[12px] ${
          isMobileSingle 
            ? 'grid-cols-1 md:grid-cols-3' 
            : 'grid-cols-2 md:grid-cols-3'
        }`}
      >
        {orderedPacks.map((pack, i) => (
          <motion.div
            key={pack.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="overflow-hidden cursor-pointer"
            style={{
              borderRadius: 20,
              background: '#f5f0e8',
              border: '0.5px solid #c4b89a',
            }}
            onClick={() => setSelectedPack(pack)}
          >
            {pack.img ? (
              <img
                src={pack.img}
                alt={pack.name}
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            ) : (
              <div 
                className={`w-full bg-muted/40 flex items-center justify-center ${
                  isMobileSingle
                    ? 'py-12 md:py-0 md:h-[180px]'
                    : 'h-[160px] md:h-[180px]'
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">No image</div>
              </div>
            )}
            <div style={{ padding: '14px 16px' }}>
              <p style={{ fontSize: '8px', letterSpacing: '.18em', textTransform: 'uppercase', color: '#c17f3a', marginBottom: '6px' }}>
                ✦ {pack.isHero ? 'Limited drop' : 'Product bundle'}
              </p>
              <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: '20px', fontStyle: 'italic', color: '#2a2318', marginBottom: '12px', lineHeight: 1.2 }}>
                {pack.name}
              </h3>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontFamily: "'Playfair Display', serif", fontSize: '18px', color: '#c17f3a' }}>
                  {pack.price.toFixed(3)} TND
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); addPackToCart(pack.id); }}
                  style={{
                    background: '#c17f3a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 20,
                    padding: '8px 18px',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Add to cart
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Pack Modal */}
      {livePack && (
        <PackModal pack={livePack} onClose={() => setSelectedPack(null)} />
      )}
    </div>
  );
};

export default SpecialDrops;
