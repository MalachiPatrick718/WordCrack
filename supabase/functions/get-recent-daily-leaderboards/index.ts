import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { handleCors, corsHeaders } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase.ts";
import { json } from "../_shared/utils.ts";

// TEMP (testing): rotate puzzles every 2 minutes.
const PUZZLE_INTERVAL_MS = 2 * 60 * 1000;

type Entry = {
  puzzle_id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  final_time_ms: number;
  penalty_ms: number;
  hints_used_count: number;
  is_premium?: boolean;
};

type PuzzleMeta = {
  id: string;
  puzzle_date: string;
  puzzle_hour: number;
  cipher_word: string;
  theme_hint: string | null;
  // Only included when the puzzle window is over.
  target_word_revealed: string | null;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const limitPuzzles = Math.min(24, Math.max(1, Number((body as any)?.limit_puzzles ?? url.searchParams.get("limit_puzzles") ?? "6")));
    const limitEntries = Math.min(200, Math.max(1, Number((body as any)?.limit_entries ?? url.searchParams.get("limit_entries") ?? "50")));
    const date = String((body as any)?.date ?? url.searchParams.get("date") ?? "").trim() || null; // optional

    const admin = supabaseAdmin();

    let puzzleQ = admin
      .from("puzzles")
      .select("id,puzzle_date,puzzle_hour,cipher_word,theme_hint,target_word,created_at,kind")
      .eq("kind", "daily")
      .order("created_at", { ascending: false })
      .limit(limitPuzzles);

    if (date) puzzleQ = puzzleQ.eq("puzzle_date", date);

    const { data: puzzles, error: pErr } = await puzzleQ;
    if (pErr) return json({ error: pErr.message }, { status: 500, headers: corsHeaders });
    const puzzleRows = (puzzles ?? []) as any[];
    if (!puzzleRows.length) return json({ sections: [] }, { headers: corsHeaders });

    const puzzleIds = puzzleRows.map((p) => p.id);

    const { data: lbRows, error: lbErr } = await admin
      .from("daily_leaderboard")
      .select("puzzle_id,user_id,username,avatar_url,final_time_ms,penalty_ms,hints_used_count")
      .in("puzzle_id", puzzleIds)
      .order("final_time_ms", { ascending: true })
      .limit(limitEntries * puzzleIds.length);
    if (lbErr) return json({ error: lbErr.message }, { status: 500, headers: corsHeaders });

    const baseEntries = (lbRows ?? []) as Entry[];

    // premium flag enrichment
    const ids = Array.from(new Set(baseEntries.map((e) => e.user_id)));
    const { data: ents } = await admin.from("entitlements").select("user_id,premium_until").in("user_id", ids);
    const entById = new Map<string, string | null>();
    for (const r of ents ?? []) entById.set((r as any).user_id, (r as any).premium_until ?? null);
    const nowMs = Date.now();
    const entries = baseEntries.map((e) => {
      const until = entById.get(e.user_id) ?? null;
      const is_premium = until ? new Date(until).getTime() > nowMs : false;
      return { ...e, is_premium };
    });

    const entriesByPuzzle = new Map<string, Entry[]>();
    for (const e of entries) {
      const arr = entriesByPuzzle.get(e.puzzle_id) ?? [];
      arr.push(e);
      entriesByPuzzle.set(e.puzzle_id, arr);
    }
    for (const [pid, arr] of entriesByPuzzle) {
      arr.sort((a, b) => a.final_time_ms - b.final_time_ms);
      entriesByPuzzle.set(pid, arr);
    }

    const now = new Date();
    const sections = puzzleRows.map((p) => {
      const createdAt = p.created_at ? new Date(p.created_at) : null;
      const reveal = createdAt ? now.getTime() - createdAt.getTime() > PUZZLE_INTERVAL_MS : false;
      const puzzle: PuzzleMeta = {
        id: p.id,
        puzzle_date: String(p.puzzle_date),
        puzzle_hour: Number(p.puzzle_hour ?? 0),
        cipher_word: String(p.cipher_word ?? ""),
        theme_hint: p.theme_hint ?? null,
        target_word_revealed: reveal ? String(p.target_word ?? "") : null,
      };
      return { puzzle, entries: entriesByPuzzle.get(p.id) ?? [] };
    });

    return json({ sections }, { headers: corsHeaders });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json({ error: msg }, { status: 500, headers: corsHeaders });
  }
});

