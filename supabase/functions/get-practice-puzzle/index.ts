import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getUtcDateString, json } from "../_shared/utils.ts";
import { withCors } from "../_shared/http.ts";
import { assertUpperAlpha } from "../_shared/utils.ts";
import { generatePuzzleFromTarget } from "../_shared/puzzlegen.ts";

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
  if (req.method !== "GET") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    await requireUser(req);
    const admin = supabaseAdmin();
    const today = getUtcDateString();

    // Claim from the curated puzzle bank so theme always matches target word.
    const { data: claimed, error: claimErr } = await admin.rpc("claim_puzzle_bank_entry");
    if (claimErr) return json({ error: claimErr.message }, { status: 500, headers: corsHeaders });
    const picked = Array.isArray(claimed) ? claimed[0] : null;
    if (!picked) return json({ error: "Puzzle bank is empty" }, { status: 500, headers: corsHeaders });

    const target_word = String((picked as any).target_word ?? "");
    const theme_hint = String((picked as any).theme_hint ?? "");
    const bank_id = Number((picked as any).id);
    assertUpperAlpha(target_word, 5);

    // Practice puzzles are generated on-demand with random cipher/decoys (same mechanics as daily).
    const gen = generatePuzzleFromTarget({ target_word });
    const puzzle_hour = new Date().getUTCHours(); // informational only; not used for uniqueness for practice

    const { data: inserted, error: insErr } = await admin
      .from("puzzles")
      .insert({
        puzzle_date: today,
        puzzle_hour,
        kind: "practice",
        bank_id,
        target_word,
        cipher_word: gen.cipher_word,
        letter_sets: gen.letter_sets,
        start_idxs: gen.start_idxs,
        theme_hint,
      })
      .select("id,puzzle_date,puzzle_hour,cipher_word,letter_sets,start_idxs,theme_hint")
      .single();

    if (insErr) return json({ error: insErr.message }, { status: 500, headers: corsHeaders });

    return json({ puzzle: inserted }, { headers: corsHeaders });
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});


