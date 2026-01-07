export type HintType = "shift_count" | "shift_position" | "theme";

export const HINT_PENALTY_MS: Record<HintType, number> = {
  shift_count: 5_000,
  shift_position: 10_000,
  theme: 8_000,
};

export function computeShiftedPositions(cipherWord: string, targetWord: string): boolean[] {
  if (cipherWord.length !== 6 || targetWord.length !== 6) {
    throw new Error("Expected 6-letter cipher and target words");
  }
  return Array.from({ length: 6 }, (_, i) => cipherWord[i] !== targetWord[i]);
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
}): { message: string; meta?: Record<string, unknown> } {
  const shifted = computeShiftedPositions(args.cipherWord, args.targetWord);
  const shiftedIdx = shifted
    .map((v, i) => ({ v, i }))
    .filter((x) => x.v)
    .map((x) => x.i + 1); // 1-based positions
  const unshiftedIdx = shifted
    .map((v, i) => ({ v, i }))
    .filter((x) => !x.v)
    .map((x) => x.i + 1);

  if (args.hintType === "shift_count") {
    const count = shiftedIdx.length;
    return { message: `${count} of the 6 letters are shifted.`, meta: { shiftedCount: count } };
  }

  if (args.hintType === "shift_position") {
    if (unshiftedIdx.length === 0) {
      return { message: "All 6 positions are shifted.", meta: { unshiftedPositions: [] } };
    }
    const picked = pickRandom(unshiftedIdx, Math.min(2, unshiftedIdx.length));
    if (picked.length === 1) {
      return {
        message: `Position ${picked[0]} is unshifted.`,
        meta: { unshiftedPositions: picked },
      };
    }
    return {
      message: `Positions ${picked[0]} and ${picked[1]} are unshifted.`,
      meta: { unshiftedPositions: picked },
    };
  }

  // theme
  const theme = (args.themeHint ?? "").trim();
  return { message: `Theme: ${theme || "Unknown"}` };
}


