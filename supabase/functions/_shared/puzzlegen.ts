function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const r = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    const tmp = a[i];
    a[i] = a[r];
    a[r] = tmp;
  }
  return a;
}

const WORD_LEN = 5;

export type PuzzleGenMeta = {
  scramble_attempts: number;
  cipher_is_scrambled: boolean;
};

function nToChar(n: number): string {
  return String.fromCharCode(65 + ((n % 26) + 26) % 26);
}

function shiftChar(c: string, delta: number): string {
  const n = c.charCodeAt(0) - 65;
  return nToChar(n + delta);
}

function uniq(arr: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const x of arr) {
    if (!seen.has(x)) {
      seen.add(x);
      out.push(x);
    }
  }
  return out;
}

export type CipherPuzzleGenMeta = {
  shift_amount: number;
  direction: "left" | "right";
  unshifted_positions_1based: number[];
};

function pickPositions(count: number): number[] {
  const all = Array.from({ length: WORD_LEN }, (_, i) => i);
  return shuffle(all).slice(0, Math.max(0, Math.min(WORD_LEN, count))).sort((a, b) => a - b);
}

export function generateCipherPuzzleFromTarget(args: {
  target_word: string; // uppercase 5
  unshifted_count?: number; // default 1
  shift_amount?: number; // default random 1..25
  direction?: "left" | "right"; // default random
}): { cipher_word: string; letter_sets: string[][]; start_idxs: number[]; meta: CipherPuzzleGenMeta } {
  const target = args.target_word;
  const shift_amount = Number(args.shift_amount ?? 0) || (crypto.getRandomValues(new Uint32Array(1))[0] % 25) + 1; // 1..25
  const dir: -1 | 1 =
    args.direction === "left" ? -1 : args.direction === "right" ? 1 : (crypto.getRandomValues(new Uint32Array(1))[0] % 2 === 0 ? 1 : -1);
  const unshiftedCount = Math.max(0, Math.min(WORD_LEN - 1, Number(args.unshifted_count ?? 1)));
  const unshiftedPositions = pickPositions(unshiftedCount);
  const unshiftedSet = new Set<number>(unshiftedPositions);

  const delta = dir * shift_amount;
  const cipher_word = target
    .split("")
    .map((c, i) => (unshiftedSet.has(i) ? c : shiftChar(c, delta)))
    .join("");

  // Build exactly 5 candidates per column: 1 correct + 4 decoys.
  // Bias decoys toward the cipher letter and adjacent letters (plausible mistakes).
  const neighborDeltas = [-2, -1, 1, 2, -3, 3, -4, 4];
  const letter_sets = target.split("").map((targetChar, i) => {
    const cipherChar = cipher_word[i] ?? targetChar;
    const seed = uniq([
      targetChar,
      cipherChar,
      shiftChar(targetChar, -1),
      shiftChar(targetChar, 1),
      shiftChar(cipherChar, -1),
      shiftChar(cipherChar, 1),
      // include the shifted variant even if this position is unshifted elsewhere
      shiftChar(targetChar, delta),
      shiftChar(targetChar, delta + dir * 1),
      shiftChar(targetChar, delta - dir * 1),
    ]);

    const out: string[] = [];
    for (const c of seed) {
      if (out.length >= 5) break;
      if (!out.includes(c)) out.push(c);
    }

    let k = 0;
    while (out.length < 5 && k < neighborDeltas.length) {
      const c = shiftChar(targetChar, neighborDeltas[k]);
      if (!out.includes(c)) out.push(c);
      k++;
    }

    while (out.length < 5) {
      const r = crypto.getRandomValues(new Uint32Array(1))[0] % 26;
      const c = nToChar(r);
      if (!out.includes(c)) out.push(c);
    }

    return shuffle(out).slice(0, 5);
  });

  const start_idxs = letter_sets.map((col, i) => {
    const targetChar = target[i];
    const correctIdx = col.findIndex((c) => c === targetChar);
    const candidates = [0, 1, 2, 3, 4].filter((x) => x !== correctIdx);
    const r = crypto.getRandomValues(new Uint32Array(1))[0] % candidates.length;
    return candidates[r] ?? 0;
  });

  return {
    cipher_word,
    letter_sets,
    start_idxs,
    meta: {
      shift_amount,
      direction: dir === 1 ? "right" : "left",
      unshifted_positions_1based: unshiftedPositions.map((i) => i + 1),
    },
  };
}

export function generateScramblePuzzleFromTarget(args: {
  target_word: string; // uppercase 6 (for scramble), but we infer length
  // legacy params (no longer used, kept so admin-create-puzzle doesn't break)
  unshifted_count?: number;
  shift_amount?: number;
  direction?: "left" | "right";
}): { cipher_word: string; letter_sets: string[][]; start_idxs: number[]; meta: PuzzleGenMeta } {
  const target = args.target_word;
  const len = target.length;

  // Scramble the target word (anagram) for display. Try to avoid returning the original order.
  const letters = target.split("");
  let cipher_word = target;
  let attempts = 0;
  while (attempts < 12) {
    attempts++;
    const candidate = shuffle(letters).join("");
    cipher_word = candidate;
    if (candidate !== target) break;
  }
  const cipher_is_scrambled = cipher_word !== target;

  // Each column cycles through the letters of the target word (same multiset), in a randomized order.
  const letter_sets = Array.from({ length: len }, () => shuffle(letters));

  // Choose a starting index for each column that is NOT the correct target letter.
  // This prevents the "already solved-looking" start state.
  const start_idxs = letter_sets.map((col, i) => {
    const targetChar = target[i];
    const candidates = col
      .map((c, idx) => ({ c, idx }))
      .filter((x) => x.c !== targetChar)
      .map((x) => x.idx);
    if (candidates.length === 0) return 0;
    const r = crypto.getRandomValues(new Uint32Array(1))[0] % candidates.length;
    return candidates[r] ?? 0;
  });

  return {
    cipher_word,
    letter_sets,
    start_idxs,
    meta: {
      scramble_attempts: attempts,
      cipher_is_scrambled,
    },
  };
}

// Backwards compatibility: if callers haven't been updated, treat as scramble.
export const generatePuzzleFromTarget = generateScramblePuzzleFromTarget;
