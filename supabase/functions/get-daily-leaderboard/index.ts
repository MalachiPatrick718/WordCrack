import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { getUtcDateString, json } from "../_shared/utils.ts";

function getPuzzleSlot(now = new Date()): number {
  return now.getUTCHours();
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "GET" && req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const date = (String((body as any)?.date ?? "") || url.searchParams.get("date") || getUtcDateString()) as string;
    const slotParam = (body as any)?.slot ?? (body as any)?.hour ?? url.searchParams.get("slot") ?? url.searchParams.get("hour");
    const variant = String((body as any)?.variant ?? url.searchParams.get("variant") ?? "scramble").toLowerCase();
    if (variant !== "cipher" && variant !== "scramble") {
      return json({ error: "Invalid variant (expected cipher|scramble)" }, { status: 400, headers: corsHeaders });
    }
    const slot = slotParam == null ? getPuzzleSlot() : Number(slotParam);
    if (!Number.isFinite(slot) || slot < 0 || slot > 23) {
      return json({ error: "Invalid slot (expected 0-23)" }, { status: 400, headers: corsHeaders });
    }
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "100")));

    const admin = supabaseAdmin();

    const { data, error } = await admin
      .from("daily_leaderboard")
      .select("puzzle_date,puzzle_hour,variant,puzzle_id,user_id,username,avatar_url,location,final_time_ms,penalty_ms,hints_used_count")
      .eq("puzzle_date", date)
      .eq("puzzle_hour", slot)
      .eq("variant", variant)
      .order("final_time_ms", { ascending: true })
      .limit(limit);
    if (error) return json({ error: error.message }, { status: 500, headers: corsHeaders });

    const entriesBase = data ?? [];
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

    return json({ date, slot, variant, entries }, { headers: corsHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});


