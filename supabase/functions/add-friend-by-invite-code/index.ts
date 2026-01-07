import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { json } from "../_shared/utils.ts";
import { withCors } from "../_shared/http.ts";

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const user = await requireUser(req);
    const body = await req.json().catch(() => ({}));
    const invite_code = String(body?.invite_code ?? "").trim().toLowerCase();
    if (!invite_code) return json({ error: "Missing invite_code" }, { status: 400, headers: corsHeaders });

    const admin = supabaseAdmin();
    const { data: profile, error: profErr } = await admin
      .from("profiles")
      .select("user_id,username,avatar_url,invite_code")
      .eq("invite_code", invite_code)
      .maybeSingle();
    if (profErr) return json({ error: profErr.message }, { status: 500, headers: corsHeaders });
    if (!profile) return json({ error: "Invite code not found" }, { status: 404, headers: corsHeaders });
    if (profile.user_id === user.id) return json({ error: "Cannot add yourself" }, { status: 400, headers: corsHeaders });

    // v1: immediate "accepted" relationship, stored symmetrically for easy querying.
    const rows = [
      { user_id: user.id, friend_user_id: profile.user_id, status: "accepted" },
      { user_id: profile.user_id, friend_user_id: user.id, status: "accepted" },
    ];

    const { error: insErr } = await admin.from("friends").upsert(rows, { onConflict: "user_id,friend_user_id" });
    if (insErr) return json({ error: insErr.message }, { status: 500, headers: corsHeaders });

    return json(
      { friend: { user_id: profile.user_id, username: profile.username, avatar_url: profile.avatar_url } },
      { headers: corsHeaders },
    );
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});


