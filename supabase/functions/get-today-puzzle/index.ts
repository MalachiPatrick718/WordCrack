import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { assertUpperAlpha, getUtcDateString, json } from "../_shared/utils.ts";
import { generatePuzzleFromTarget } from "../_shared/puzzlegen.ts";

// Hourly puzzles (UTC).
const WORD_LEN = 5;

function isValidPuzzlePublicRow(p: any): boolean {
  try {
    if (!p) return false;
    if (typeof p.cipher_word !== "string" || p.cipher_word.length !== WORD_LEN) return false;
    const sets = p.letter_sets;
    if (!Array.isArray(sets) || sets.length !== WORD_LEN) return false;
    for (let i = 0; i < WORD_LEN; i++) {
      if (!Array.isArray(sets[i]) || sets[i].length !== 5) return false;
    }
    const si = p.start_idxs;
    if (si != null) {
      if (!Array.isArray(si) || si.length !== WORD_LEN) return false;
      for (let i = 0; i < WORD_LEN; i++) {
        const v = Number(si[i]);
        if (!Number.isFinite(v) || v < 0 || v > 4) return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

function getPuzzleSlot(now = new Date()): number {
  return now.getUTCHours();
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? getUtcDateString();
    const slotParam = url.searchParams.get("slot") ?? url.searchParams.get("hour");
    const slot = slotParam == null ? getPuzzleSlot() : Number(slotParam);
    if (!Number.isFinite(slot) || slot < 0 || slot > 23) {
      return json({ error: "Invalid slot (expected 0-23)" }, { status: 400, headers: corsHeaders });
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("puzzles_public")
      .select("id,puzzle_date,puzzle_hour,kind,cipher_word,letter_sets,start_idxs,theme_hint")
      .eq("puzzle_date", date)
      .eq("puzzle_hour", slot)
      .eq("kind", "daily")
      .maybeSingle();

    if (error) return json({ error: error.message }, { status: 500, headers: corsHeaders });
    let puzzle = data;
    // If an older (legacy 6-letter) puzzle exists for this slot, delete it and regenerate.
    if (puzzle && !isValidPuzzlePublicRow(puzzle)) {
      const del = await supabase.from("puzzles").delete().eq("id", puzzle.id);
      if (del.error) {
        // If we can't delete, return a clear error so we don't silently loop.
        return json({ error: del.error.message }, { status: 500, headers: corsHeaders });
      }
      // Force regeneration
      puzzle = null;
    }

    if (!puzzle) {
      // Auto-create from puzzle bank (service_role only).
      const { data: claimed, error: claimErr } = await supabase.rpc("claim_puzzle_bank_entry", { p_kind: "daily" });
      if (claimErr) return json({ error: claimErr.message }, { status: 500, headers: corsHeaders });
      const picked = Array.isArray(claimed) ? claimed[0] : null;
      if (!picked) return json({ error: "Puzzle bank is empty" }, { status: 500, headers: corsHeaders });

      const target_word = String((picked as any).target_word ?? "");
      const theme_hint = String((picked as any).theme_hint ?? "");
      const bank_id = Number((picked as any).id);

      assertUpperAlpha(target_word, 5);
      if (!Number.isFinite(bank_id)) return json({ error: "Invalid puzzle bank entry" }, { status: 500, headers: corsHeaders });

      const gen = generatePuzzleFromTarget({ target_word });

      const { error: insertErr } = await supabase
        .from("puzzles")
        .insert({
          puzzle_date: date,
          puzzle_hour: slot,
          kind: "daily",
          bank_id,
          target_word,
          cipher_word: gen.cipher_word,
          letter_sets: gen.letter_sets,
          start_idxs: gen.start_idxs,
          theme_hint,
        });

      if (insertErr) {
        const msg = insertErr.message ?? "Database error";
        // If another request won the race, just re-read and return.
        if (!msg.toLowerCase().includes("duplicate") && !msg.toLowerCase().includes("idx_puzzles_date_hour_unique")) {
          return json({ error: msg }, { status: 500, headers: corsHeaders });
        }
      }

      const reread = await supabase
        .from("puzzles_public")
        .select("id,puzzle_date,puzzle_hour,kind,cipher_word,letter_sets,start_idxs,theme_hint")
        .eq("puzzle_date", date)
        .eq("puzzle_hour", slot)
        .eq("kind", "daily")
        .maybeSingle();

      if (reread.error) return json({ error: reread.error.message }, { status: 500, headers: corsHeaders });
      if (!reread.data) return json({ error: "Puzzle not found after create" }, { status: 500, headers: corsHeaders });

      return json({ puzzle: reread.data, slot }, { headers: corsHeaders });
    }

    return json({ puzzle, slot }, { headers: corsHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});


