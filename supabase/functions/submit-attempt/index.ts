import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { assertUpperAlpha, json } from "../_shared/utils.ts";
import { withCors } from "../_shared/http.ts";

function msBetween(aIso: string, b: Date): number {
  const a = new Date(aIso);
  const diff = b.getTime() - a.getTime();
  return Math.max(0, Math.floor(diff));
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const attempt_id = String(body?.attempt_id ?? "");
    const guess_word = String(body?.guess_word ?? "");
    if (!attempt_id) return json({ error: "Missing attempt_id" }, { status: 400, headers: corsHeaders });
    assertUpperAlpha(guess_word, 6);

    const admin = supabaseAdmin();

    const { data: attempt, error: attemptErr } = await admin
      .from("attempts")
      .select("id,user_id,puzzle_id,mode,started_at,is_completed,penalty_ms,completed_at,solve_time_ms,final_time_ms,hints_used")
      .eq("id", attempt_id)
      .maybeSingle();
    if (attemptErr) return json({ error: attemptErr.message }, { status: 500, headers: corsHeaders });
    if (!attempt) return json({ error: "Attempt not found" }, { status: 404, headers: corsHeaders });
    if (attempt.user_id !== user.id) return json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });

    if (attempt.is_completed) {
      // Idempotent response for already-completed attempts
      return json({ correct: true, attempt }, { headers: corsHeaders });
    }

    const { data: puzzle, error: puzzleErr } = await admin
      .from("puzzles")
      .select("id,target_word,puzzle_date")
      .eq("id", attempt.puzzle_id)
      .single();
    if (puzzleErr) return json({ error: puzzleErr.message }, { status: 500, headers: corsHeaders });

    if (guess_word !== puzzle.target_word) {
      return json({ correct: false }, { headers: corsHeaders });
    }

    const now = new Date();
    const solve_time_ms = msBetween(attempt.started_at, now);
    const penalty_ms = attempt.penalty_ms ?? 0;
    const final_time_ms = solve_time_ms + penalty_ms;

    const { data: completed, error: updErr } = await admin
      .from("attempts")
      .update({
        completed_at: now.toISOString(),
        solve_time_ms,
        final_time_ms,
        is_completed: true,
      })
      .eq("id", attempt_id)
      .select("id,user_id,puzzle_id,mode,started_at,completed_at,solve_time_ms,penalty_ms,final_time_ms,hints_used,is_completed")
      .single();
    if (updErr) return json({ error: updErr.message }, { status: 500, headers: corsHeaders });

    // Rank (global) only for daily mode
    let rank: number | null = null;
    if (completed.mode === "daily") {
      const { count: fasterCount, error: fasterErr } = await admin
        .from("attempts")
        .select("id", { count: "exact", head: true })
        .eq("puzzle_id", completed.puzzle_id)
        .eq("mode", "daily")
        .eq("is_completed", true)
        .lt("final_time_ms", completed.final_time_ms);

      const { count: tieEarlierCount, error: tieErr } = await admin
        .from("attempts")
        .select("id", { count: "exact", head: true })
        .eq("puzzle_id", completed.puzzle_id)
        .eq("mode", "daily")
        .eq("is_completed", true)
        .eq("final_time_ms", completed.final_time_ms)
        .lt("completed_at", completed.completed_at);

      if (!fasterErr && !tieErr) {
        rank = (fasterCount ?? 0) + (tieEarlierCount ?? 0) + 1;
      }
    }

    return json({ correct: true, attempt: completed, rank }, { headers: corsHeaders });
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});


