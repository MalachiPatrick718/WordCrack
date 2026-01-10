import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { json } from "../_shared/utils.ts";
import { withCors } from "../_shared/http.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const attempt_id = String(body?.attempt_id ?? "");
    if (!attempt_id) return json({ error: "Missing attempt_id" }, { status: 400, headers: corsHeaders });

    const admin = supabaseAdmin();

    const { data: attempt, error: attemptErr } = await admin
      .from("attempts")
      .select("id,user_id,puzzle_id,mode,is_completed,penalty_ms,gave_up")
      .eq("id", attempt_id)
      .maybeSingle();
    if (attemptErr) return json({ error: attemptErr.message }, { status: 500, headers: corsHeaders });
    if (!attempt) return json({ error: "Attempt not found" }, { status: 404, headers: corsHeaders });
    if (attempt.user_id !== user.id) return json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });

    const { data: puzzle, error: puzzleErr } = await admin
      .from("puzzles")
      .select("id,target_word")
      .eq("id", attempt.puzzle_id)
      .single();
    if (puzzleErr) return json({ error: puzzleErr.message }, { status: 500, headers: corsHeaders });

    // Idempotent: if already gave up, just return the word again.
    if (attempt.gave_up) {
      return json({ gave_up: true, target_word: puzzle.target_word }, { headers: corsHeaders });
    }

    const now = new Date().toISOString();
    const { error: updErr } = await admin
      .from("attempts")
      .update({
        gave_up: true,
        gave_up_at: now,
        is_completed: true,
        completed_at: now,
        // Ensure no accidental stats/leaderboard usage via times.
        solve_time_ms: null,
        final_time_ms: null,
      })
      .eq("id", attempt_id);
    if (updErr) return json({ error: updErr.message }, { status: 500, headers: corsHeaders });

    return json({ gave_up: true, target_word: puzzle.target_word }, { headers: corsHeaders });
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});

