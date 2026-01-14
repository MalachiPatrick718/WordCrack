import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getUtcDateString, json } from "../_shared/utils.ts";

// End-of-day daily leaderboard:
// Aggregate all daily puzzles within the UTC day for a given variant and rank each user by their best time.

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const date = (String((body as any)?.date ?? "") || url.searchParams.get("date") || getUtcDateString()) as string;
    const variant = String((body as any)?.variant ?? url.searchParams.get("variant") ?? "scramble").toLowerCase();
    if (variant !== "cipher" && variant !== "scramble") {
      return json({ error: "Invalid variant (expected cipher|scramble)" }, { status: 400, headers: corsHeaders });
    }
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "100")));
    // Fetch more than `limit` because we'll dedupe per-user.
    const fetchLimit = Math.min(10_000, Math.max(500, limit * 50));

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("daily_leaderboard")
      .select("puzzle_date,puzzle_hour,variant,puzzle_id,user_id,username,avatar_url,location,final_time_ms,penalty_ms,hints_used_count")
      .eq("puzzle_date", date)
      .eq("variant", variant)
      // Primary: fewer hints used; Secondary: fastest time.
      .order("hints_used_count", { ascending: true })
      .order("final_time_ms", { ascending: true })
      .limit(fetchLimit);
    if (error) return json({ error: error.message }, { status: 500, headers: corsHeaders });

    // Deduplicate: keep only the best (fastest) entry per user across the whole day.
    const bestByUser = new Map<string, any>();
    for (const e of data ?? []) {
      if (!e?.user_id) continue;
      if (!bestByUser.has(e.user_id)) bestByUser.set(e.user_id, e);
    }
    const entriesBase = Array.from(bestByUser.values()).slice(0, fetchLimit);

    const ids = Array.from(new Set(entriesBase.map((e) => e.user_id)));
    const { data: ents } = await admin.from("entitlements").select("user_id,premium_until").in("user_id", ids);
    const entById = new Map<string, string | null>();
    for (const r of ents ?? []) entById.set(r.user_id, r.premium_until ?? null);
    const now = Date.now();
    const entries = entriesBase.map((e) => {
      const until = entById.get(e.user_id) ?? null;
      const is_premium = until ? new Date(until).getTime() > now : false;
      return { ...e, is_premium };
    });

    // Ensure final ordering after dedupe and apply requested limit.
    entries.sort((a, b) => {
      const ha = Number(a.hints_used_count ?? 0);
      const hb = Number(b.hints_used_count ?? 0);
      if (ha !== hb) return ha - hb;
      return Number(a.final_time_ms) - Number(b.final_time_ms);
    });
    return json({ date, variant, entries: entries.slice(0, limit) }, { headers: corsHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});


