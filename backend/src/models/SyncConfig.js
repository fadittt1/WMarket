import mongoose from "mongoose";

// A single configured spreadsheet source.
const SourceSchema = new mongoose.Schema(
  {
    label: { type: String, default: "" }, // e.g. "Shoes", "Bags" — used to namespace sourceKeys
    url: { type: String, required: true }, // Google Sheets "Publish to web → CSV" link
  },
  { _id: false }
);

// Singleton document holding the list of sheet sources + last sync info.
const SyncConfigSchema = new mongoose.Schema(
  {
    sources: { type: [SourceSchema], default: [] },
    lastRunAt: { type: Date, default: null },
    lastReport: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: true }
);

export const SyncConfig = mongoose.model("SyncConfig", SyncConfigSchema);

// Always operate on one document.
export async function getSyncConfig() {
  let cfg = await SyncConfig.findOne();
  if (!cfg) cfg = await SyncConfig.create({ sources: [] });
  return cfg;
}
