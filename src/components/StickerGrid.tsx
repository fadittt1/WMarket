import { useState, useMemo } from "react";
import { Search, Heart, MessageCircle } from "lucide-react";
import { useAppStore } from "@/store/StoreContext";
import { Sticker, Pack } from "@/store/useStore";
import { motion } from "framer-motion";
import StickerModal from "./StickerModal";
import PackModal from "./PackModal";

const EMOJI_HEIGHTS = [120, 160, 140, 180, 130, 150, 170, 145];

type StickerItem = Sticker & { itemType: 'sticker' };
type PackItem = Pack & { itemType: 'pack' };
type GridItem = StickerItem | PackItem;

const StickerGrid = () => {
  const { db, addToCart, addPackToCart } = useAppStore();
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedSticker, setSelectedSticker] = useState<Sticker | null>(null);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);

  const cats = ["All", ...db.categories.filter((c) => c !== "All")];

  // Shuffle stickers so new ones are mixed in, not always at the end
  const shuffledStickers = useMemo(() => {
    const arr = [...db.stickers].filter((s) => !s.packOnly);
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.stickers.length]);

  // Build combined array: packs shown only when "All" is selected
  const allItems = useMemo<GridItem[]>(() => {
    const packItems: PackItem[] = filter === "All"
      ? db.packs
          .filter((p) => p.visible)
          .map((p) => ({ ...p, itemType: 'pack' as const }))
      : [];

    const byCategory = filter === "All"
      ? shuffledStickers
      : shuffledStickers.filter((s) => s.categories?.includes(filter) || s.category === filter);

    const stickerItems: StickerItem[] = byCategory.map((s) => ({ ...s, itemType: 'sticker' as const }));

    const combined: GridItem[] = [...packItems, ...stickerItems];

    // Hero pack always first
    combined.sort((a, b) => {
      if (a.itemType === 'pack' && (a as PackItem).isHero) return -1;
      if (b.itemType === 'pack' && (b as PackItem).isHero) return 1;
      return 0;
    });

    return combined;
  }, [db.packs, shuffledStickers, filter]);

  const filtered = search.trim()
    ? allItems.filter((item) => item.name.toLowerCase().includes(search.trim().toLowerCase()))
    : allItems;

  const totalReactions = (s: Sticker) => {
    const r = s.reactions || { love: 0, haha: 0, like: 0 };
    return r.love + r.haha + r.like;
  };

  return (
    <div>
      {/* Section separator */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-4">
        <div className="flex-1 h-px bg-border/60" />
        <span className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground whitespace-nowrap font-medium">
          Browse collection
        </span>
        <div className="flex-1 h-px bg-border/60" />
      </div>

      {/* Search bar */}
      <div className="px-5 md:px-8 pb-3">
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stickers..."
            className="w-full bg-card border border-border/60 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none focus:border-accent focus:shadow-soft transition-all duration-200"
          />
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 px-5 md:px-8 pb-5 overflow-x-auto scrollbar-hide">
        {cats.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs border transition-all duration-200 ${
              c === filter
                ? "bg-primary border-primary text-primary-foreground shadow-soft"
                : "bg-transparent border-border/60 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Masonry Grid */}
      <div className="px-5 md:px-8">
        {!filtered.length ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-14 text-muted-foreground"
          >
            <span className="text-3xl block mb-2">🔍</span>
            <p className="text-sm">No stickers found.</p>
          </motion.div>
        ) : (
          <div className="columns-2 md:columns-3 lg:columns-4 gap-3 md:gap-4 space-y-3 md:space-y-4">
            {filtered.map((item, i) => {
              if (item.itemType === 'pack') {
                const pack = item as PackItem;
                return (
                  <motion.div
                    key={`pack-${pack.id}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.04 }}
                    style={{ background: '#efe8d6', borderRadius: '16px', overflow: 'hidden', position: 'relative', breakInside: 'avoid', marginBottom: '8px', cursor: 'pointer' }}
                    onClick={() => setSelectedPack(pack)}
                  >
                    <span style={{ position: 'absolute', top: '8px', left: '8px', background: '#2a2318', color: '#e8a955', fontSize: '8px', letterSpacing: '.1em', textTransform: 'uppercase', padding: '3px 7px', borderRadius: '8px', zIndex: 2 }}>Pack</span>
                    <img src={pack.img} alt={pack.name} style={{ width: '100%', height: 'auto', display: 'block' }} />
                    <div style={{ padding: '9px 11px 11px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: '#2a2318', marginBottom: '2px' }}>{pack.name}</div>
                      <div style={{ fontSize: '9px', color: '#8a7a65', textTransform: 'uppercase', letterSpacing: '.08em' }}>{pack.stickerIds.length} stickers included</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                        <div style={{ fontFamily: 'Playfair Display, serif', fontSize: '14px', color: '#c17f3a' }}>{pack.price.toFixed(3)} TND</div>
                        <button
                          onClick={(e) => { e.stopPropagation(); addPackToCart(pack.id); }}
                          style={{ background: '#c17f3a', color: '#fff', width: '26px', height: '26px', borderRadius: '50%', border: 'none', cursor: 'pointer', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500 }}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              }

              const s = item as StickerItem;
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.04 }}
                  onClick={() => setSelectedSticker(s)}
                  className="group break-inside-avoid bg-card rounded-2xl overflow-hidden cursor-pointer active:scale-[0.97] transition-all duration-200 shadow-card hover:shadow-elevated relative"
                >
                  {s.badge && (
                    <div className="absolute top-2.5 left-2.5 bg-accent text-accent-foreground text-[9px] tracking-[0.1em] uppercase px-2.5 py-0.5 rounded-full z-10 font-medium shadow-soft">
                      {s.badge}
                    </div>
                  )}
                  <div
                    className="flex items-center justify-center bg-muted/50 overflow-hidden relative"
                    style={s.img ? undefined : { height: `${EMOJI_HEIGHTS[i % EMOJI_HEIGHTS.length]}px` }}
                  >
                    {s.img ? (
                      <img src={s.img} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <span className="text-[52px] group-hover:scale-110 transition-transform duration-300">{s.emoji || "🌸"}</span>
                    )}
                  </div>
                  <div className="p-3 pb-3.5">
                    <div className="text-[13px] font-medium leading-tight">{s.name}</div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.categories?.length ? s.categories.join(", ") : s.category}</div>

                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                      {totalReactions(s) > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Heart className="w-3 h-3" /> {totalReactions(s)}
                        </span>
                      )}
                      {(s.comments?.length || 0) > 0 && (
                        <span className="flex items-center gap-0.5">
                          <MessageCircle className="w-3 h-3" /> {s.comments!.length}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between mt-1.5">
                      <div className="font-display text-[15px] text-accent">{s.price.toFixed(3)} TND</div>
                      <button
                        onClick={(e) => { e.stopPropagation(); addToCart(s.id); }}
                        className="bg-accent text-accent-foreground w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium shadow-soft hover:shadow-elevated active:scale-90 transition-all duration-150"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticker detail modal */}
      {selectedSticker && (
        <StickerModal
          sticker={db.stickers.find((s) => s.id === selectedSticker.id) || selectedSticker}
          onClose={() => setSelectedSticker(null)}
        />
      )}

      {/* Pack detail modal */}
      {selectedPack && (
        <PackModal
          pack={db.packs.find((p) => p.id === selectedPack.id) || selectedPack}
          onClose={() => setSelectedPack(null)}
        />
      )}
    </div>
  );
};

export default StickerGrid;
