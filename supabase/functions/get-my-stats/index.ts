import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getUtcDateString, json } from "../_shared/utils.ts";
import { withCors } from "../_shared/http.ts";

type Row = { puzzle_date: string; solve_time_ms: number; final_time_ms: number; hints_used: unknown };

function daysBetweenUtc(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / (24 * 3600 * 1000));
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "GET") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const user = await requireUser(req);
    const admin = supabaseAdmin();

    // Pull recent daily completions with puzzle_date + variant
    const { data, error } = await admin
      .from("attempts")
      .select("solve_time_ms,final_time_ms,hints_used,puzzles(puzzle_date,variant)")
      .eq("user_id", user.id)
      .eq("mode", "daily")
      .eq("is_completed", true)
      .eq("gave_up", false)
      .order("completed_at", { ascending: false })
      .limit(60);
    if (error) return json({ error: error.message }, { status: 500, headers: corsHeaders });

    const rowsAll: (Row & { variant: "cipher" | "scramble" })[] = (data ?? [])
      .map((r: any) => ({
        puzzle_date: r.puzzles?.puzzle_date as string,
        variant: (r.puzzles?.variant as "cipher" | "scramble") ?? "scramble",
        solve_time_ms: r.solve_time_ms as number,
        final_time_ms: r.final_time_ms as number,
        hints_used: r.hints_used,
      }))
      .filter(
        (r) =>
          Boolean(r.puzzle_date) &&
          (r.variant === "cipher" || r.variant === "scramble") &&
          Number.isFinite(r.solve_time_ms) &&
          r.solve_time_ms >= 0,
      );

    const today = getUtcDateString();
    // Best time = lowest SOLVE time (raw), puzzle-type specific (and overall).
    const best_time_ms = rowsAll.length ? Math.min(...rowsAll.map((r) => r.solve_time_ms)) : null;
    const last7 = rowsAll.slice(0, 7).map((r) => r.solve_time_ms);
    const last30 = rowsAll.slice(0, 30).map((r) => r.solve_time_ms);
    const hints_used_count = rowsAll.reduce((sum, r) => sum + (Array.isArray(r.hints_used) ? r.hints_used.length : 0), 0);

    // Current streak: consecutive puzzle_date ending today (if today's solved) otherwise 0.
    let current_streak = 0;
    const byDate = Array.from(
      new Set(
        rowsAll
          .map((r) => r.puzzle_date)
          .filter(Boolean),
      ),
    ).sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

    if (byDate.length && byDate[0] === today) {
      current_streak = 1;
      for (let i = 1; i < byDate.length; i++) {
        const prev = byDate[i - 1];
        const cur = byDate[i];
        if (daysBetweenUtc(cur, prev) === 1) current_streak += 1;
        else break;
      }
    }

    function statsForVariant(variant: "cipher" | "scramble") {
      const rows = rowsAll.filter((r) => r.variant === variant);
      const best = rows.length ? Math.min(...rows.map((r) => r.solve_time_ms)) : null;
      const last7v = rows.slice(0, 7).map((r) => r.solve_time_ms);
      const last30v = rows.slice(0, 30).map((r) => r.solve_time_ms);
      const hints = rows.reduce((sum, r) => sum + (Array.isArray(r.hints_used) ? r.hints_used.length : 0), 0);
      return {
        best_time_ms: best,
        avg_7d_ms: avg(last7v),
        avg_30d_ms: avg(last30v),
        hint_usage_count: hints,
      };
    }

    return json(
      {
        current_streak,
        best_time_ms,
        avg_7d_ms: avg(last7),
        avg_30d_ms: avg(last30),
        hint_usage_count: hints_used_count,
        cipher: statsForVariant("cipher"),
        scramble: statsForVariant("scramble"),
      },
      { headers: corsHeaders },
    );
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});


