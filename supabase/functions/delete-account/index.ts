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
    const admin = supabaseAdmin();

    // Delete user's attempts
    await admin.from("attempts").delete().eq("user_id", user.id);

    // Delete user's friendships (both directions)
    await admin.from("friendships").delete().or(`user_id.eq.${user.id},friend_id.eq.${user.id}`);

    // Delete user's feedback
    await admin.from("feedback").delete().eq("user_id", user.id);

    // Delete user's profile
    await admin.from("profiles").delete().eq("user_id", user.id);

    // Delete the auth user
    const { error: authError } = await admin.auth.admin.deleteUser(user.id);
    if (authError) {
      console.error("Failed to delete auth user:", authError);
      return json({ error: "Failed to delete account" }, { status: 500, headers: corsHeaders });
    }

    return json({ ok: true, message: "Account deleted successfully" }, { headers: corsHeaders });
  } catch (e) {
    if (e instanceof Response) return withCors(e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("Delete account error:", msg);
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});
