/**
 * Append new unique 5-letter puzzles to `puzzle_bank.json`.
 *
 * - Avoids duplicates already present in the file
 * - Generates non-revealing generic theme hints
 * - Uses a local word list if available, else tries system dictionaries
 *
 * Usage:
 *   node scripts/append-puzzle-bank.js --count 30
 *   node scripts/append-puzzle-bank.js --count 30 --file puzzle_bank.json
 *   node scripts/append-puzzle-bank.js --count 30 --dry-run
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function getArg(name) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

function hasFlag(name) {
  return process.argv.includes(name);
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

function readWordCandidates() {
  const candidates = new Set();

  // Prefer a repo-local list (you can expand this over time).
  const localList = path.resolve(__dirname, "wordlist_5.txt");
  const sources = [
    localList,
    "/usr/share/dict/words",
    "/usr/dict/words",
  ];

  for (const p of sources) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const w = line.trim();
        if (!w) continue;
        if (!/^[A-Za-z]{5}$/.test(w)) continue;
        candidates.add(w.toUpperCase());
      }
      // If we successfully read a local list, that's enough.
      if (p === localList) break;
    } catch {
      // ignore
    }
  }

  return Array.from(candidates);
}

const GENERIC_HINTS = [
  "Everyday word",
  "Common category",
  "Abstract",
  "Made thing",
  "Action or state",
  "Something you know",
  "Think broadly",
  "Not too specific",
  "General theme",
  "Wildcard",
];

function pickHint() {
  return GENERIC_HINTS[crypto.randomInt(0, GENERIC_HINTS.length)];
}

async function main() {
  const fileArg = getArg("--file");
  const countArg = getArg("--count");
  const dryRun = hasFlag("--dry-run");

  const filePath = path.resolve(process.cwd(), fileArg || "puzzle_bank.json");
  const count = Math.max(1, Math.min(500, Number(countArg ?? "30")));

  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("Expected puzzle_bank.json to be an array.");

  const existing = new Set(
    parsed
      .map((x) => String(x?.target_word ?? "").trim().toUpperCase())
      .filter(Boolean),
  );

  const words = readWordCandidates();
  if (words.length < count + 50) {
    throw new Error(
      `Word source is too small (${words.length} candidates). Add more words to scripts/wordlist_5.txt.`,
    );
  }

  const picked = [];
  for (const w of shuffle(words)) {
    if (picked.length >= count) break;
    if (existing.has(w)) continue;
    assertUpperAlpha5(w);
    existing.add(w);
    picked.push({ target_word: w, theme_hint: pickHint() });
  }

  if (picked.length < count) {
    throw new Error(`Could only pick ${picked.length}/${count} unique words. Add more candidates to the word list.`);
  }

  const next = [...parsed, ...picked];

  if (dryRun) {
    console.log(`Would append ${picked.length} puzzles to ${path.basename(filePath)}:`);
    console.log(picked.map((p) => p.target_word).join(", "));
    return;
  }

  fs.writeFileSync(filePath, JSON.stringify(next, null, 2) + "\n", "utf8");
  console.log(`Appended ${picked.length} puzzles to ${path.basename(filePath)}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

