import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getUtcDateString, json } from "../_shared/utils.ts";

function getUtcHour(now = new Date()): number {
  return now.getUTCHours();
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const url = new URL(req.url);
    const date = url.searchParams.get("date") ?? getUtcDateString();
    const hourParam = url.searchParams.get("hour");
    const hour = hourParam == null ? getUtcHour() : Number(hourParam);
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) {
      return json({ error: "Invalid hour (expected 0-23)" }, { status: 400, headers: corsHeaders });
    }

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("puzzles_public")
      .select("id,puzzle_date,puzzle_hour,cipher_word,letter_sets,theme_hint")
      .eq("puzzle_date", date)
      .eq("puzzle_hour", hour)
      .maybeSingle();

    if (error) return json({ error: error.message }, { status: 500, headers: corsHeaders });
    if (!data) return json({ error: "Puzzle not found" }, { status: 404, headers: corsHeaders });

    return json({ puzzle: data }, { headers: corsHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});


