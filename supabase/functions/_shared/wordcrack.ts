export type HintType = "check_positions" | "reveal_position" | "reveal_theme" | "shift_amount" | "unshifted_positions";

export const HINT_PENALTY_MS: Record<HintType, number> = {
  check_positions: 5_000,
  reveal_position: 8_000,
  reveal_theme: 6_000,
  shift_amount: 5_000,
  unshifted_positions: 10_000,
};

const WORD_LEN = 5;

export function computeShiftedPositions(cipherWord: string, targetWord: string): boolean[] {
  if (cipherWord.length !== WORD_LEN || targetWord.length !== WORD_LEN) {
    throw new Error(`Expected ${WORD_LEN}-letter cipher and target words`);
  }
  return Array.from({ length: WORD_LEN }, (_, i) => cipherWord[i] !== targetWord[i]);
}

function charToN(c: string): number {
  const code = c.charCodeAt(0);
  return code - 65;
}

function shiftAmount(cipherWord: string, targetWord: string): number | null {
  const shifted = computeShiftedPositions(cipherWord, targetWord);
  const idx = shifted.findIndex((v) => v);
  if (idx < 0) return null;
  const t = charToN(targetWord[idx]);
  const c = charToN(cipherWord[idx]);
  const diff = (c - t + 26) % 26;
  if (diff === 0) return null;
  // Do NOT reveal direction; return magnitude only.
  return Math.min(diff, 26 - diff);
}

function pickRandom<T>(arr: T[], count: number): T[] {
  if (count <= 0) return [];
  if (arr.length <= count) return [...arr];

  const copy = [...arr];
  // Fisher–Yates shuffle partial
  for (let i = copy.length - 1; i > 0; i--) {
    const r = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    const tmp = copy[i];
    copy[i] = copy[r];
    copy[r] = tmp;
  }
  return copy.slice(0, count);
}

export function buildHintMessage(args: {
  hintType: HintType;
  cipherWord: string;
  targetWord: string;
  themeHint: string | null;
  guessWord?: string | null;
}): { message: string; meta?: Record<string, unknown> } {
  if (args.targetWord.length !== WORD_LEN || args.cipherWord.length !== WORD_LEN) {
    throw new Error(`Expected ${WORD_LEN}-letter cipher and target words`);
  }

  if (args.hintType === "shift_amount") {
    const amount = shiftAmount(args.cipherWord, args.targetWord);
    if (amount == null) return { message: "No shift detected (already solved).", meta: { shiftAmount: null } };
    return { message: `Shift amount: ${amount} (direction hidden).`, meta: { shiftAmount: amount } };
  }

  if (args.hintType === "unshifted_positions") {
    const shifted = computeShiftedPositions(args.cipherWord, args.targetWord);
    const unshiftedIdx = shifted
      .map((v, i) => ({ v, i }))
      .filter((x) => !x.v)
      .map((x) => x.i + 1);
    if (unshiftedIdx.length === 0) {
      return { message: `All ${WORD_LEN} positions are shifted.`, meta: { unshiftedPositions: [] } };
    }
    const picked = pickRandom(unshiftedIdx, Math.min(2, unshiftedIdx.length));
    if (picked.length === 1) return { message: `Position ${picked[0]} is unshifted.`, meta: { unshiftedPositions: picked } };
    return { message: `Positions ${picked[0]} and ${picked[1]} are unshifted.`, meta: { unshiftedPositions: picked } };
  }

  if (args.hintType === "check_positions") {
    const guess = String(args.guessWord ?? "");
    if (guess.length !== WORD_LEN) {
      return { message: `Select all ${WORD_LEN} letters first, then use this hint.`, meta: { requiresGuess: true } };
    }
    const correctPositions = Array.from({ length: WORD_LEN }, (_, i) => (guess[i] === args.targetWord[i] ? i + 1 : null)).filter(
      (x): x is number => x != null,
    );
    const count = correctPositions.length;
    if (count === 0) {
      return { message: "None of your selected letters are in the correct position.", meta: { correctCount: 0, correctPositions: [] } };
    }
    if (count === WORD_LEN) {
      return { message: "All 5 letters are in the correct position. Submit!", meta: { correctCount: 5, correctPositions } };
    }
    return {
      message: `Correct positions: ${count} (${correctPositions.join(", ")}).`,
      meta: { correctCount: count, correctPositions },
    };
  }

  if (args.hintType === "reveal_position") {
    const pos0 = crypto.getRandomValues(new Uint32Array(1))[0] % WORD_LEN; // 0..4
    const position = pos0 + 1;
    const letter = args.targetWord[pos0];
    return {
      message: `Position ${position} is ${letter}.`,
      meta: { position, letter },
    };
  }

  // reveal_theme
  const theme = (args.themeHint ?? "").trim();
  if (!theme) return { message: "No theme hint available for this puzzle.", meta: { theme: null } };
  return { message: `Theme hint: ${theme}`, meta: { theme } };
}


