import { useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/StoreContext";
import { motion, AnimatePresence } from "framer-motion";

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
}

const CartDrawer = ({ open, onClose }: CartDrawerProps) => {
  const { cart, cartTotal, changeQty, removeFromCart } = useAppStore();
  const navigate = useNavigate();

  const goToOrder = () => {
    if (!cart.length) return;
    onClose();
    navigate("/order");
  };

  return (
    <>
      {/* Overlay */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-foreground/25 backdrop-blur-sm z-[200]"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Drawer — bottom sheet on mobile, right sidebar on desktop */}
      <div
        className={`fixed z-[201] overflow-y-auto transition-all duration-300 ease-out shadow-elevated bg-background
          /* mobile: bottom sheet */
          bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[420px] rounded-t-[28px] px-5 pt-5 pb-8 max-h-[85vh]
          md:left-auto md:translate-x-0 md:right-0 md:top-0 md:bottom-0 md:max-w-[400px] md:w-[400px] md:rounded-t-none md:rounded-l-[28px] md:max-h-full md:px-6 md:pt-8 md:pb-8
          ${open ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full"
        }`}
      >
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5" />
        <h2 className="font-display text-[24px] mb-5">Your cart</h2>

        {!cart.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <span className="text-4xl block mb-3">🛒</span>
            <p className="text-sm font-medium mb-1">Your cart is empty</p>
            <p className="text-xs text-muted-foreground/80">Go pick some products! 🛍️</p>
          </div>
        ) : (
          <>
            <div className="space-y-0">
              {cart.map((c) => (
                <div key={c.id} className="flex items-center gap-3 py-3.5 border-b border-border/50">
                  <div className="w-[52px] h-[52px] rounded-xl bg-muted/50 flex items-center justify-center text-[26px] overflow-hidden shrink-0 shadow-card">
                    {c.img ? <img src={c.img} alt={c.name} className="w-full h-full object-cover" /> : c.emoji || "🌸"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">{c.name}</div>
                    <div className="text-xs text-accent font-medium">{(c.price * c.qty).toFixed(3)} TND</div>
                    <div className="flex items-center gap-2.5 mt-1.5">
                      <button
                        onClick={() => changeQty(c.id, -1)}
                        className="w-6 h-6 rounded-full bg-muted text-foreground text-sm flex items-center justify-center hover:bg-border transition-colors active:scale-90"
                      >
                        −
                      </button>
                      <span className="text-[13px] font-medium min-w-[16px] text-center">{c.qty}</span>
                      <button
                        onClick={() => changeQty(c.id, 1)}
                        className="w-6 h-6 rounded-full bg-muted text-foreground text-sm flex items-center justify-center hover:bg-border transition-colors active:scale-90"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFromCart(c.id)}
                    className="text-muted-foreground hover:text-destructive text-lg p-1.5 transition-colors"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-5 pb-1">
              <span className="text-[13px] text-muted-foreground">Total</span>
              <span className="font-display text-xl text-gradient">{cartTotal.toFixed(3)} TND</span>
            </div>

            <button
              onClick={goToOrder}
              className="bg-accent text-accent-foreground w-full py-3.5 rounded-2xl text-sm font-medium mt-4 shadow-soft hover:shadow-elevated active:scale-[0.98] transition-all duration-200"
            >
              Order now →
            </button>
            <button
              onClick={onClose}
              className="bg-transparent border border-border/60 text-foreground w-full py-3 rounded-2xl text-[13px] mt-2 hover:bg-card transition-colors"
            >
              Keep browsing
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default CartDrawer;
