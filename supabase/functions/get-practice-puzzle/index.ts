import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getUtcDateString, json } from "../_shared/utils.ts";
import { withCors } from "../_shared/http.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "GET") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    await requireUser(req);
    const admin = supabaseAdmin();
    const today = getUtcDateString();

    const { count, error: countErr } = await admin
      .from("puzzles_public")
      .select("id", { count: "exact", head: true })
      .lt("puzzle_date", today);
    if (countErr) return json({ error: countErr.message }, { status: 500, headers: corsHeaders });
    if (!count || count <= 0) return json({ error: "No historical puzzles available" }, { status: 404, headers: corsHeaders });

    const offset = crypto.getRandomValues(new Uint32Array(1))[0] % count;
    const { data, error } = await admin
      .from("puzzles_public")
      .select("id,puzzle_date,cipher_word,letter_sets,theme_hint")
      .lt("puzzle_date", today)
      .order("puzzle_date", { ascending: true })
      .range(offset, offset);
    if (error) return json({ error: error.message }, { status: 500, headers: corsHeaders });
    const puzzle = data?.[0];
    if (!puzzle) return json({ error: "Puzzle not found" }, { status: 404, headers: corsHeaders });

    return json({ puzzle }, { headers: corsHeaders });
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});


