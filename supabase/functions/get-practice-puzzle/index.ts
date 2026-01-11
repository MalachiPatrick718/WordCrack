import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getUtcDateString, json } from "../_shared/utils.ts";
import { withCors } from "../_shared/http.ts";
import { assertUpperAlpha } from "../_shared/utils.ts";
import { generateCipherPuzzleFromTarget, generateScramblePuzzleFromTarget } from "../_shared/puzzlegen.ts";

function letterSetContains(set: unknown, letter: string): boolean {
  if (!Array.isArray(set)) return false;
  return set.includes(letter);
}

function isValidCipherPuzzle(target: string, cipher: string, letter_sets: unknown): boolean {
  try {
    if (typeof target !== "string" || typeof cipher !== "string") return false;
    if (target.length !== 5 || cipher.length !== 5) return false;
    if (!Array.isArray(letter_sets) || letter_sets.length !== 5) return false;
    for (let i = 0; i < 5; i++) {
      const col = (letter_sets as unknown[])[i];
      if (!letterSetContains(col, target[i])) return false;
      if (!letterSetContains(col, cipher[i])) return false;
    }
    return true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const user = await requireUser(req);
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const variant = String((body as any)?.variant ?? url.searchParams.get("variant") ?? "scramble").toLowerCase();
    const dryRun = Boolean((body as any)?.dry_run ?? false);
    if (variant !== "cipher" && variant !== "scramble") {
      return json({ error: "Invalid variant (expected cipher|scramble)" }, { status: 400, headers: corsHeaders });
    }
    const admin = supabaseAdmin();
    const today = getUtcDateString();

    // Practice limit: 5 per UTC day *per puzzle type* (cipher vs scramble).
    const start = new Date(`${today}T00:00:00Z`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const { data: attempts, error: attemptsErr } = await admin
      .from("attempts")
      .select("id,puzzles(variant)")
      .eq("user_id", user.id)
      .eq("mode", "practice")
      .gte("created_at", start.toISOString())
      .lt("created_at", end.toISOString());
    if (attemptsErr) return json({ error: attemptsErr.message }, { status: 500, headers: corsHeaders });

    const used = (attempts ?? []).filter((a: any) => String(a?.puzzles?.variant ?? "scramble") === variant).length;
    const limit = 5;
    const remaining = Math.max(0, limit - used);

    if (dryRun) {
      return json({ ok: true, variant, limit, used, remaining }, { headers: corsHeaders });
    }

    if (used >= limit) {
      return json(
        { error: `Practice limit reached (${limit}/day for ${variant}).`, code: "PRACTICE_LIMIT", variant, limit, used },
        { status: 402, headers: corsHeaders },
      );
    }

    // Claim from the curated puzzle bank so theme always matches target word.
    const { data: claimed, error: claimErr } = await admin.rpc("claim_puzzle_bank_entry", { p_kind: "practice", p_variant: variant });
    if (claimErr) return json({ error: claimErr.message }, { status: 500, headers: corsHeaders });
    const picked = Array.isArray(claimed) ? claimed[0] : null;
    if (!picked) return json({ error: "Puzzle bank is empty" }, { status: 500, headers: corsHeaders });

    const target_word = String((picked as any).target_word ?? "");
    const theme_hint = String((picked as any).theme_hint ?? "");
    const bank_id = Number((picked as any).id);
    assertUpperAlpha(target_word, variant === "cipher" ? 5 : 6);

    // Practice puzzles are generated on-demand with random cipher/decoys (same mechanics as daily).
    const gen = variant === "cipher" ? generateCipherPuzzleFromTarget({ target_word }) : generateScramblePuzzleFromTarget({ target_word });
    const puzzle_hour = new Date().getUTCHours(); // informational only; not used for uniqueness for practice

    const { data: inserted, error: insErr } = await admin
      .from("puzzles")
      .insert({
        puzzle_date: today,
        puzzle_hour,
        kind: "practice",
        variant,
        bank_id,
        target_word,
        cipher_word: gen.cipher_word,
        letter_sets: gen.letter_sets,
        start_idxs: gen.start_idxs,
        theme_hint,
      })
      .select("id,puzzle_date,puzzle_hour,kind,variant,cipher_word,letter_sets,start_idxs,theme_hint")
      .single();

    if (insErr) return json({ error: insErr.message }, { status: 500, headers: corsHeaders });

    return json({ puzzle: inserted, variant, limit, used: used + 1, remaining: Math.max(0, limit - (used + 1)) }, { headers: corsHeaders });
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});


