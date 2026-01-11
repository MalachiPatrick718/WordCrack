/**
 * Seed the Supabase `puzzle_bank` table from `puzzle_bank.json`.
 *
 * Usage:
 *   SUPABASE_URL="https://<ref>.supabase.co" SUPABASE_SERVICE_ROLE_KEY="..." node scripts/seed-puzzle-bank.js
 *   node scripts/seed-puzzle-bank.js --file puzzle_bank.json
 */

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function getArg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

function assertUpperAlpha(s, len) {
  if (typeof s !== "string" || !new RegExp(`^[A-Z]{${len}}$`).test(s)) {
    throw new Error(`Invalid target_word "${s}". Expected ${len} uppercase letters A-Z.`);
  }
}

async function main() {
  const fileArg = getArg("--file");
  const filePath = path.resolve(process.cwd(), fileArg || "puzzle_bank.json");
  const kindArg = (getArg("--kind") ?? "daily").trim();
  const kind = kindArg === "practice" ? "practice" : "daily";
  const variantArg = (getArg("--variant") ?? "cipher").trim().toLowerCase();
  const variant = variantArg === "scramble" ? "scramble" : "cipher";
  const len = variant === "cipher" ? 5 : 6;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Expected puzzle bank JSON to be an array.");

  const rows = parsed.map((x, idx) => {
    const target_word = String(x?.target_word ?? "").trim();
    const theme_hint = String(x?.theme_hint ?? "").trim();
    assertUpperAlpha(target_word, len);
    if (!theme_hint) throw new Error(`Row ${idx} missing theme_hint for ${target_word}.`);
    return { target_word, theme_hint, kind, variant, enabled: x?.enabled == null ? true : Boolean(x.enabled) };
  });

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Upsert by target_word so you can re-run safely.
  const { error } = await supabase.from("puzzle_bank").upsert(rows, { onConflict: "target_word" });
  if (error) throw new Error(error.message);

  console.log(`Seeded puzzle_bank: ${rows.length} rows (${variant}, ${kind}) from ${path.basename(filePath)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

