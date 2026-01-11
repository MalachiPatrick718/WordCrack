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
    {
      const { error } = await admin.from("attempts").delete().eq("user_id", user.id);
      if (error) console.error("delete-account: failed deleting attempts", error);
    }

    // Delete user's friends rows (both directions)
    {
      const { error } = await admin
        .from("friends")
        .delete()
        .or(`user_id.eq.${user.id},friend_user_id.eq.${user.id}`);
      if (error) console.error("delete-account: failed deleting friends", error);
    }

    // Delete user's feedback
    {
      const { error } = await admin.from("feedback").delete().eq("user_id", user.id);
      if (error) console.error("delete-account: failed deleting feedback", error);
    }

    // Delete user's profile
    {
      const { error } = await admin.from("profiles").delete().eq("user_id", user.id);
      if (error) console.error("delete-account: failed deleting profile", error);
    }

    // Delete notification prefs (optional table)
    {
      const { error } = await admin.from("notification_prefs").delete().eq("user_id", user.id);
      if (error) console.error("delete-account: failed deleting notification_prefs", error);
    }

    // Delete purchases / entitlements (optional tables)
    {
      const { error } = await admin.from("purchases").delete().eq("user_id", user.id);
      if (error) console.error("delete-account: failed deleting purchases", error);
    }
    {
      const { error } = await admin.from("entitlements").delete().eq("user_id", user.id);
      if (error) console.error("delete-account: failed deleting entitlements", error);
    }

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
