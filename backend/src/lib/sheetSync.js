import { Product } from "../models/Product.js";
import { getSyncConfig, SyncConfig } from "../models/SyncConfig.js";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal RFC-4180 CSV parser (handles quoted fields, embedded commas/quotes/newlines).
// Google Sheets "Publish to web → CSV" quotes any field containing a comma, so the
// French decimal comma in "170,00" is preserved correctly.
// ─────────────────────────────────────────────────────────────────────────────
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  // Normalise newlines
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; } // escaped quote
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += c;
    }
  }
  // Flush last field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Normalise a Google Sheets "Publish to web" link into a CSV-download link.
// Handles the common mistake of pasting the HTML (`pubhtml`) or web-page link.
export function normalizeSheetUrl(url) {
  let u = String(url || "").trim();
  if (!u) return u;
  try {
    // "Publish to web → Web page" gives /pubhtml — the CSV variant is /pub?output=csv
    u = u.replace("/pubhtml", "/pub");
    const parsed = new URL(u);
    // Convert a normal edit link (…/d/<id>/edit#gid=) to an export-CSV link.
    const editMatch = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)\/edit/);
    if (editMatch) {
      const gid = (parsed.hash.match(/gid=(\d+)/) || [])[1] || parsed.searchParams.get("gid") || "0";
      return `https://docs.google.com/spreadsheets/d/${editMatch[1]}/export?format=csv&gid=${gid}`;
    }
    // Otherwise force CSV output on the published link.
    parsed.searchParams.set("output", "csv");
    parsed.searchParams.delete("usp"); // drop embed marker
    return parsed.toString();
  } catch {
    return u;
  }
}

function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

// Parse a whole-document "Publish to web" HTML page into its list of tabs.
// The published page contains <li id="sheet-button-<gid>">…<a>Tab name</a>.
export function parsePublishedSheets(html) {
  const out = [];
  const seen = new Set();
  const re = /sheet-button-(\d+)"[^>]*>\s*(?:<a[^>]*>)?\s*([^<]*)/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    const gid = m[1];
    if (seen.has(gid)) continue;
    seen.add(gid);
    out.push({ gid, name: decodeEntities(m[2]).trim() });
  }
  // Fallback: at least collect distinct gids if the markup changed.
  if (!out.length) {
    for (const mm of html.matchAll(/[?&]gid=(\d+)/g)) {
      if (!seen.has(mm[1])) { seen.add(mm[1]); out.push({ gid: mm[1], name: "" }); }
    }
  }
  return out;
}

// Expand a configured source into one entry per tab.
// - A whole-document publish link (…/d/e/<token>/pubhtml or no output=csv) → every tab,
//   each tagged with its tab name as the category.
// - A single-tab CSV/edit link → just that one (category = the source label).
export async function expandSource(source) {
  const raw = String(source.url || "").trim();
  const tokenMatch = raw.match(/\/d\/e\/([^/]+)/);
  const hasCsv = /output=csv/i.test(raw);

  if (tokenMatch && !hasCsv) {
    const token = tokenMatch[1];
    const pubHtmlUrl = `https://docs.google.com/spreadsheets/d/e/${token}/pubhtml`;
    const res = await fetch(pubHtmlUrl, { redirect: "follow" });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching the published document`);
    const html = await res.text();
    const sheets = parsePublishedSheets(html);
    if (sheets.length > 1 || (sheets.length === 1 && sheets[0].name)) {
      return sheets.map((s) => ({
        categoryName: s.name || source.label || "Divers",
        csvUrl: `https://docs.google.com/spreadsheets/d/e/${token}/pub?gid=${s.gid}&single=true&output=csv`,
      }));
    }
  }
  // Single sheet
  return [{ categoryName: source.label || "Divers", csvUrl: normalizeSheetUrl(raw) }];
}

// Turn a parsed CSV (array of arrays) into array of objects keyed by header.
function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map((h) => String(h).trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = r[idx] !== undefined ? r[idx] : ""; });
    return obj;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Column matching — tolerant to accents, case and surrounding spaces.
// ─────────────────────────────────────────────────────────────────────────────
function normHeader(h) {
  return String(h)
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // strip accents
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Pick the first matching column value from a row, given candidate header names.
function pick(row, candidates) {
  const wanted = candidates.map(normHeader);
  for (const key of Object.keys(row)) {
    if (wanted.includes(normHeader(key))) {
      const v = row[key];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return "";
}

// Fuzzy column pick: returns the value of the first column whose normalized header
// CONTAINS all tokens in a group. Groups are tried in order (most specific first).
function pickContains(row, tokenGroups) {
  for (const tokens of tokenGroups) {
    for (const key of Object.keys(row)) {
      const h = normHeader(key);
      if (tokens.every((t) => h.includes(t))) {
        const v = row[key];
        if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
      }
    }
  }
  return "";
}

// Dedicated, tolerant picker for the product NAME.
function pickName(row) {
  const byHeader =
    pick(row, ["$", "name", "nom", "produit", "article", "designation", "modele", "model", "libelle", "label", "nom produit"]) ||
    pickContains(row, [["nom"], ["produit"], ["designation"], ["article"], ["modele"], ["libelle"]]);
  if (byHeader) return byHeader;
  // Fallback: first textual (non-numeric, non-code) column value.
  const skipCols = ["id", "ref", "reference", "code a barre", "code barre", "barcode", "ean", "sku", "photo", "image", "etat", "status", "statut", "taille", "pointure", "size", "tr"];
  for (const key of Object.keys(row)) {
    if (skipCols.includes(normHeader(key))) continue;
    const v = String(row[key] ?? "").trim();
    if (!v) continue;
    if (/^[\d.,\s]+$/.test(v)) continue; // skip pure numbers/prices
    return v;
  }
  return "";
}

// Dedicated, tolerant picker for the SELLING price (TND), avoiding purchase/EUR/sold columns.
function pickSellingPrice(row) {
  // 1. Exact-ish known headers.
  const exact = pick(row, ["prix vente en tnd", "prix vente", "prix de vente", "prix vente tnd", "prix vente dt", "selling price", "prix de vente en tnd"]);
  if (exact) return exact;
  // 2. Any header containing "vente" (sale) — never "vendu" (sold) or "achat" (purchase).
  for (const key of Object.keys(row)) {
    const h = normHeader(key);
    if (h.includes("vente") && !h.includes("achat")) {
      const v = String(row[key] ?? "").trim();
      if (v) return v;
    }
  }
  // 3. Last resort: a "prix" column that isn't purchase, euro, or sold.
  for (const key of Object.keys(row)) {
    const h = normHeader(key);
    if (h.includes("prix") && !h.includes("achat") && !h.includes("euro") && !h.includes("eur") && !h.includes("vendu")) {
      const v = String(row[key] ?? "").trim();
      if (v) return v;
    }
  }
  return "";
}

// Normalise a sex/gender value to "Homme" / "Femme" / "".
function normSex(value) {
  const n = normHeader(value);
  if (!n) return "";
  if (n.startsWith("homme") || n === "h" || n === "m" || n.includes("homme") || n.includes("men")) return "Homme";
  if (n.startsWith("femme") || n === "f" || n.includes("femme") || n.includes("women") || n.includes("woman") || n.includes("fille")) return "Femme";
  return "";
}

// Detect the Homme/Femme value: prefer a dedicated column, else scan all cells.
function pickSex(row) {
  const byHeader = pick(row, ["sexe", "sex", "genre", "gender", "homme/femme", "h/f", "categorie", "category"]);
  const fromHeader = normSex(byHeader);
  if (fromHeader) return fromHeader;
  for (const key of Object.keys(row)) {
    const s = normSex(row[key]);
    if (s) return s;
  }
  return "";
}

// A friendly emoji per category (used only when a product has no image).
function emojiFor(category) {
  const c = normHeader(category);
  if (c.includes("shoe") || c.includes("chauss")) return "👟";
  if (c.includes("cloth") || c.includes("vetement") || c.includes("habill")) return "👕";
  if (c.includes("candy") || c.includes("coffee") || c.includes("choco") || c.includes("sucr")) return "🍬";
  if (c.includes("parfum") || c.includes("accessoire")) return "🧴";
  if (c.includes("sport")) return "🏅";
  if (c.includes("electro") || c.includes("electronic") || c.includes("menager")) return "🔌";
  return "🛍️";
}

// Parse a French/European formatted price like "1 170,00" or "170,00 TND" → 170
function parsePrice(text) {
  if (!text) return NaN;
  let t = String(text).replace(/\s|tnd|dt|€|eur/gi, "");
  // If both separators present, assume "." thousands and "," decimal → drop dots, comma→dot
  if (t.includes(",") && t.includes(".")) t = t.replace(/\./g, "").replace(",", ".");
  else t = t.replace(",", "."); // single comma = decimal
  const n = Number(t);
  return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-cast: map one spreadsheet row (shoe model) → website product model.
// Returns { product } for available items, or { skip, reason } otherwise.
// ─────────────────────────────────────────────────────────────────────────────
export function mapRowToProduct(row, categoryName = "") {
  const rawName = pickName(row);
  const priceText = pickSellingPrice(row);
  const categoryRaw = pick(row, ["categorie", "category", "rayon", "section", "type"]);
  const size = pick(row, ["taille", "pointure", "size"]);
  const etat = pick(row, ["etat", "status", "statut", "state", "disponibilite"]);
  const photo = pick(row, ["photo", "image", "img", "image url", "imageurl", "photo url"]);
  const barcode = pick(row, ["code a barre", "code barre", "barcode", "sku", "ean"]);
  const id = pick(row, ["id", "ref", "reference"]);
  const sex = pickSex(row);

  const price = parsePrice(priceText);

  // Build a stable identity. Prefer barcode, then id. Namespace by the tab/category
  // so two sheets can't collide on the same short id (e.g. C1 in two tabs).
  const key = barcode || id;
  const sourceKey = key ? `${categoryName || "src"}:${key}` : null;

  // Raw detected values, surfaced in the sync report so misconfigured columns are obvious.
  const detected = { rawName, priceText, price, etat, sex, size, barcode: barcode || id };

  if (!rawName || Number.isNaN(price) || price <= 0) {
    return { skip: true, reason: "missing name or price", sourceKey, detected };
  }

  // Stock status from Etat. Sold/unavailable items are STILL listed (with a badge);
  // they just can't be added to the cart.
  const e = normHeader(etat);
  let status = "available";
  if (e.includes("vendu") || e.includes("sold")) status = "sold";
  else if (e.includes("trouv") || e.includes("rupture") || e.includes("indispo")) status = "unavailable";

  // Category: prefer the tab name (the sheet is organised by category). Fall back to an
  // explicit category column only if present and not actually a Homme/Femme value.
  let category = categoryName || "Divers";
  if (categoryRaw && !normSex(categoryRaw)) category = categoryRaw;

  const name = size ? `${rawName} — ${size}` : rawName;
  const img = /^https?:\/\//i.test(photo) ? photo : "";

  return {
    product: {
      sourceKey,
      name,
      price,
      category,
      categories: [category],
      sex,
      status,
      emoji: emojiFor(category),
      img,
      badge: size ? `Taille ${size}` : "",
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch + sync all configured sources. Upserts available products by sourceKey,
// removes sync-managed products that are no longer available. Never touches
// manually-added products (those have no sourceKey).
// ─────────────────────────────────────────────────────────────────────────────
export async function syncFromSheets() {
  const cfg = await getSyncConfig();
  const report = {
    startedAt: new Date().toISOString(),
    sources: [],
    upserted: 0,
    removed: 0,
    skipped: 0,
    errors: [],
  };

  const seenKeys = new Set();
  let fetchFailures = 0;

  // Expand each configured source (a whole-document link) into its tabs.
  const tabs = [];
  for (const source of cfg.sources) {
    try {
      const expanded = await expandSource(source);
      tabs.push(...expanded);
    } catch (err) {
      fetchFailures++;
      report.errors.push({ source: source.label || source.url, message: err.message });
      report.sources.push({ label: source.label || source.url, error: err.message, rows: 0, upserted: 0, skipped: 0 });
    }
  }

  for (const tab of tabs) {
    const srcReport = { label: tab.categoryName, url: tab.csvUrl, rows: 0, upserted: 0, skipped: 0, headers: [], skippedSamples: [] };
    try {
      const res = await fetch(tab.csvUrl, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // Guard: a CSV never starts with HTML. This catches a non-public link.
      if (/^\s*<(?:!doctype|html)/i.test(text)) {
        throw new Error("Link returned a web page, not CSV. Publish the whole document to web so every tab is public.");
      }
      const parsed = parseCsv(text);
      const objects = rowsToObjects(parsed);
      srcReport.rows = objects.length;
      srcReport.headers = parsed.length ? parsed[0].map((h) => String(h).trim()) : [];

      for (const row of objects) {
        const mapped = mapRowToProduct(row, tab.categoryName);
        if (mapped.skip) {
          srcReport.skipped++; report.skipped++;
          if (srcReport.skippedSamples.length < 5) {
            srcReport.skippedSamples.push({ reason: mapped.reason, ...mapped.detected });
          }
          continue;
        }
        const { product } = mapped;
        if (!product.sourceKey) { srcReport.skipped++; report.skipped++; continue; }
        if (seenKeys.has(product.sourceKey)) continue; // dedupe within run
        seenKeys.add(product.sourceKey);

        // Update only synced fields — preserve reactions/comments on existing docs.
        await Product.findOneAndUpdate(
          { sourceKey: product.sourceKey },
          { $set: product },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        srcReport.upserted++;
        report.upserted++;
      }
    } catch (err) {
      fetchFailures++;
      srcReport.error = err.message;
      report.errors.push({ source: tab.categoryName, message: err.message });
    }
    report.sources.push(srcReport);
  }

  // Remove sync-managed products whose row was DELETED from the sheet (have a sourceKey
  // but weren't seen this run). Sold items are NOT removed — they were upserted with
  // status:"sold". Guarded: skip removal entirely if any fetch failed, so a temporarily
  // unreachable document never wipes the catalog.
  if (cfg.sources.length > 0 && fetchFailures === 0 && seenKeys.size > 0) {
    const del = await Product.deleteMany({
      sourceKey: { $type: "string", $nin: [...seenKeys] },
    });
    report.removed = del.deletedCount || 0;
  }

  report.finishedAt = new Date().toISOString();
  await SyncConfig.updateOne({ _id: cfg._id }, { $set: { lastRunAt: new Date(), lastReport: report } });
  return report;
}
