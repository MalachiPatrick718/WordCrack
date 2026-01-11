import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { json } from "../_shared/utils.ts";
import { withCors } from "../_shared/http.ts";

type Body = {
  message?: unknown;
  category?: unknown;
  rating?: unknown;
  context?: unknown;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const user = await requireUser(req);
    const body = (await req.json().catch(() => ({}))) as Body;

    const message = String(body?.message ?? "").trim();
    if (!message) return json({ error: "Missing message" }, { status: 400, headers: corsHeaders });
    if (message.length > 4000) return json({ error: "Message too long (max 4000 characters)" }, { status: 400, headers: corsHeaders });

    const categoryRaw = body?.category == null ? null : String(body.category).trim();
    const category = categoryRaw ? categoryRaw.slice(0, 32) : null;

    const ratingNum = body?.rating == null ? null : Number(body.rating);
    const rating =
      ratingNum == null || !Number.isFinite(ratingNum) ? null : Math.min(5, Math.max(1, Math.round(ratingNum)));

    const ctx = body?.context && typeof body.context === "object" ? body.context : {};

    const admin = supabaseAdmin();
    const { data, error } = await admin
      .from("feedback")
      .insert({
        user_id: user.id,
        message,
        category,
        rating,
        context: ctx,
      })
      .select("id,created_at")
      .single();
    if (error) return json({ error: error.message }, { status: 500, headers: corsHeaders });

    return json({ ok: true, feedback: data }, { headers: corsHeaders });
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});

