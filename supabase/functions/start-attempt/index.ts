import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getUtcDateString, json } from "../_shared/utils.ts";
import { withCors } from "../_shared/http.ts";

type Mode = "daily" | "practice";
const PRACTICE_DAILY_LIMIT = 5;

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const puzzle_id = String(body?.puzzle_id ?? "");
    const mode = (String(body?.mode ?? "daily") as Mode);
    if (!puzzle_id) return json({ error: "Missing puzzle_id" }, { status: 400, headers: corsHeaders });
    if (mode !== "daily" && mode !== "practice") {
      return json({ error: "Invalid mode" }, { status: 400, headers: corsHeaders });
    }

    const admin = supabaseAdmin();

    // Validate puzzle + mode rules
    const { data: puzzle, error: puzzleErr } = await admin
      .from("puzzles")
      .select("id,puzzle_date,puzzle_hour,kind")
      .eq("id", puzzle_id)
      .maybeSingle();
    if (puzzleErr) return json({ error: puzzleErr.message }, { status: 500, headers: corsHeaders });
    if (!puzzle) return json({ error: "Puzzle not found" }, { status: 404, headers: corsHeaders });

    if (mode === "daily") {
      const today = getUtcDateString();
      if (puzzle.kind !== "daily") {
        return json({ error: "Daily attempts can only be started for daily puzzles" }, { status: 400, headers: corsHeaders });
      }
      if (String(puzzle.puzzle_date) !== today) {
        return json({ error: "Daily attempts can only be started for today's puzzle" }, { status: 400, headers: corsHeaders });
      }
    } else {
      if (puzzle.kind !== "practice") {
        return json({ error: "Practice attempts can only be started for practice puzzles" }, { status: 400, headers: corsHeaders });
      }

      // Free users: limit practice attempts per UTC day. Premium: unlimited.
      const now = new Date();
      const today = getUtcDateString(now);
      const { data: ent } = await admin
        .from("entitlements")
        .select("premium_until")
        .eq("user_id", user.id)
        .maybeSingle();
      const premiumUntil = ent?.premium_until ? new Date(ent.premium_until).getTime() : 0;
      const isPremium = premiumUntil > now.getTime();

      if (!isPremium) {
        const start = new Date(`${today}T00:00:00Z`);
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
        const { count, error: countErr } = await admin
          .from("attempts")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("mode", "practice")
          .gte("created_at", start.toISOString())
          .lt("created_at", end.toISOString());
        if (countErr) return json({ error: countErr.message }, { status: 500, headers: corsHeaders });
        const used = count ?? 0;
        if (used >= PRACTICE_DAILY_LIMIT) {
          return json(
            { error: "Practice limit reached (5/day). Upgrade to Premium for unlimited practice.", code: "PRACTICE_LIMIT", limit: PRACTICE_DAILY_LIMIT, used },
            { status: 402, headers: corsHeaders },
          );
        }
      }
    }

    // Daily: if there's an existing attempt (uniqueness), return it.
    // Practice: always create a fresh attempt so players can replay and practice freely.
    if (mode === "daily") {
      const { data: existing, error: existingErr } = await admin
        .from("attempts")
        .select("id,user_id,puzzle_id,mode,started_at,completed_at,solve_time_ms,penalty_ms,final_time_ms,hints_used,is_completed")
        .eq("user_id", user.id)
        .eq("puzzle_id", puzzle_id)
        .eq("mode", mode)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existingErr) return json({ error: existingErr.message }, { status: 500, headers: corsHeaders });
      if (existing) return json({ attempt: existing }, { headers: corsHeaders });
    }

    const { data: created, error: createErr } = await admin
      .from("attempts")
      .insert({ user_id: user.id, puzzle_id, mode })
      .select("id,user_id,puzzle_id,mode,started_at,completed_at,solve_time_ms,penalty_ms,final_time_ms,hints_used,is_completed")
      .single();
    if (createErr) return json({ error: createErr.message }, { status: 500, headers: corsHeaders });

    return json({ attempt: created }, { headers: corsHeaders });
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});


