import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAppStore } from "@/store/StoreContext";
import { Phone, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";

const OrderPage = () => {
  const { cart, cartTotal, submitOrder, currentUser } = useAppStore();
  const navigate = useNavigate();
  
  // Prefill if logged in
  const [name, setName] = useState(currentUser?.name || "");
  const [phone, setPhone] = useState(currentUser?.phone || "");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState(false);

  const handleSubmit = async () => {
    let finalPhone = phone.trim();
    if (currentUser?.role === "admin") finalPhone = "Admin bypassing phone";

    if (!name.trim() || !finalPhone) {
      setError(true);
      return;
    }
    setError(false);

    const items = cart.map(c => ({ name: c.name, qty: c.qty, price: c.price }));
    const total = cartTotal;

    // Backend saves order + fires Twilio WhatsApp automatically.
    // whatsappUrl is also returned as a fallback in case Twilio sandbox isn't active yet.
    const result = await submitOrder(name.trim(), finalPhone, notes.trim(), items, total);

    if (result?.whatsappUrl) {
      // Open WhatsApp as a silent fallback — ensures admin is notified even if Twilio sandbox isn't joined yet
      window.open(result.whatsappUrl, "_blank");
    }

    navigate("/success");
  };

  useEffect(() => {
    if (!cart.length) navigate("/");
  }, [cart.length, navigate]);

  if (!cart.length) return null;

  return (
    <div>
      <nav className="flex justify-between items-center px-5 md:px-10 py-4 md:py-5 sticky top-0 glass z-50 border-b border-border/50">
        <Link to="/" className="text-foreground p-1 hover:bg-card rounded-full transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <span className="font-display text-[22px] tracking-tight">Shop<em className="text-gradient italic">py.</em></span>
        <div className="w-7" />
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="px-5 pt-7 pb-12 md:max-w-[600px] md:mx-auto md:pt-12"
      >
        <h1 className="font-display text-[30px] mb-1">Your order</h1>
        <p className="text-[13px] text-muted-foreground mb-7">Fill in your details and we'll get it to you.</p>

        {/* Order summary */}
        <div className="bg-card rounded-2xl p-4 mb-7 shadow-card">
          {cart.map((c) => (
            <div key={c.id} className="flex justify-between text-[13px] py-1.5">
              <span className="text-foreground">{c.name} × {c.qty}</span>
              <span className="text-muted-foreground">{(c.price * c.qty).toFixed(3)} TND</span>
            </div>
          ))}
          <div className="flex justify-between text-sm font-medium border-t border-border/50 mt-2 pt-2.5">
            <span>Total</span>
            <span className="text-gradient font-display text-base">{cartTotal.toFixed(3)} TND</span>
          </div>
        </div>

        {/* Name */}
        <div className="mb-4">
          <label className="block text-[11px] text-muted-foreground uppercase tracking-[0.12em] mb-2 font-medium">Your name</label>
          {currentUser ? (
            <div className="w-full bg-card/50 border border-border/40 rounded-xl px-4 py-3 text-sm text-foreground/80 select-none">
              {currentUser.name}
            </div>
          ) : (
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Yasmine"
              className="w-full bg-card border border-border/60 rounded-xl px-4 py-3 text-sm text-foreground outline-none focus:border-accent focus:shadow-soft transition-all duration-200"
            />
          )}
        </div>

        {/* Phone */}
        <div className="mb-4 bg-card rounded-2xl p-4 border-[1.5px] border-accent/40 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center">
              <Phone className="w-3.5 h-3.5 text-accent" />
            </div>
            <span className="text-[11px] text-accent font-medium uppercase tracking-[0.12em]">Phone number</span>
          </div>
          {currentUser ? (
            <div className="w-full bg-background/50 border border-border/40 rounded-xl px-4 py-3 text-base font-medium text-foreground/80 select-none">
              {currentUser.phone || "Administrator"}
            </div>
          ) : (
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+216 XX XXX XXX"
              className="w-full bg-background border border-border/60 rounded-xl px-4 py-3 text-base font-medium text-foreground outline-none focus:border-accent focus:shadow-soft transition-all duration-200"
            />
          )}
          <p className="text-[11px] text-muted-foreground mt-2.5 leading-relaxed">
            We'll send you a confirmation message to arrange delivery.
          </p>
        </div>

        {/* Notes */}
        <div className="mb-6">
          <label className="block text-[11px] text-muted-foreground uppercase tracking-[0.12em] mb-2 font-medium">Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Delivery spot, special requests..."
            className="w-full bg-card border border-border/60 rounded-xl px-4 py-3 text-sm text-foreground outline-none resize-none focus:border-accent focus:shadow-soft transition-all duration-200"
          />
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-destructive text-xs mb-3 bg-destructive/8 px-3 py-2 rounded-lg"
          >
            Please fill in your name and phone number.
          </motion.p>
        )}

        <button
          onClick={handleSubmit}
          className="bg-accent text-accent-foreground w-full py-4 rounded-2xl text-sm font-medium shadow-soft hover:shadow-elevated active:scale-[0.98] transition-all duration-200"
        >
          Place order →
        </button>
        <Link
          to="/"
          className="block text-center bg-transparent border border-border/60 text-foreground w-full py-3.5 rounded-2xl text-[13px] mt-2.5 hover:bg-card transition-colors"
        >
          Back to shop
        </Link>
      </motion.div>
    </div>
  );
};

export default OrderPage;
