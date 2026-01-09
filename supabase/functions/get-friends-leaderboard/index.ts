import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getUtcDateString, json } from "../_shared/utils.ts";
import { withCors } from "../_shared/http.ts";

function getUtcHour(now = new Date()): number {
  return now.getUTCHours();
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "GET") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const user = await requireUser(req);
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? getUtcDateString();
    const hourParam = url.searchParams.get("hour");
    const hour = hourParam == null ? getUtcHour() : Number(hourParam);
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
      return json({ error: "Invalid hour (expected 0-23)" }, { status: 400, headers: corsHeaders });
    }
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "100")));

    const admin = supabaseAdmin();

    const { data: puzzle, error: puzzleErr } = await admin
      .from("puzzles")
      .select("id,puzzle_date,puzzle_hour")
      .eq("puzzle_date", date)
      .eq("puzzle_hour", hour)
      .maybeSingle();
    if (puzzleErr) return json({ error: puzzleErr.message }, { status: 500, headers: corsHeaders });
    if (!puzzle) return json({ error: "Puzzle not found" }, { status: 404, headers: corsHeaders });

    const { data: friends, error: friendsErr } = await admin
      .from("friends")
      .select("user_id,friend_user_id,status")
      .eq("status", "accepted")
      .or(`user_id.eq.${user.id},friend_user_id.eq.${user.id}`);
    if (friendsErr) return json({ error: friendsErr.message }, { status: 500, headers: corsHeaders });

    const friendIds = new Set<string>();
    friendIds.add(user.id);
    for (const f of friends ?? []) {
      const other = f.user_id === user.id ? f.friend_user_id : f.user_id;
      friendIds.add(other);
    }

    const ids = Array.from(friendIds);
    const { data: attempts, error: attemptsErr } = await admin
      .from("attempts")
      .select("user_id,final_time_ms,penalty_ms,hints_used,completed_at")
      .eq("puzzle_id", puzzle.id)
      .eq("mode", "daily")
      .eq("is_completed", true)
      .in("user_id", ids);
    if (attemptsErr) return json({ error: attemptsErr.message }, { status: 500, headers: corsHeaders });

    const { data: profiles, error: profilesErr } = await admin
      .from("profiles_public")
      .select("user_id,username,avatar_url")
      .in("user_id", ids);
    if (profilesErr) return json({ error: profilesErr.message }, { status: 500, headers: corsHeaders });

    const profileById = new Map<string, { username: string; avatar_url: string | null }>();
    for (const p of profiles ?? []) profileById.set(p.user_id, { username: p.username, avatar_url: p.avatar_url });

    const { data: ents } = await admin.from("entitlements").select("user_id,premium_until").in("user_id", ids);
    const entById = new Map<string, string | null>();
    for (const r of ents ?? []) entById.set(r.user_id, r.premium_until ?? null);
    const now = Date.now();

    const entries = (attempts ?? [])
      .map((a) => {
        const pr = profileById.get(a.user_id);
        const until = entById.get(a.user_id) ?? null;
        const is_premium = until ? new Date(until).getTime() > now : false;
        return {
          user_id: a.user_id,
          username: pr?.username ?? "player",
          avatar_url: pr?.avatar_url ?? null,
          is_premium,
          final_time_ms: a.final_time_ms,
          penalty_ms: a.penalty_ms,
          hints_used_count: Array.isArray(a.hints_used) ? a.hints_used.length : 0,
          completed_at: a.completed_at,
        };
      })
      .sort((x, y) => (x.final_time_ms ?? 0) - (y.final_time_ms ?? 0))
      .slice(0, limit);

    return json({ date, hour, entries }, { headers: corsHeaders });
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});


