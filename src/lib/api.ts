import { supabase } from "./supabase";

export type PuzzlePublic = {
  id: string;
  puzzle_date: string;
  puzzle_hour?: number;
  kind?: "daily" | "practice";
  variant?: "cipher" | "scramble";
  cipher_word: string;
  letter_sets: string[][];
  start_idxs?: number[] | null;
  theme_hint: string | null;
  shift_amount?: number | null; // cipher only
};

export type Attempt = {
  id: string;
  user_id: string;
  puzzle_id: string;
  mode: "daily" | "practice";
  started_at: string;
  completed_at: string | null;
  solve_time_ms: number | null;
  penalty_ms: number;
  final_time_ms: number | null;
  hints_used: unknown[];
  is_completed: boolean;
  gave_up?: boolean;
};

async function invoke<T>(name: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  console.log(`invoke: calling ${name}`, opts.body);
  const { data, error } = await supabase.functions.invoke(name, {
    method: (opts.method ?? "POST") as "POST" | "GET" | "PUT" | "PATCH" | "DELETE",
    body: opts.body as Record<string, any> | string | undefined,
  });
  console.log(`invoke: ${name} response`, { data, error });
  if (error) {
    // Log full error details for debugging
    console.log(`invoke: ${name} FULL ERROR:`, JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    console.log(`invoke: ${name} error.context:`, (error as any)?.context);

    // Supabase Functions errors often hide the server message behind a generic "non-2xx" text.
    // Try to surface the JSON error payload when present.
    const ctx = (error as any)?.context;
    let msg = error.message ?? "Request failed";

    // Try multiple ways to extract the actual error message
    try {
      // Try to read the response body if it's a Response object
      if (ctx && typeof ctx.json === "function" && !ctx.bodyUsed) {
        const body = await ctx.json();
        console.log(`invoke: ${name} error body:`, body);
        if (body?.error) msg = String(body.error);
      }
      // Check context.body
      else if (ctx?.body) {
        const parsed = typeof ctx.body === "string" ? JSON.parse(ctx.body) : ctx.body;
        if (parsed?.error) msg = String(parsed.error);
      }
      // Check if data itself contains error (some versions return it differently)
      if (data && typeof data === "object" && "error" in data) {
        msg = String((data as any).error);
      }
    } catch (parseErr) {
      console.log(`invoke: ${name} error parsing:`, parseErr);
    }

    const e = new Error(msg);
    (e as any).status = ctx?.status ?? ctx?.statusCode;
    throw e;
  }
  return data as T;
}

export async function getTodayPuzzle(): Promise<PuzzlePublic> {
  return await getTodayPuzzleByVariant("scramble");
}

export async function getTodayPuzzleByVariant(variant: "cipher" | "scramble"): Promise<PuzzlePublic> {
  const res = await invoke<{ puzzle: PuzzlePublic }>("get-today-puzzle", { body: { variant } });
  return res.puzzle;
}

export async function getPracticePuzzle(): Promise<PuzzlePublic> {
  const res = await invoke<{ puzzle: PuzzlePublic }>("get-practice-puzzle", { body: { variant: "scramble" } });
  return res.puzzle;
}

export async function getPracticePuzzleByVariant(variant: "cipher" | "scramble"): Promise<PuzzlePublic> {
  const res = await invoke<{ puzzle: PuzzlePublic }>("get-practice-puzzle", { body: { variant } });
  return res.puzzle;
}

export async function getPracticeRemainingByVariant(variant: "cipher" | "scramble"): Promise<{ limit: number; used: number; remaining: number }> {
  const res = await invoke<{ ok: true; limit: number; used: number; remaining: number }>("get-practice-puzzle", {
    body: { variant, dry_run: true },
  });
  return { limit: res.limit, used: res.used, remaining: res.remaining };
}

export async function startAttempt(puzzle_id: string, mode: "daily" | "practice"): Promise<Attempt> {
  const res = await invoke<{ attempt: Attempt }>("start-attempt", { body: { puzzle_id, mode } });
  return res.attempt;
}

export async function submitFeedback(args: {
  message: string;
  category?: string;
  rating?: number;
  context?: Record<string, unknown>;
}): Promise<{ id: string; created_at: string }> {
  const res = await invoke<{ ok: true; feedback: { id: string; created_at: string } }>("submit-feedback", {
    body: {
      message: args.message,
      category: args.category,
      rating: args.rating,
      context: args.context,
    },
  });
  return res.feedback;
}

export type HintType = "check_positions" | "reveal_position" | "reveal_theme" | "shift_direction" | "shift_amount" | "unshifted_positions";

export async function useHint(
  attempt_id: string,
  hint_type: HintType,
  opts?: { guess_word?: string },
): Promise<{
  message: string;
  penalty_ms: number;
  meta?: Record<string, unknown>;
  attempt: Pick<Attempt, "id" | "penalty_ms" | "hints_used">;
}> {
  const res = await invoke<{ hint: { message: string; penalty_ms: number }; attempt: Pick<Attempt, "id" | "penalty_ms" | "hints_used"> }>("use-hint", {
    body: { attempt_id, hint_type, ...(opts?.guess_word ? { guess_word: opts.guess_word } : {}) },
  });
  return { message: res.hint.message, penalty_ms: res.hint.penalty_ms, meta: (res as any).hint?.meta, attempt: res.attempt };
}

export async function submitAttempt(attempt_id: string, guess_word: string): Promise<{ correct: boolean; attempt?: Attempt; rank?: number | null }> {
  return await invoke("submit-attempt", { body: { attempt_id, guess_word } });
}

export async function giveUpAttempt(attempt_id: string): Promise<{ gave_up: true; target_word: string }> {
  console.log("giveUpAttempt called with:", attempt_id);
  const result = await invoke<{ gave_up: true; target_word: string }>("give-up", { body: { attempt_id } });
  console.log("giveUpAttempt result:", result);
  return result;
}

export type LeaderboardEntry = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  location?: string | null;
  is_premium?: boolean;
  final_time_ms: number;
  penalty_ms: number;
  hints_used_count: number;
};

export type GlobalRankingEntry = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  location?: string | null;
  puzzles_solved: number;
  avg_final_time_ms: number;
  is_premium?: boolean;
};

export async function getDailyLeaderboard(): Promise<LeaderboardEntry[]> {
  return await getDailyLeaderboardByVariant("scramble");
}

export async function getDailyLeaderboardByVariant(variant: "cipher" | "scramble"): Promise<LeaderboardEntry[]> {
  const res = await invoke<{ entries: LeaderboardEntry[] }>("get-daily-leaderboard", { body: { variant } });
  return res.entries ?? [];
}

export async function getGlobalRankings(opts?: { limit?: number; min_solved?: number }): Promise<GlobalRankingEntry[]> {
  const res = await invoke<{ entries: GlobalRankingEntry[] }>("get-global-rankings", {
    body: { limit: opts?.limit, min_solved: opts?.min_solved },
  });
  return res.entries ?? [];
}

export type RecentLeaderboardSection = {
  puzzle: {
    id: string;
    puzzle_date: string;
    puzzle_hour: number;
    cipher_word: string;
    theme_hint: string | null;
    target_word_revealed: string | null;
  };
  entries: LeaderboardEntry[];
};

export async function getRecentDailyLeaderboards(opts?: { limit_puzzles?: number; limit_entries?: number }): Promise<RecentLeaderboardSection[]> {
  // NOTE: supabase-js `functions.invoke()` URL-encodes the function name, so query strings break.
  // We use POST + body instead.
  const res = await invoke<{ sections: RecentLeaderboardSection[] }>("get-recent-daily-leaderboards", {
    body: {
      limit_puzzles: opts?.limit_puzzles,
      limit_entries: opts?.limit_entries,
    },
  });
  return res.sections ?? [];
}

export async function getFriendsLeaderboard(): Promise<LeaderboardEntry[]> {
  return await getFriendsLeaderboardByVariant("scramble");
}

export async function getFriendsLeaderboardByVariant(variant: "cipher" | "scramble"): Promise<LeaderboardEntry[]> {
  const res = await invoke<{ entries: LeaderboardEntry[] }>("get-friends-leaderboard", { body: { variant } });
  return res.entries ?? [];
}

export async function addFriendByInviteCode(invite_code: string): Promise<{ user_id: string; username: string; avatar_url: string | null }> {
  const res = await invoke<{ friend: { user_id: string; username: string; avatar_url: string | null } }>("add-friend-by-invite-code", {
    body: { invite_code },
  });
  return res.friend;
}

export async function getMyStats(): Promise<{
  current_streak: number;
  best_time_ms: number | null;
  avg_3d_ms: number | null;
  avg_7d_ms: number | null;
  avg_30d_ms: number | null;
  hint_usage_count: number;
  cipher: { best_time_ms: number | null; avg_3d_ms: number | null; avg_7d_ms: number | null; avg_30d_ms: number | null; hint_usage_count: number };
  scramble: { best_time_ms: number | null; avg_3d_ms: number | null; avg_7d_ms: number | null; avg_30d_ms: number | null; hint_usage_count: number };
}> {
  const { data, error } = await supabase.functions.invoke("get-my-stats", { method: "GET" });
  if (error) throw error;
  return data as any;
}

export async function deleteAccount(): Promise<{ ok: boolean }> {
  return await invoke<{ ok: boolean }>("delete-account", {});
}

export type IapStatus = {
  entitlement: { premium_until: string | null; updated_at: string | null };
  purchases: Array<{
    platform: "ios" | "android";
    product_id: string;
    status: string;
    purchase_time: string | null;
    expires_at: string | null;
    updated_at?: string | null;
    original_transaction_id?: string | null;
    transaction_id?: string | null;
    order_id?: string | null;
    package_name?: string | null;
    raw_meta?: { notificationType?: string; subtype?: string } | null;
  }>;
};

export async function getIapStatus(): Promise<IapStatus> {
  const { data, error } = await supabase.functions.invoke("get-iap-status", { method: "GET" });
  if (error) throw error;
  return data as any;
}


