import { useState, useCallback, useEffect } from "react";

export type ReactionType = "love" | "haha" | "like";

export interface Comment {
  id: string; // Mapping _id to id
  author: string;
  text: string;
  date: string;
}

export type StockStatus = "available" | "sold" | "unavailable";

export interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  categories: string[];
  emoji: string;
  img: string;
  badge: string;
  status?: StockStatus;
  sex?: string;
  packOnly?: boolean;
  reactions?: Record<ReactionType, number>;
  comments?: Comment[];
}

export interface CartItem extends Product {
  qty: number;
}

export interface Pack {
  id: string;
  name: string;
  description: string;
  price: number;
  img: string;
  productIds: string[];
  visible: boolean;
  isHero: boolean;
  reactions?: Record<ReactionType, number>;
  comments?: Comment[];
}

export interface Order {
  id: string;
  name: string;
  phone: string;
  notes: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  status: "pending" | "done";
  date: string;
}

export interface User {
  id: string;
  name: string;
  phone: string;
  role: "admin" | "user";
  superAdmin?: boolean;
}

export interface SyncSource {
  label: string;
  url: string;
}

export interface SyncReport {
  startedAt: string;
  finishedAt?: string;
  upserted: number;
  removed: number;
  skipped: number;
  errors: { source: string; message: string }[];
  sources: {
    label: string; url: string; rows: number; upserted: number; skipped: number; error?: string;
    headers?: string[];
    skippedSamples?: { reason: string; rawName?: string; priceText?: string; price?: number; etat?: string; categoryRaw?: string; size?: string; barcode?: string }[];
  }[];
}

interface DB {
  products: Product[];
  categories: string[];
  orders: Order[];
  packs: Pack[];
  users: User[];
}

const defaultDB: DB = {
  products: [],
  categories: [],
  orders: [],
  packs: [],
  users: [],
};

const USER_KEY = "shoppy_user_data";
const TOKEN_KEY = "shoppy_token";
const CART_KEY = "shoppy_cart";

const getHeaders = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
};

const mapId = (arr: any[]) => arr.map(item => ({
  ...item,
  id: item._id,
  // Normalize: support both old stickerIds and new productIds from the DB
  productIds: item.productIds?.length ? item.productIds : (item.stickerIds?.length ? item.stickerIds : []),
  categories: item.categories?.length ? item.categories : (item.category ? [item.category] : []),
  comments: item.comments ? item.comments.map((c: any) => ({...c, id: c._id})) : []
}));

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });

export function useStore() {
  const [db, setDb] = useState<DB>(defaultDB);
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try { 
      const stored = localStorage.getItem(USER_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  const fetchData = useCallback(async () => {
    try {
      const role = currentUser?.role;
      const safeFetch = async (url: string, options?: RequestInit) => {
        try {
          const r = await fetch(url, options);
          if (!r.ok) return [];
          return await r.json();
        } catch { return []; }
      };

      const [prRes, paRes, caRes, orRes, usersRes] = await Promise.all([
        safeFetch("/api/products"),
        safeFetch("/api/packs"),
        safeFetch("/api/categories"),
        role === "admin" ? safeFetch("/api/orders", { headers: getHeaders() }) : Promise.resolve([]),
        role === "admin" ? safeFetch("/api/users", { headers: getHeaders() }) : Promise.resolve([])
      ]);
      setDb({
        products: mapId(Array.isArray(prRes) ? prRes : []),
        packs: mapId(Array.isArray(paRes) ? paRes : []),
        categories: Array.isArray(caRes) ? caRes.map((c: any) => c.name) : [],
        orders: mapId(Array.isArray(orRes) ? orRes : []),
        users: Array.isArray(usersRes) ? usersRes.map((u: any) => ({ ...u, id: u._id })) : [],
      });
    } catch (e) {
      console.error("Failed to load DB state", e);
    }
  }, [currentUser?.role]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
    } catch { /* quota exceeded — ignore */ }
  }, [cart]);

  // Auth Methods
  const loginReq = useCallback(async (phone: string, password: string): Promise<boolean> => {
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password })
      });
      if (r.ok) {
        const data = await r.json();
        setCurrentUser(data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        localStorage.setItem(TOKEN_KEY, data.token);
        return true;
      }
      return false;
    } catch (e) { console.error(e); return false; }
  }, []);

  const registerReq = useCallback(async (phone: string, password: string, name: string): Promise<boolean> => {
    try {
      const r = await fetch("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password, name })
      });
      if (r.ok) {
        const data = await r.json();
        setCurrentUser(data.user);
        localStorage.setItem(USER_KEY, JSON.stringify(data.user));
        localStorage.setItem(TOKEN_KEY, data.token);
        return true;
      }
      return false;
    } catch (e) { console.error(e); return false; }
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setCart([]);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(CART_KEY);
  }, []);

  // Upload Method
  const uploadImage = useCallback(async (file: File): Promise<string | null> => {
    if (!file.type?.startsWith("image/")) return null;

    const formData = new FormData();
    formData.append("image", file);
    try {
      const r = await fetch("/api/upload", {
        method: "POST",
        headers: { "Authorization": `Bearer ${localStorage.getItem(TOKEN_KEY)}` },
        body: formData
      });
      if (r.ok) {
        const data = await r.json();
        return data.url ?? null;
      }
      // Log the actual server error for debugging
      const errBody = await r.json().catch(() => ({}));
      console.error(`[uploadImage] Server error ${r.status}:`, errBody);
      return null;
    } catch (e) {
      console.error("[uploadImage] Network or unexpected error:", e);
      return null;
    }
  }, []);

  const addToCart = useCallback((id: string) => {
    const product = db.products.find((p) => p.id === id);
    // Don't allow ordering sold / unavailable items
    if (product && product.status && product.status !== "available") return;
    setCart((prev) => {
      const existing = prev.find((c) => c.id === id);
      if (existing) return prev.map((c) => (c.id === id ? { ...c, qty: c.qty + 1 } : c));
      if (!product) return prev;
      return [...prev, { ...product, qty: 1 }];
    });
  }, [db.products]);

  const addPackToCart = useCallback((packId: string) => {
    const pack = db.packs.find((p) => p.id === packId);
    if (!pack || !pack.productIds.length) return;
    setCart((prev) => {
      let cart = [...prev];
      for (const pid of pack.productIds) {
        const product = db.products.find((p) => p.id === pid);
        if (!product) continue;
        if (product.status && product.status !== "available") continue; // skip sold items
        const existing = cart.find((c) => c.id === pid);
        if (existing) {
          cart = cart.map((c) => (c.id === pid ? { ...c, qty: c.qty + 1 } : c));
        } else {
          cart = [...cart, { ...product, qty: 1 }];
        }
      }
      return cart;
    });
  }, [db.packs, db.products]);

  const changeQty = useCallback((id: string, delta: number) => {
    setCart((prev) => {
      const updated = prev.map((c) => (c.id === id ? { ...c, qty: c.qty + delta } : c));
      return updated.filter((c) => c.qty > 0);
    });
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setCart((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const cartTotal = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  const submitOrder = useCallback(async (name: string, phone: string, notes: string) => {
    const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
    const orderData = {
      name, phone, notes,
      // Send the product id so the server can recompute the authoritative price.
      // name/price are sent for backward compatibility only; the server ignores them.
      items: cart.map((c) => ({ id: c.id, name: c.name, qty: c.qty, price: c.price })),
      total,
    };
    try {
      const r = await fetch("/api/orders", {
        method: "POST", headers: getHeaders(), body: JSON.stringify(orderData)
      });
      if (r.ok) {
        if (currentUser?.role === "admin") await fetchData();
        setCart([]);
        localStorage.removeItem(CART_KEY);
      }
    } catch(e) { console.error(e) }
  }, [cart, currentUser, fetchData]);

  const addProduct = useCallback(async (product: Omit<Product, "id">) => {
    try {
      const r = await fetch("/api/products", {
        method: "POST", headers: getHeaders(), body: JSON.stringify(product)
      });
      if (r.ok) await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    try {
      const r = await fetch(`/api/products/${id}`, {
        method: "PUT", headers: getHeaders(), body: JSON.stringify(updates)
      });
      if (r.ok) await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const deleteProduct = useCallback(async (id: string) => {
    try {
      await fetch(`/api/products/${id}`, { method: "DELETE", headers: getHeaders() });
      await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const addCategory = useCallback(async (name: string) => {
    try {
      const r = await fetch("/api/categories", {
        method: "POST", headers: getHeaders(), body: JSON.stringify({ name })
      });
      if (r.ok) await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const deleteCategory = useCallback(async (name: string) => {
    try {
      await fetch(`/api/categories/${encodeURIComponent(name)}`, { method: "DELETE", headers: getHeaders() });
      await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const markOrderDone = useCallback(async (id: string) => {
    try {
      await fetch(`/api/orders/${id}/done`, { method: "PATCH", headers: getHeaders() });
      await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const deleteOrder = useCallback(async (id: string) => {
    try {
      await fetch(`/api/orders/${id}`, { method: "DELETE", headers: getHeaders() });
      await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const addReaction = useCallback(async (productId: string, type: ReactionType) => {
    try {
      const r = await fetch(`/api/products/${productId}/reactions`, {
        method: "POST", headers: getHeaders(), body: JSON.stringify({ type })
      });
      if (r.ok) await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const addComment = useCallback(async (productId: string, author: string, text: string) => {
    try {
      const r = await fetch(`/api/products/${productId}/comments`, {
        method: "POST", headers: getHeaders(), body: JSON.stringify({ author, text })
      });
      if (r.ok) await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const deleteComment = useCallback(async (productId: string, commentId: string) => {
    try {
      await fetch(`/api/products/${productId}/comments/${commentId}`, { method: "DELETE", headers: getHeaders() });
      await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const editComment = useCallback(async (productId: string, commentId: string, newText: string) => {
    try {
      const r = await fetch(`/api/products/${productId}/comments/${commentId}`, {
        method: "PATCH", headers: getHeaders(), body: JSON.stringify({ text: newText })
      });
      if (r.ok) await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const addPack = useCallback(async (pack: Omit<Pack, "id">) => {
    try {
      const r = await fetch("/api/packs", {
        method: "POST", headers: getHeaders(), body: JSON.stringify(pack)
      });
      if (r.ok) await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const updatePack = useCallback(async (id: string, updates: Partial<Pack>) => {
    try {
      const r = await fetch(`/api/packs/${id}`, {
        method: "PUT", headers: getHeaders(), body: JSON.stringify(updates)
      });
      if (r.ok) await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const deletePack = useCallback(async (id: string) => {
    try {
      await fetch(`/api/packs/${id}`, { method: "DELETE", headers: getHeaders() });
      await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const addPackReaction = useCallback(async (packId: string, type: ReactionType) => {
    try {
      const r = await fetch(`/api/packs/${packId}/reactions`, {
        method: "POST", headers: getHeaders(), body: JSON.stringify({ type })
      });
      if (r.ok) await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const addPackComment = useCallback(async (packId: string, author: string, text: string) => {
    try {
      const r = await fetch(`/api/packs/${packId}/comments`, {
        method: "POST", headers: getHeaders(), body: JSON.stringify({ author, text })
      });
      if (r.ok) await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const deletePackComment = useCallback(async (packId: string, commentId: string) => {
    try {
      await fetch(`/api/packs/${packId}/comments/${commentId}`, { method: "DELETE", headers: getHeaders() });
      await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const editPackComment = useCallback(async (packId: string, commentId: string, newText: string) => {
    try {
      const r = await fetch(`/api/packs/${packId}/comments/${commentId}`, {
        method: "PATCH", headers: getHeaders(), body: JSON.stringify({ text: newText })
      });
      if (r.ok) await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const updateUserRole = useCallback(async (userId: string, role: "admin" | "user") => {
    try {
      const r = await fetch(`/api/users/${userId}/role`, {
        method: "PATCH", headers: getHeaders(), body: JSON.stringify({ role })
      });
      if (r.ok) await fetchData();
      else {
        const data = await r.json().catch(() => ({}));
        console.error("[updateUserRole] Error:", data.error);
      }
    } catch(e) { console.error(e) }
  }, [fetchData]);

  const deleteUser = useCallback(async (userId: string) => {
    try {
      await fetch(`/api/users/${userId}`, { method: "DELETE", headers: getHeaders() });
      await fetchData();
    } catch(e) { console.error(e) }
  }, [fetchData]);

  // ── Google Sheets sync ──────────────────────────────────────────────────────
  const getSyncConfig = useCallback(async (): Promise<{ sources: SyncSource[]; lastRunAt: string | null; lastReport: SyncReport | null } | null> => {
    try {
      const r = await fetch("/api/sync/config", { headers: getHeaders() });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { console.error(e); return null; }
  }, []);

  const saveSyncConfig = useCallback(async (sources: SyncSource[]): Promise<boolean> => {
    try {
      const r = await fetch("/api/sync/config", {
        method: "PUT", headers: getHeaders(), body: JSON.stringify({ sources })
      });
      return r.ok;
    } catch (e) { console.error(e); return false; }
  }, []);

  const runSync = useCallback(async (): Promise<SyncReport | null> => {
    try {
      const r = await fetch("/api/sync/run", { method: "POST", headers: getHeaders() });
      if (!r.ok) return null;
      const report = await r.json();
      await fetchData();
      return report;
    } catch (e) { console.error(e); return null; }
  }, [fetchData]);

  return {
    db, cart, cartTotal, cartCount,
    currentUser, loginReq, registerReq, logout,
    uploadImage,
    addToCart, addPackToCart, changeQty, removeFromCart,
    submitOrder,
    addProduct, updateProduct, deleteProduct,
    addCategory, deleteCategory,
    markOrderDone, deleteOrder,
    addReaction, addComment, deleteComment, editComment,
    addPack, updatePack, deletePack,
    addPackReaction, addPackComment, deletePackComment, editPackComment,
    updateUserRole, deleteUser,
    getSyncConfig, saveSyncConfig, runSync,
    refreshData: fetchData
  };
}
