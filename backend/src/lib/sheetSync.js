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
  const rawName = pick(row, ["$", "name", "nom", "produit", "article", "designation", "modele", "model"]);
  const priceText = pick(row, ["prix vente en tnd", "prix vente", "prix de vente", "prix vente tnd", "selling price", "prix", "price"]);
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

  if (!rawName || Number.isNaN(price) || price <= 0) {
    return { skip: true, reason: "missing name or price", sourceKey };
  }

  // Availability: only "En cours" (in stock) items go live. Everything else
  // (Vendu / Non trouver / empty) is treated as not-for-sale and will be removed.
  const available = normHeader(etat) === "en cours";
  if (!available) {
    return { skip: true, reason: `etat=${etat || "empty"}`, sourceKey };
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
    const srcReport = { label: source.label, url: source.url, rows: 0, upserted: 0, skipped: 0 };
    try {
      const res = await fetch(source.url, { redirect: "follow" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const objects = rowsToObjects(parseCsv(text));
      srcReport.rows = objects.length;

      for (const row of objects) {
        const mapped = mapRowToProduct(row, source.label);
        if (mapped.skip) { srcReport.skipped++; report.skipped++; continue; }
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
