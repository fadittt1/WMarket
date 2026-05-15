import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/StoreContext";
import * as XLSX from "xlsx";

const AdminPage = () => {
  const store = useAppStore();
  const { db, currentUser, loginReq, registerReq, uploadImage, addProduct, updateProduct, deleteProduct, addCategory, deleteCategory, markOrderDone, deleteOrder, addPack, updatePack, deletePack, updateUserRole, deleteUser } = store;
  const navigate = useNavigate();

  const [phone, setPhone] = useState("");
  const [pw, setPw] = useState("");
  const [name, setName] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [authError, setAuthError] = useState("");
  
  const loggedIn = currentUser?.role === "admin";

  useEffect(() => {
    if (currentUser && currentUser.role !== "admin") {
      navigate("/");
    }
  }, [currentUser, navigate]);

  const tryAuth = async () => {
    setAuthError("");
    if (isRegister) {
      if (!name || typeof phone !== "string" || !pw) { setAuthError("All fields required"); return; }
      const ok = await registerReq(phone, pw, name);
      if (!ok) setAuthError("Registration failed. Phone may be in use.");
    } else {
      if (typeof phone !== "string" || !pw) { setAuthError("Phone and password required"); return; }
      const ok = await loginReq(phone, pw);
      if (!ok) setAuthError("Invalid credentials.");
    }
  };

  const [tab, setTab] = useState<"products" | "orders" | "categories" | "packs" | "users">("products");

  // Product form
  const [editId, setEditId] = useState<string | null>(null);
  const [sName, setSName] = useState("");
  const [sPrice, setSPrice] = useState("");
  const [sCats, setSCats] = useState<string[]>([]);
  const [imgBase64, setImgBase64] = useState("");
  const [sBadge, setSBadge] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const excelRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [newCat, setNewCat] = useState("");
  const [importMessage, setImportMessage] = useState("");

  // Multi-select for bulk delete
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelectMode = () => {
    setSelectMode((prev) => !prev);
    setSelectedIds([]);
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (!selectedIds.length) return;
    if (!confirm(`Delete ${selectedIds.length} product(s)? This cannot be undone.`)) return;
    selectedIds.forEach((id) => deleteProduct(id));
    setSelectedIds([]);
    setSelectMode(false);
  };

  // Pack form
  const [packEditId, setPackEditId] = useState<string | null>(null);
  const [pName, setPName] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pPrice, setPPrice] = useState("");
  const [pEmoji, setPEmoji] = useState("");
  const [pImg, setPImg] = useState("");
  const [pStickerIds, setPStickerIds] = useState<string[]>([]);
  const [pVisible, setPVisible] = useState(true);
  const [pIsHero, setPIsHero] = useState(false);
  const packFileRef = useRef<HTMLInputElement>(null);

  // Pack sticker import sub-tab
  const [packStickerTab, setPackStickerTab] = useState<"catalog" | "import">("catalog");
  const [importedStickerIds, setImportedStickerIds] = useState<string[]>([]);
  const [impName, setImpName] = useState("");
  const [impImg, setImpImg] = useState("");
  const impFileRef = useRef<HTMLInputElement>(null);

  const handleImpFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) {
      setImpImg(url);
    } else {
      alert("Image upload failed.");
    }
  };

  const handleAddImportedSticker = () => {
    const n = impName.trim();
    if (!n) { alert("Please enter a sticker name."); return; }
    addProduct({ name: n, price: 0, category: "General", categories: ["General"], emoji: "📦", img: impImg, badge: "", packOnly: true });
    // Find the just-created sticker (last one with that name)
    setTimeout(() => {
      const latest = db.products.find((s) => s.name === n && !importedStickerIds.includes(s.id) && !pStickerIds.includes(s.id));
      if (latest) {
        setImportedStickerIds((prev) => [...prev, latest.id]);
      }
      setImpName("");
      setImpImg("");
      if (impFileRef.current) impFileRef.current.value = "";
    }, 300);
  };

  const removeImportedSticker = (id: string) => {
    setImportedStickerIds((prev) => prev.filter((x) => x !== id));
    // Also delete packOnly stickers from the database entirely
    const s = db.products.find((x) => x.id === id);
    if (s?.packOnly) {
      deleteProduct(id);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) {
      setImgBase64(url);
    } else {
      alert("Image upload failed.\n\nCheck that Cloudinary environment variables are set in your Render dashboard (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET).\n\nopen DevTools (F12 → Console) for the exact error.");
    }
  };

  const handlePackFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadImage(file);
    if (url) {
      setPImg(url);
    } else {
      alert("Image upload failed.");
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (!rows.length) { setImportMessage("No rows found."); return; }
      const getField = (row: Record<string, unknown>, keys: string[]) => {
        for (const key of keys) {
          if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return String(row[key]).trim();
        }
        return "";
      };
      let imported = 0, skipped = 0;
      rows.forEach((row) => {
        const name = getField(row, ["name", "Name", "product", "Product"]);
        const priceText = getField(row, ["price", "Price"]);
      const category = getField(row, ["category", "Category"]) || "General";
        const categories = category.includes(",") ? category.split(",").map((c: string) => c.trim()) : [category];
        const emoji = getField(row, ["emoji", "Emoji"]) || "🌸";
        const img = getField(row, ["img", "image", "imageUrl", "Image", "ImageUrl"]);
        const badge = getField(row, ["badge", "Badge"]);
        const price = Number(priceText);
        if (!name || Number.isNaN(price)) { skipped += 1; return; }
        addProduct({ name, price, category: categories[0], categories, emoji, img, badge });
        imported += 1;
      });
      setImportMessage(`Imported ${imported} product(s). Skipped ${skipped} invalid row(s).`);
    } catch {
      setImportMessage("Failed to import file.");
    } finally {
      e.target.value = "";
    }
  };

  const resetForm = () => {
    setEditId(null); setSName(""); setSPrice(""); setSCats([]); setImgBase64(""); setSBadge("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = () => {
    const name = sName.trim();
    const price = parseFloat(sPrice);
    if (!name || isNaN(price)) { alert("Please fill in name and price."); return; }
    const selectedCats = sCats.length ? sCats : ["General"];
    const badge = sBadge.trim();
    if (editId !== null) {
      updateProduct(editId, { name, price, category: selectedCats[0], categories: selectedCats, badge, ...(imgBase64 ? { img: imgBase64 } : {}) });
    } else {
      addProduct({ name, price, category: selectedCats[0], categories: selectedCats, emoji: "📦", img: imgBase64, badge });
    }
    resetForm();
  };

  const startEdit = (id: string) => {
    const s = db.products.find((x) => x.id === id);
    if (!s) return;
    setEditId(id); setSName(s.name); setSPrice(String(s.price)); setSCats(s.categories?.length ? [...s.categories] : (s.category ? [s.category] : [])); setImgBase64(s.img || ""); setSBadge(s.badge || "");
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const resetPackForm = () => {
    setPackEditId(null); setPName(""); setPDesc(""); setPPrice(""); setPEmoji(""); setPImg(""); setPStickerIds([]); setPVisible(true); setPIsHero(false);
    if (packFileRef.current) packFileRef.current.value = "";
    setImportedStickerIds([]); setImpName(""); setImpImg(""); setPackStickerTab("catalog");
    if (impFileRef.current) impFileRef.current.value = "";
  };

  const handlePackSave = () => {
    const name = pName.trim();
    const price = parseFloat(pPrice);
    if (!name || isNaN(price)) { alert("Please fill in name and price."); return; }
    const mergedIds = [...new Set([...pStickerIds, ...importedStickerIds])];
    const data = { name, description: pDesc.trim(), price, img: pImg, productIds: mergedIds, visible: pVisible, isHero: pIsHero };
    if (packEditId !== null) {
      updatePack(packEditId, data);
    } else {
      addPack(data);
    }
    resetPackForm();
  };

  const startPackEdit = (id: string) => {
    const p = db.packs.find((x) => x.id === id);
    if (!p) return;
    // Separate catalog stickers from pack-exclusive ones
    const catalogIds: string[] = [];
    const exclusiveIds: string[] = [];
    (p.productIds || []).forEach((sid) => {
      const s = db.products.find((x) => x.id === sid);
      if (s?.packOnly) {
        exclusiveIds.push(sid);
      } else {
        catalogIds.push(sid);
      }
    });
    setPackEditId(id); setPName(p.name); setPDesc(p.description); setPPrice(String(p.price)); setPEmoji(""); setPImg(p.img); setPStickerIds(catalogIds); setPVisible(p.visible); setPIsHero(p.isHero);
    setImportedStickerIds(exclusiveIds);
    setPackStickerTab("catalog");
  };

  const togglePackSticker = (sid: string) => {
    setPStickerIds((prev) => prev.includes(sid) ? prev.filter((id) => id !== sid) : [...prev, sid]);
  };

  const totalOrders = db.orders.length;
  const pendingOrders = db.orders.filter((o) => o.status === "pending").length;
  const revenue = db.orders.filter((o) => o.status === "done").reduce((s, o) => s + o.total, 0);
  const cats = db.categories.filter((c) => c !== "All");

  const inputCls = "w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm outline-none focus:border-accent transition-colors";

  return (
    <div>
      <nav className="flex justify-between items-center px-5 md:px-10 py-[18px] sticky top-0 bg-background z-50 border-b border-border">
        <Link to="/" className="text-xl text-foreground">←</Link>
        <span className="font-display text-[22px]">Admin</span>
        {loggedIn ? (
          <button onClick={() => { store.logout(); }} className="border border-border text-muted-foreground px-3 py-1.5 rounded-full text-[11px]">
            Logout
          </button>
        ) : <div className="w-[60px]" />}
      </nav>

      {!loggedIn ? (
        <div className="max-w-[340px] mx-auto mt-16 px-5">
          <div className="text-center mb-7">
            <h2 className="font-display text-[30px] mb-1.5">Welcome</h2>
            <p className="text-muted-foreground text-[13px]">{isRegister ? "Create an account" : "Log in to your account"}</p>
          </div>
          {isRegister && (
            <input
              value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Your Name" className={`${inputCls} mb-3`}
            />
          )}
          <input
            type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="Phone Number" className={`${inputCls} mb-3`}
          />
          <input
            type="password" value={pw} onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tryAuth()}
            placeholder="Password" className={`${inputCls} mb-4`}
          />
          <button onClick={tryAuth} className="bg-primary text-primary-foreground w-full py-3.5 rounded-[14px] text-sm font-medium">
            {isRegister ? "Sign Up" : "Sign In"} →
          </button>
          
          <button 
            onClick={() => setIsRegister(!isRegister)} 
            className="w-full text-center text-xs text-muted-foreground mt-4 hover:text-foreground underline underline-offset-2"
          >
            {isRegister ? "Already have an account? Log in" : "Need an account? Sign up"}
          </button>
          {authError && <p className="text-destructive text-xs text-center mt-3">{authError}</p>}
        </div>
      ) : (
        <div className="px-5 md:px-10 pb-8 md:max-w-[1100px] md:mx-auto">
          <div className="pt-4 pb-3">
            <h2 className="font-display text-2xl">Dashboard</h2>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
            {[
              { label: "Total orders", value: totalOrders, color: "" },
              { label: "Pending", value: pendingOrders, color: "text-yellow-700" },
              { label: "Revenue (done)", value: revenue.toFixed(3), color: "text-accent" },
              { label: "Products", value: db.products.filter((s) => !s.packOnly).length, color: "" },
            ].map((s) => (
              <div key={s.label} className="bg-card rounded-xl px-4 py-3.5">
                <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">{s.label}</div>
                <div className={`font-display text-[26px] ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex border border-border rounded-xl overflow-hidden mb-5">
            {(["products", "orders", "categories", "packs", "users"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2.5 text-xs font-medium tracking-wider capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                  }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Products Tab */}
          {tab === "products" && (
            <div>
              <div ref={formRef} className="bg-card rounded-2xl p-4 mb-4">
                <h3 className="text-sm font-medium mb-3.5">{editId !== null ? "Edit product" : "Add new product"}</h3>
                <div className="mb-3">
                  <input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelImport} />
                  <button onClick={() => excelRef.current?.click()} className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-medium">
                    Import products from Excel
                  </button>
                  <p className="text-[11px] text-muted-foreground mt-2">Expected columns: name, price, category, emoji, img, badge.</p>
                  <a href="/products-template.csv" download className="inline-block text-[11px] mt-1.5 text-primary underline underline-offset-2">
                    Download template (CSV)
                  </a>
                  {importMessage ? <p className="text-[11px] mt-1.5 text-accent">{importMessage}</p> : null}
                </div>
                <div
                  onClick={() => fileRef.current?.click()}
                  className="w-full h-[100px] bg-muted rounded-lg flex items-center justify-center text-[40px] mb-2.5 overflow-hidden cursor-pointer border border-dashed border-border"
                >
                  {imgBase64 ? <img src={imgBase64} className="w-full h-full object-cover rounded-lg" /> : <span className="text-xs text-muted-foreground">+ Add image</span>}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Product name" className={`${inputCls} mb-2.5`} />
                <div className="mb-2.5">
                  <input value={sPrice} onChange={(e) => setSPrice(e.target.value)} type="number" placeholder="Price (TND)" step="0.1" min="0" className={inputCls} />
                </div>
                <div className="mb-2.5">
                  <input
                    value={sBadge}
                    onChange={(e) => setSBadge(e.target.value)}
                    placeholder="Badge label (e.g. ONE PIECE, NEW, HOT…)"
                    className={inputCls}
                  />
                  {sBadge.trim() && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">Preview:</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide bg-accent text-accent-foreground">{sBadge.trim()}</span>
                    </div>
                  )}
                </div>
                <div className="mb-2.5">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">Categories</div>
                  <div className="max-h-[120px] overflow-y-auto space-y-1.5 border border-border rounded-lg p-2 bg-muted/30">
                    {cats.map((c) => (
                      <label key={c} className="flex items-center gap-2 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={sCats.includes(c)}
                          onChange={() => setSCats((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])}
                          className="rounded accent-accent"
                        />
                        <span>{c}</span>
                      </label>
                    ))}
                    {!cats.length && <span className="text-[11px] text-muted-foreground">No categories yet. Create one in the Categories tab.</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} className="flex-1 bg-accent text-accent-foreground py-2.5 rounded-xl text-sm font-medium">Save product</button>
                  <button onClick={resetForm} className="bg-transparent border border-border text-foreground px-4 py-2.5 rounded-xl text-[13px]">Cancel</button>
                </div>
              </div>

              {/* Multi-select toolbar */}
              <div className="flex items-center justify-between mb-2">
                <button
                  onClick={toggleSelectMode}
                  className={`px-3 py-1.5 text-[11px] rounded-lg border transition-colors ${
                    selectMode
                      ? "bg-destructive/10 text-destructive border-destructive/30"
                      : "bg-muted text-foreground border-border"
                  }`}
                >
                  {selectMode ? "✕ Cancel" : "⬜ Select"}
                </button>

                {selectMode && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground">
                      <input
                        type="checkbox"
                        className="rounded accent-accent"
                        checked={selectedIds.length === db.products.filter((s) => !s.packOnly).length && db.products.filter((s) => !s.packOnly).length > 0}
                        onChange={() => {
                          const visible = db.products.filter((s) => !s.packOnly);
                          if (selectedIds.length === visible.length) {
                            setSelectedIds([]);
                          } else {
                            setSelectedIds(visible.map((s) => s.id));
                          }
                        }}
                      />
                      All
                    </label>
                    <button
                      onClick={handleBulkDelete}
                      disabled={selectedIds.length === 0}
                      className="px-3 py-1.5 text-[11px] rounded-lg bg-destructive text-white border border-destructive disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
                    >
                      🗑 Delete {selectedIds.length > 0 ? `(${selectedIds.length})` : ""}
                    </button>
                  </div>
                )}
              </div>

              {db.products.filter((s) => !s.packOnly).map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2.5 py-2.5 border-b border-border transition-colors ${
                    selectMode && selectedIds.includes(s.id) ? "bg-destructive/5 rounded-lg px-2" : ""
                  }`}
                >
                  {selectMode && (
                    <input
                      type="checkbox"
                      className="rounded accent-accent shrink-0 w-4 h-4 cursor-pointer"
                      checked={selectedIds.includes(s.id)}
                      onChange={() => toggleSelectId(s.id)}
                    />
                  )}
                  <div
                    className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center text-[22px] overflow-hidden shrink-0 cursor-pointer"
                    onClick={() => selectMode && toggleSelectId(s.id)}
                  >
                    {s.img ? <img src={s.img} alt={s.name} className="w-full h-full object-cover" /> : s.emoji || "🌸"}
                  </div>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => selectMode && toggleSelectId(s.id)}
                  >
                    <div className="text-[13px] font-medium">{s.name}</div>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(s.categories?.length ? s.categories : [s.category]).map((c) => (
                        <span key={c} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/50">{c}</span>
                      ))}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{s.price.toFixed(3)} TND</div>
                  </div>
                  {!selectMode && (
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => startEdit(s.id)} className="px-2.5 py-1 text-[11px] rounded-lg bg-muted text-foreground border border-border">Edit</button>
                      <button onClick={() => { if (confirm("Delete this product?")) deleteProduct(s.id); }} className="px-2.5 py-1 text-[11px] rounded-lg bg-destructive/10 text-destructive border border-destructive/20">Del</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Orders Tab */}
          {tab === "orders" && (
            <div>
              {!db.orders.length ? (
                <div className="text-center py-16">
                  <div className="text-[48px] mb-3">📦</div>
                  <p className="text-muted-foreground text-[13px]">No orders yet.</p>
                </div>
              ) : (
                db.orders
                  .slice()
                  .sort((a, b) => (a.status === "pending" ? -1 : 1) - (b.status === "pending" ? -1 : 1))
                  .map((o) => {
                    const date = new Date(o.date);
                    const displayDate = isNaN(date.getTime()) ? o.date : date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                    return (
                      <div key={o.id} className="bg-card rounded-2xl mb-3 overflow-hidden border border-border/60 shadow-sm">
                        {/* Header bar */}
                        <div className="flex justify-between items-center px-4 py-3 border-b border-border/40 bg-muted/30">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center text-sm font-display text-accent">
                              {o.name?.[0]?.toUpperCase() ?? "?"}
                            </div>
                            <div>
                              <div className="text-[13px] font-semibold leading-tight">{o.name}</div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1">📞 {o.phone}</div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
                              o.status === "done"
                                ? "bg-green-100 text-green-800 border border-green-200"
                                : "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}>
                              {o.status === "done" ? "✓ Done" : "⏳ Pending"}
                            </span>
                            <div className="text-[10px] text-muted-foreground">{displayDate}</div>
                          </div>
                        </div>

                        {/* Sticker image strip */}
                        <div className="px-4 pt-3.5 pb-1">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">
                            Items ordered ({o.items.reduce((s, i) => s + i.qty, 0)} pcs)
                          </div>
                          <div className="flex flex-wrap gap-2.5">
                            {o.items.map((item, idx) => {
                              const matched = db.products.find(
                                (s) => s.name.trim().toLowerCase() === item.name.trim().toLowerCase()
                              );
                              return (
                                <div key={idx} className="flex flex-col items-center gap-1">
                                  <div className="relative">
                                    <div className="w-[62px] h-[62px] rounded-xl bg-muted border border-border overflow-hidden flex items-center justify-center">
                                      {matched?.img ? (
                                        <img
                                          src={matched.img}
                                          alt={item.name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <span className="text-2xl">{matched?.emoji ?? "📦"}</span>
                                      )}
                                    </div>
                                    {item.qty > 1 && (
                                      <span className="absolute -top-1.5 -right-1.5 bg-accent text-accent-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow">
                                        ×{item.qty}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[9px] text-muted-foreground text-center max-w-[62px] leading-tight truncate" title={item.name}>
                                    {item.name}
                                  </div>
                                  <div className="text-[9px] font-medium text-accent">{item.price.toFixed(3)}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Notes */}
                        {o.notes && (
                          <div className="mx-4 mt-2 mb-0 bg-muted/50 border border-border/40 rounded-xl px-3 py-2 text-[11px] text-muted-foreground italic flex items-start gap-1.5">
                            <span>💬</span>
                            <span>"{o.notes}"</span>
                          </div>
                        )}

                        {/* Footer */}
                        <div className="flex items-center justify-between px-4 py-3 mt-1">
                          <div className="font-display text-[17px] text-accent">{o.total.toFixed(3)} TND</div>
                          <div className="flex gap-2">
                            {o.status === "pending" && (
                              <button
                                onClick={() => markOrderDone(o.id)}
                                className="px-3 py-1.5 text-[11px] rounded-lg bg-green-100 text-green-800 border border-green-200 font-medium hover:bg-green-200 transition-colors"
                              >
                                ✓ Mark as done
                              </button>
                            )}
                            <button
                              onClick={() => { if (confirm("Delete this order?")) deleteOrder(o.id); }}
                              className="px-3 py-1.5 text-[11px] rounded-lg bg-destructive/10 text-destructive border border-destructive/20 font-medium hover:bg-destructive/20 transition-colors"
                            >
                              🗑 Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>
          )}

          {/* Categories Tab */}
          {tab === "categories" && (
            <div>
              <div className="bg-card rounded-2xl p-4 mb-5">
                <h3 className="text-sm font-medium mb-3.5">Add new category</h3>
                <input
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && newCat.trim()) { addCategory(newCat.trim()); setNewCat(""); } }}
                  placeholder="e.g. Vintage, Cute, Campus..."
                  className={`${inputCls} mb-2.5`}
                />
                <button onClick={() => { if (newCat.trim()) { addCategory(newCat.trim()); setNewCat(""); } }} className="bg-accent text-accent-foreground w-full py-3 rounded-xl text-[13px] font-medium">
                  + Create category
                </button>
              </div>

              <div className="flex items-center gap-2.5 mb-3.5">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] tracking-[0.15em] uppercase text-muted-foreground">Your categories</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {!cats.length ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="text-[32px] mb-2.5">🗂️</div>
                  <p className="text-sm font-medium mb-1">No categories yet</p>
                  <p className="text-xs">Type a name above and hit "Create category"</p>
                </div>
              ) : (
                cats.map((c) => {
                  const count = db.products.filter((s) => !s.packOnly && (s.categories?.includes(c) || s.category === c)).length;
                  return (
                    <div key={c} className="flex items-center justify-between bg-card rounded-xl px-3.5 py-3 mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-muted rounded-lg flex items-center justify-center text-base">🏷️</div>
                        <div>
                          <div className="text-sm font-medium">{c}</div>
                          <div className="text-[11px] text-muted-foreground">{count} product{count !== 1 ? "s" : ""}</div>
                        </div>
                      </div>
                      <button onClick={() => { if (confirm(`Remove category "${c}"?`)) deleteCategory(c); }} className="px-2.5 py-1 text-[11px] rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                        Remove
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Packs Tab */}
          {tab === "packs" && (
            <div>
              <div className="bg-card rounded-2xl p-4 mb-4">
                <h3 className="text-sm font-medium mb-3.5">{packEditId !== null ? "Edit pack" : "Add new pack"}</h3>

                <div
                  onClick={() => packFileRef.current?.click()}
                  className="w-full h-[100px] bg-muted rounded-lg flex items-center justify-center text-[40px] mb-2.5 overflow-hidden cursor-pointer border border-dashed border-border"
                >
                  {pImg ? <img src={pImg} className="w-full h-full object-cover rounded-lg" /> : <span className="text-xs text-muted-foreground">+ Add image</span>}
                </div>
                <input ref={packFileRef} type="file" accept="image/*" className="hidden" onChange={handlePackFileChange} />

                <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Pack name" className={`${inputCls} mb-2.5`} />
                <textarea value={pDesc} onChange={(e) => setPDesc(e.target.value)} placeholder="Description" rows={2} className={`${inputCls} mb-2.5 resize-none`} />
                <div className="grid grid-cols-2 gap-2.5 mb-2.5">
                  <input value={pPrice} onChange={(e) => setPPrice(e.target.value)} type="number" placeholder="Price (TND)" step="0.1" min="0" className={inputCls} />
                </div>

                {/* Sticker selection — two tabs */}
                <div className="mb-3">
                  <div className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2 font-medium">Select products</div>
                  <div className="flex border border-border rounded-lg overflow-hidden mb-2">
                    <button
                      onClick={() => setPackStickerTab("catalog")}
                      className={`flex-1 py-2 text-[11px] font-medium ${packStickerTab === "catalog" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                    >
                      From catalog
                    </button>
                    <button
                      onClick={() => setPackStickerTab("import")}
                      className={`flex-1 py-2 text-[11px] font-medium ${packStickerTab === "import" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                    >
                      Import new
                    </button>
                  </div>

                  {packStickerTab === "catalog" ? (
                    <div>
                      <div className="max-h-[150px] overflow-y-auto space-y-1.5 border border-border rounded-lg p-2">
                        {db.products.filter((s) => !s.packOnly).map((s) => (
                          <label key={s.id} className="flex items-center gap-2 cursor-pointer text-xs">
                            <input
                              type="checkbox"
                              checked={pStickerIds.includes(s.id)}
                              onChange={() => togglePackSticker(s.id)}
                              className="rounded accent-accent"
                            />
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              {s.img && <img src={s.img} className="w-6 h-6 rounded object-cover shrink-0" />}
                              <span className="truncate">{s.name}</span>
                            </div>
                          </label>
                        ))}
                      </div>

                      {/* Pack-exclusive stickers (packOnly) */}
                      {importedStickerIds.length > 0 && (
                        <div className="mt-2.5">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 font-medium">Pack-exclusive products</div>
                          <div className="flex flex-wrap gap-2">
                            {importedStickerIds.map((id) => {
                              const s = db.products.find((x) => x.id === id);
                              if (!s) return null;
                              return (
                                <div key={id} className="flex items-center gap-2 bg-muted rounded-lg px-2.5 py-1.5 text-xs">
                                  <div className="w-8 h-8 rounded bg-muted-foreground/10 overflow-hidden flex items-center justify-center shrink-0">
                                    {s.img ? <img src={s.img} className="w-full h-full object-cover" /> : <span className="text-lg">{s.emoji}</span>}
                                  </div>
                                  <span className="font-medium max-w-[80px] truncate">{s.name}</span>
                                  <button onClick={() => removeImportedSticker(id)} className="text-destructive text-sm ml-1 hover:text-destructive/80">×</button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      {/* Imported sticker cards */}
                      {importedStickerIds.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-2.5">
                          {importedStickerIds.map((id) => {
                            const s = db.products.find((x) => x.id === id);
                            if (!s) return null;
                            return (
                              <div key={id} className="flex items-center gap-2 bg-muted rounded-lg px-2.5 py-1.5 text-xs">
                                <div className="w-8 h-8 rounded bg-muted-foreground/10 overflow-hidden flex items-center justify-center shrink-0">
                                  {s.img ? <img src={s.img} className="w-full h-full object-cover" /> : <span className="text-lg">{s.emoji}</span>}
                                </div>
                                <span className="font-medium max-w-[80px] truncate">{s.name}</span>
                                <button onClick={() => removeImportedSticker(id)} className="text-destructive text-sm ml-1 hover:text-destructive/80">×</button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Import form */}
                      <div className="border border-border rounded-lg p-2.5 space-y-2">
                        <div
                          onClick={() => impFileRef.current?.click()}
                          className="w-full h-[70px] bg-muted rounded-lg flex items-center justify-center overflow-hidden cursor-pointer border border-dashed border-border"
                        >
                          {impImg ? <img src={impImg} className="w-full h-full object-cover rounded-lg" /> : <span className="text-[11px] text-muted-foreground">+ Upload image</span>}
                        </div>
                        <input ref={impFileRef} type="file" accept="image/*" className="hidden" onChange={handleImpFileChange} />
                        <input value={impName} onChange={(e) => setImpName(e.target.value)} placeholder="Product name" className={inputCls} />
                        <button onClick={handleAddImportedSticker} className="w-full bg-accent text-accent-foreground py-2 rounded-lg text-[12px] font-medium">
                          + Add to pack
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-4 mb-3">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={pVisible} onChange={(e) => setPVisible(e.target.checked)} className="rounded accent-accent" />
                    Visible on shop
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={pIsHero} onChange={(e) => setPIsHero(e.target.checked)} className="rounded accent-accent" />
                    Show as hero pack
                  </label>
                </div>

                <div className="flex gap-2">
                  <button onClick={handlePackSave} className="flex-1 bg-accent text-accent-foreground py-2.5 rounded-xl text-sm font-medium">Save pack</button>
                  <button onClick={resetPackForm} className="bg-transparent border border-border text-foreground px-4 py-2.5 rounded-xl text-[13px]">Cancel</button>
                </div>
              </div>

              {/* Pack list */}
              {db.packs.map((p) => (
                <div key={p.id} className="flex items-center gap-2.5 py-2.5 border-b border-border">
                  <div className="w-11 h-11 rounded-lg bg-muted flex items-center justify-center text-[22px] overflow-hidden shrink-0">
                    {p.img ? <img src={p.img} alt={p.name} className="w-full h-full object-cover" /> : null}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium flex items-center gap-1.5">
                      {p.name}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider ${p.isHero ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>
                        {p.isHero ? "hero" : "mini"}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider ${p.visible ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                        {p.visible ? "live" : "hidden"}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">{(p.productIds || []).length} product{(p.productIds || []).length !== 1 ? "s" : ""} · {p.price.toFixed(3)} TND</div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => startPackEdit(p.id)} className="px-2.5 py-1 text-[11px] rounded-lg bg-muted text-foreground border border-border">Edit</button>
                    <button onClick={() => updatePack(p.id, { visible: !p.visible })} className="px-2 py-1 text-[11px] rounded-lg bg-muted text-foreground border border-border">
                      {p.visible ? "Hide" : "Show"}
                    </button>
                    <button onClick={() => { if (confirm("Delete this pack?")) deletePack(p.id); }} className="px-2.5 py-1 text-[11px] rounded-lg bg-destructive/10 text-destructive border border-destructive/20">Del</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Users Tab */}
          {tab === "users" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium">Registered users ({db.users.length})</h3>
                {currentUser?.superAdmin && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30 font-semibold uppercase tracking-wider">
                    ⭐ Super Admin
                  </span>
                )}
              </div>

              {!db.users.length ? (
                <div className="text-center py-16">
                  <div className="text-[48px] mb-3">👥</div>
                  <p className="text-muted-foreground text-[13px]">No users yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {db.users.map((u) => {
                    const isMe = u.id === currentUser?.id;
                    const isSuperAdminTarget = u.superAdmin;
                    // A regular admin cannot act on other admins — only superAdmin can
                    const canAct = !isMe && !isSuperAdminTarget && (u.role === "user" || currentUser?.superAdmin);

                    return (
                      <div key={u.id} className={`bg-card rounded-xl px-4 py-3 flex items-center gap-3 border ${isSuperAdminTarget ? "border-accent/40 bg-accent/5" : "border-border/60"}`}>
                        {/* Avatar */}
                        <div className="w-9 h-9 rounded-full bg-accent/15 flex items-center justify-center text-sm font-display text-accent shrink-0">
                          {u.name?.[0]?.toUpperCase() ?? "?"}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold leading-tight flex items-center gap-1.5">
                            {u.name}
                            {isSuperAdminTarget && <span className="text-[9px] text-accent">⭐</span>}
                          </div>
                          <div className="text-[11px] text-muted-foreground">📞 {u.phone}</div>
                        </div>

                        {/* Role badge */}
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold uppercase tracking-wider shrink-0 ${
                          u.role === "admin"
                            ? "bg-accent/20 text-accent border border-accent/30"
                            : "bg-muted text-muted-foreground border border-border"
                        }`}>
                          {u.role}
                        </span>

                        {/* Actions */}
                        <div className="flex gap-1.5 shrink-0 items-center">
                          {isMe && (
                            <span className="text-[10px] text-muted-foreground italic px-2">You</span>
                          )}

                          {canAct && (
                            <button
                              onClick={() => {
                                const newRole = u.role === "admin" ? "user" : "admin";
                                if (confirm(`${newRole === "admin" ? "Promote" : "Demote"} ${u.name} to ${newRole}?`)) {
                                  updateUserRole(u.id, newRole as "admin" | "user");
                                }
                              }}
                              className={`px-2.5 py-1 text-[11px] rounded-lg border font-medium transition-colors ${
                                u.role === "admin"
                                  ? "bg-muted text-foreground border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
                                  : "bg-accent/10 text-accent border-accent/30 hover:bg-accent/20"
                              }`}
                            >
                              {u.role === "admin" ? "Demote" : "Make Admin"}
                            </button>
                          )}

                          {canAct && (
                            <button
                              onClick={() => { if (confirm(`Delete user ${u.name}? This cannot be undone.`)) deleteUser(u.id); }}
                              className="px-2.5 py-1 text-[11px] rounded-lg bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors"
                            >
                              🗑
                            </button>
                          )}

                          {!isMe && !canAct && !isSuperAdminTarget && (
                            <span className="text-[10px] text-muted-foreground italic px-2">—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default AdminPage;
