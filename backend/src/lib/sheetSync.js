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
export function mapRowToProduct(row, sourceLabel = "") {
  const rawName = pickName(row);
  const priceText = pickSellingPrice(row);
  const categoryRaw = pick(row, ["categorie", "category", "genre", "type"]);
  const size = pick(row, ["taille", "pointure", "size"]);
  const etat = pick(row, ["etat", "status", "statut", "state"]);
  const photo = pick(row, ["photo", "image", "img", "image url", "imageurl"]);
  const barcode = pick(row, ["code a barre", "code barre", "barcode", "sku", "ean"]);
  const id = pick(row, ["id", "ref", "reference"]);

  const price = parsePrice(priceText);

  // Build a stable identity. Prefer barcode, then id. Namespace by source label so
  // two sheets can't collide on the same short id.
  const key = barcode || id;
  const sourceKey = key ? `${sourceLabel || "src"}:${key}` : null;

  // Raw detected values, surfaced in the sync report so misconfigured columns are obvious.
  const detected = { rawName, priceText, price, etat, categoryRaw, size, barcode: barcode || id };

  if (!rawName || Number.isNaN(price) || price <= 0) {
    return { skip: true, reason: "missing name or price", sourceKey, detected };
  }

  // Availability: an item is for-sale UNLESS its Etat clearly marks it sold or missing.
  // (Empty/unknown Etat → still listed, so a dropdown that doesn't export cleanly
  // doesn't silently hide the whole catalog.)
  const e = normHeader(etat);
  const notForSale = e.includes("vendu") || e.includes("trouv") || e.includes("sold");
  if (notForSale) {
    return { skip: true, reason: `etat=${etat || "empty"}`, sourceKey, detected };
  }

  const name = size ? `${rawName} — ${size}` : rawName;
  const categories = categoryRaw
    ? categoryRaw.split(",").map((c) => c.trim()).filter(Boolean)
    : ["Chaussures"];
  const img = /^https?:\/\//i.test(photo) ? photo : "";

  return {
    product: {
      sourceKey,
      name,
      price,
      category: categories[0],
      categories,
      emoji: "👟",
      img,
      badge: size ? `Pointure ${size}` : "",
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

  for (const source of cfg.sources) {
    const srcReport = { label: source.label, url: source.url, rows: 0, upserted: 0, skipped: 0, headers: [], skippedSamples: [] };
    try {
      const res = await fetch(source.url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const parsed = parseCsv(text);
      const objects = rowsToObjects(parsed);
      srcReport.rows = objects.length;
      srcReport.headers = parsed.length ? parsed[0].map((h) => String(h).trim()) : [];

      for (const row of objects) {
        const mapped = mapRowToProduct(row, source.label);
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
      srcReport.error = err.message;
      report.errors.push({ source: source.label || source.url, message: err.message });
    }
    report.sources.push(srcReport);
  }

  // Remove sync-managed products that vanished/sold (have a sourceKey but weren't seen).
  // Guarded: only runs if at least one source was fetched without error, to avoid wiping
  // the catalog when a sheet is temporarily unreachable.
  if (cfg.sources.length > 0 && report.errors.length < cfg.sources.length) {
    const del = await Product.deleteMany({
      sourceKey: { $type: "string", $nin: [...seenKeys] },
    });
    report.removed = del.deletedCount || 0;
  }

  report.finishedAt = new Date().toISOString();
  await SyncConfig.updateOne({ _id: cfg._id }, { $set: { lastRunAt: new Date(), lastReport: report } });
  return report;
}
