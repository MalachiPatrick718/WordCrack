/**
 * Replenish Supabase `puzzle_bank` with N new unique 5-letter words.
 *
 * - Does NOT modify puzzle_bank.json
 * - Avoids duplicates by fetching existing target_word values from the DB
 * - Uses scripts/wordlist_5.txt as the candidate pool (expand anytime)
 * - Adds generic, non-revealing theme hints
 *
 * Usage:
 *   SUPABASE_URL="..." SUPABASE_SERVICE_ROLE_KEY="..." node scripts/replenish-puzzle-bank.js --count 30
 *   node scripts/replenish-puzzle-bank.js --count 30 --min-buffer 300
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

function getArg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

function assertUpperAlpha5(s) {
  if (typeof s !== "string" || !/^[A-Z]{5}$/.test(s)) {
    throw new Error(`Invalid word "${s}". Expected 5 uppercase letters A-Z.`);
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const r = crypto.randomInt(0, i + 1);
    const tmp = a[i];
    a[i] = a[r];
    a[r] = tmp;
  }
  return a;
}

const GENERIC_HINTS = [
  "Common category",
  "Everyday word",
  "Abstract",
  "Made thing",
  "Action or state",
  "Think broadly",
  "General theme",
  "Wildcard",
];

function pickHint() {
  return GENERIC_HINTS[crypto.randomInt(0, GENERIC_HINTS.length)];
}

function readWordlist5() {
  const p = path.resolve(__dirname, "wordlist_5.txt");
  const raw = fs.readFileSync(p, "utf8");
  const out = [];
  for (const line of raw.split(/\r?\n/)) {
    const w = line.trim().toUpperCase();
    if (!w) continue;
    if (!/^[A-Z]{5}$/.test(w)) continue;
    out.push(w);
  }
  return Array.from(new Set(out));
}

async function fetchAllExistingWords(supabase) {
  const existing = new Set();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("puzzle_bank")
      .select("target_word")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const r of rows) {
      const w = String(r.target_word ?? "").toUpperCase();
      if (w) existing.add(w);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return existing;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }

  const count = Math.max(1, Math.min(500, Number(getArg("--count") ?? "30")));
  const minBuffer = Math.max(0, Math.min(5000, Number(getArg("--min-buffer") ?? "0")));
  const kindArg = (getArg("--kind") ?? "daily").trim();
  const kind = kindArg === "practice" ? "practice" : "daily";

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const existing = await fetchAllExistingWords(supabase);

  // Optional: if you always want a big backlog, skip replenishing when already large.
  if (minBuffer > 0 && existing.size >= minBuffer) {
    console.log(`Puzzle bank already has ${existing.size} entries (>= ${minBuffer}). Skipping.`);
    return;
  }

  const candidates = readWordlist5();
  const picked = [];
  for (const w of shuffle(candidates)) {
    if (picked.length >= count) break;
    if (existing.has(w)) continue;
    assertUpperAlpha5(w);
    existing.add(w);
    picked.push({
      target_word: w,
      theme_hint: pickHint(),
      kind,
      enabled: true,
      // Don't jump the queue ahead of older entries:
      // mark as "recently used" so the LRU selector continues through older puzzles.
      last_used_at: new Date().toISOString(),
    });
  }

  if (picked.length < count) {
    throw new Error(
      `Could only pick ${picked.length}/${count} unique words. Add more to scripts/wordlist_5.txt.`,
    );
  }

  const { error } = await supabase.from("puzzle_bank").upsert(picked, { onConflict: "target_word" });
  if (error) throw new Error(error.message);

  console.log(`Inserted ${picked.length} new puzzle_bank entries.`);
  console.log(picked.map((p) => p.target_word).join(", "));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

