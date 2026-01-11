import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { json } from "../_shared/utils.ts";
import { withCors } from "../_shared/http.ts";
import { buildHintMessage, HINT_PENALTY_MS, type HintType } from "../_shared/wordcrack.ts";
import { assertUpperAlpha } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const attempt_id = String(body?.attempt_id ?? "");
    const hint_type = String(body?.hint_type ?? "") as HintType;
    if (!attempt_id) return json({ error: "Missing attempt_id" }, { status: 400, headers: corsHeaders });
    const guess_word = body?.guess_word == null ? null : String(body.guess_word);

    const admin = supabaseAdmin();

    const { data: attempt, error: attemptErr } = await admin
      .from("attempts")
      .select("id,user_id,puzzle_id,mode,is_completed,penalty_ms,hints_used")
      .eq("id", attempt_id)
      .maybeSingle();
    if (attemptErr) return json({ error: attemptErr.message }, { status: 500, headers: corsHeaders });
    if (!attempt) return json({ error: "Attempt not found" }, { status: 404, headers: corsHeaders });
    if (attempt.user_id !== user.id) return json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
    if (attempt.is_completed) return json({ error: "Attempt already completed" }, { status: 400, headers: corsHeaders });

    const hintsUsed = Array.isArray(attempt.hints_used) ? attempt.hints_used : [];
    if (hintsUsed.length >= 3) return json({ error: "No hints remaining" }, { status: 400, headers: corsHeaders });
    if (hintsUsed.some((h: any) => h?.type === hint_type)) {
      return json({ error: "Hint already used" }, { status: 400, headers: corsHeaders });
    }

    const { data: puzzle, error: puzzleErr } = await admin
      .from("puzzles")
      .select("id,cipher_word,target_word,theme_hint,variant")
      .eq("id", attempt.puzzle_id)
      .single();
    if (puzzleErr) return json({ error: puzzleErr.message }, { status: 500, headers: corsHeaders });

    const variant = String((puzzle as any)?.variant ?? "scramble");
    const allowed =
      variant === "cipher"
        ? (["shift_amount", "unshifted_positions", "check_positions"] as const)
        : (["check_positions", "reveal_position", "reveal_theme"] as const);
    if (!(allowed as readonly string[]).includes(hint_type)) {
      return json({ error: `Invalid hint_type for ${variant} puzzle` }, { status: 400, headers: corsHeaders });
    }
    if (hint_type === "check_positions") {
      // Required so we can evaluate which selected letters are currently correct.
      assertUpperAlpha(String(guess_word ?? ""), String(puzzle.target_word ?? "").length);
    }

    const penalty_ms = HINT_PENALTY_MS[hint_type];
    const built = buildHintMessage({
      hintType: hint_type,
      cipherWord: puzzle.cipher_word,
      targetWord: puzzle.target_word,
      themeHint: puzzle.theme_hint,
      guessWord: guess_word,
    });

    const hintEvent = {
      type: hint_type,
      penalty_ms,
      used_at: new Date().toISOString(),
      message: built.message,
      ...(built.meta ? { meta: built.meta } : {}),
    };

    const { data: updated, error: updErr } = await admin
      .from("attempts")
      .update({
        penalty_ms: (attempt.penalty_ms ?? 0) + penalty_ms,
        hints_used: [...hintsUsed, hintEvent],
      })
      .eq("id", attempt_id)
      .select("id,penalty_ms,hints_used")
      .single();
    if (updErr) return json({ error: updErr.message }, { status: 500, headers: corsHeaders });

    return json(
      { hint: { type: hint_type, penalty_ms, message: built.message, ...(built.meta ? { meta: built.meta } : {}) }, attempt: updated },
      { headers: corsHeaders },
    );
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});


