import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, getEnv } from "../_shared/supabase.ts";
import { assertUpperAlpha, getUtcDateString, json } from "../_shared/utils.ts";

function getUtcHour(now = new Date()): number {
  return now.getUTCHours();
}

function requireAdminKey(req: Request) {
  const provided = req.headers.get("x-admin-key") ?? "";
  const expected = getEnv("ADMIN_PUZZLE_KEY");
  if (!provided || provided !== expected) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
}

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

function pickPositions(count: number): number[] {
  const all = [0, 1, 2, 3, 4, 5];
  return shuffle(all).slice(0, Math.max(0, Math.min(6, count))).sort((a, b) => a - b);
}

function buildCipherWord(target: string, shiftAmount: number, dir: -1 | 1, unshiftedIdx: Set<number>): string {
  const delta = dir * shiftAmount;
  const chars = target.split("").map((c, i) => (unshiftedIdx.has(i) ? c : shiftChar(c, delta)));
  return chars.join("");
}

function buildLetterSet(targetChar: string, shiftAmount: number, dir: -1 | 1): string[] {
  const delta = dir * shiftAmount;
  const candidates = uniq([
    shiftChar(targetChar, delta),
    shiftChar(targetChar, delta + dir * 1),
    shiftChar(targetChar, delta - dir * 1),
    shiftChar(targetChar, delta + dir * 2),
    shiftChar(targetChar, delta - dir * 2),
    shiftChar(targetChar, 1),
    shiftChar(targetChar, -1),
  ]).filter((c) => c !== targetChar);

  const decoys: string[] = [];
  for (const c of candidates) {
    if (decoys.length >= 4) break;
    decoys.push(c);
  }

  while (decoys.length < 4) {
    const r = crypto.getRandomValues(new Uint32Array(1))[0] % 26;
    const c = nToChar(r);
    if (c === targetChar) continue;
    if (decoys.includes(c)) continue;
    decoys.push(c);
  }

  return shuffle([targetChar, ...decoys]);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    requireAdminKey(req);
    const body = await req.json().catch(() => ({}));

    const puzzle_date = String(body?.puzzle_date ?? getUtcDateString());
    const puzzle_hour = body?.puzzle_hour == null ? getUtcHour() : Number(body.puzzle_hour);
    const target_word = String(body?.target_word ?? "");
    const theme_hint = body?.theme_hint != null ? String(body.theme_hint) : null;
    const overwrite = Boolean(body?.overwrite ?? false);

    if (!Number.isFinite(puzzle_hour) || puzzle_hour < 0 || puzzle_hour > 23) {
      return json({ error: "Invalid puzzle_hour (expected 0-23)" }, { status: 400, headers: corsHeaders });
    }
    assertUpperAlpha(target_word, 6);

    // Per puzzle: one shift amount, one direction; some positions unshifted.
    const shift_amount = Number(body?.shift_amount ?? 0) || (crypto.getRandomValues(new Uint32Array(1))[0] % 25) + 1; // 1..25
    const dir = (body?.direction === "left" ? -1 : body?.direction === "right" ? 1 : (crypto.getRandomValues(new Uint32Array(1))[0] % 2 === 0 ? 1 : -1)) as -1 | 1;

    const unshiftedCount = Math.max(0, Math.min(5, Number(body?.unshifted_count ?? 2))); // default 2
    const unshiftedPositions = pickPositions(unshiftedCount);
    const unshiftedSet = new Set<number>(unshiftedPositions);

    const cipher_word = buildCipherWord(target_word, shift_amount, dir, unshiftedSet);
    const letter_sets = target_word.split("").map((c) => buildLetterSet(c, shift_amount, dir));

    const admin = supabaseAdmin();
    const payload = {
      puzzle_date,
      puzzle_hour,
      target_word,
      cipher_word,
      letter_sets,
      theme_hint,
    };

    const q = overwrite
      ? admin.from("puzzles").upsert(payload, { onConflict: "puzzle_date,puzzle_hour" })
      : admin.from("puzzles").insert(payload);

    const { data, error } = await q.select("id,puzzle_date,puzzle_hour,cipher_word,letter_sets,theme_hint").single();

    if (error) {
      // Friendly status for common uniqueness violation when overwrite=false.
      const msg = error.message ?? "Database error";
      if (!overwrite && (msg.toLowerCase().includes("idx_puzzles_date_hour_unique") || msg.toLowerCase().includes("duplicate key"))) {
        return json(
          { error: "Puzzle already exists for that date/hour. Re-run with overwrite=true or choose a different puzzle_date/puzzle_hour." },
          { status: 409, headers: corsHeaders },
        );
      }
      return json({ error: msg }, { status: 500, headers: corsHeaders });
    }

    // Return extra metadata for admin verification (direction is included here; do NOT show to players).
    return json(
      { puzzle: data, meta: { shift_amount, direction: dir === 1 ? "right" : "left", unshifted_positions: unshiftedPositions.map((i) => i + 1) } },
      { headers: corsHeaders },
    );
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});

