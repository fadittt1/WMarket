import { useState } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import ProductGrid from "@/components/ProductGrid";
import StaffPicks from "@/components/StaffPicks";
import CartDrawer from "@/components/CartDrawer";
import Footer from "@/components/Footer";

const ShopPage = () => {
  const [cartOpen, setCartOpen] = useState(false);

  return (
    <div className="relative max-w-[1100px] mx-auto">
      {/* Film grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 z-[999] opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
        }}
      />

      <Navbar onCartOpen={() => setCartOpen(true)} />
      <Hero />
      <ProductGrid />
      <StaffPicks />
      <div className="h-4" />
      <Footer />
      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
};

export default ShopPage;
