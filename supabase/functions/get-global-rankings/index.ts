import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { json } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limit = Math.min(200, Math.max(1, Number((body as any)?.limit ?? url.searchParams.get("limit") ?? "50")));
    const minSolved = Math.min(100, Math.max(1, Number((body as any)?.min_solved ?? url.searchParams.get("min_solved") ?? "5")));

    const admin = supabaseAdmin();
    // Note: `global_rankings` view schema can drift between environments (e.g., older view missing `location`).
    // Try the full select first, then fall back and join profiles_public for location if needed.
    let base: any[] | null = null;

    const first = await admin
      .from("global_rankings")
      .select("user_id,username,avatar_url,location,puzzles_solved,avg_final_time_ms")
      .gte("puzzles_solved", minSolved)
      .order("avg_final_time_ms", { ascending: true })
      .order("puzzles_solved", { ascending: false })
      .limit(limit);

    if (!first.error) {
      base = first.data ?? [];
    } else {
      const msg = first.error.message ?? "";
      // Common drift: view exists but doesn't include `location` yet.
      if (msg.toLowerCase().includes("location") && msg.toLowerCase().includes("does not exist")) {
        const fallback = await admin
          .from("global_rankings")
          .select("user_id,username,avatar_url,puzzles_solved,avg_final_time_ms")
          .gte("puzzles_solved", minSolved)
          .order("avg_final_time_ms", { ascending: true })
          .order("puzzles_solved", { ascending: false })
          .limit(limit);
        if (fallback.error) return json({ error: fallback.error.message }, { status: 500, headers: corsHeaders });
        base = (fallback.data ?? []).map((r) => ({ ...r, location: null }));
      } else {
        return json({ error: first.error.message }, { status: 500, headers: corsHeaders });
      }
    }

    const ids = Array.from(new Set(base.map((e) => e.user_id)));
    const { data: ents } = await admin.from("entitlements").select("user_id,premium_until").in("user_id", ids);
    const entById = new Map<string, string | null>();
    for (const r of ents ?? []) entById.set(r.user_id, r.premium_until ?? null);
    const now = Date.now();

    // If location wasn't provided by the view, fill it from profiles_public.
    const needsLocation = base.some((e) => e.location == null);
    let locationById = new Map<string, string | null>();
    if (needsLocation && ids.length > 0) {
      const { data: profiles } = await admin
        .from("profiles_public")
        .select("user_id,location")
        .in("user_id", ids);
      for (const p of profiles ?? []) locationById.set(p.user_id, (p as any).location ?? null);
    }

    const entries = base.map((e) => {
      const until = entById.get(e.user_id) ?? null;
      const is_premium = until ? new Date(until).getTime() > now : false;
      const location = e.location ?? (locationById.get(e.user_id) ?? null);
      return { ...e, location, is_premium };
    });

    return json({ entries }, { headers: corsHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});

