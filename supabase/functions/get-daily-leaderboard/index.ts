import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getUtcDateString, json } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "GET") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? getUtcDateString();
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "100")));

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("daily_leaderboard")
      .select("puzzle_date,puzzle_id,user_id,username,avatar_url,final_time_ms,penalty_ms,hints_used_count")
      .eq("puzzle_date", date)
      .order("final_time_ms", { ascending: true })
      .limit(limit);
    if (error) return json({ error: error.message }, { status: 500, headers: corsHeaders });

    return json({ date, entries: data ?? [] }, { headers: corsHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});


