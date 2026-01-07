import type { User } from "@supabase/supabase-js";
import { supabaseAuthed } from "./supabase.ts";

export async function requireUser(req: Request): Promise<User> {
  const supabase = supabaseAuthed(req);
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return data.user;
}


