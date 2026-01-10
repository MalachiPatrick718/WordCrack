import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin, getEnv } from "../_shared/supabase.ts";
import { assertUpperAlpha, getUtcDateString, json } from "../_shared/utils.ts";
import { generatePuzzleFromTarget } from "../_shared/puzzlegen.ts";

function getPuzzleSlot(now = new Date()): number {
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

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    requireAdminKey(req);
    const body = await req.json().catch(() => ({}));

    const puzzle_date = String(body?.puzzle_date ?? getUtcDateString());
    const puzzle_hour = body?.puzzle_hour == null ? getPuzzleSlot() : Number(body.puzzle_hour);
    const target_word = String(body?.target_word ?? "");
    const theme_hint = body?.theme_hint != null ? String(body.theme_hint) : null;
    const overwrite = Boolean(body?.overwrite ?? false);

    if (!Number.isFinite(puzzle_hour) || puzzle_hour < 0 || puzzle_hour > 23) {
      return json({ error: "Invalid puzzle_hour (expected 0-23)" }, { status: 400, headers: corsHeaders });
    }
    assertUpperAlpha(target_word, 5);

    const gen = generatePuzzleFromTarget({
      target_word,
      unshifted_count: body?.unshifted_count == null ? undefined : Number(body.unshifted_count),
      shift_amount: body?.shift_amount == null ? undefined : Number(body.shift_amount),
      direction: body?.direction === "left" || body?.direction === "right" ? body.direction : undefined,
    });
    const cipher_word = gen.cipher_word;
    const letter_sets = gen.letter_sets;

    const admin = supabaseAdmin();
    const payload = {
      puzzle_date,
      puzzle_hour,
      target_word,
      cipher_word,
      letter_sets,
      start_idxs: gen.start_idxs,
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
      { puzzle: data, meta: gen.meta },
      { headers: corsHeaders },
    );
  } catch (e) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});

