import { supabase } from "./supabase";

export type PuzzlePublic = {
  id: string;
  puzzle_date: string;
  cipher_word: string;
  letter_sets: string[][];
  start_idxs?: number[] | null;
  theme_hint: string | null;
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
  const { data, error } = await supabase.functions.invoke(name, {
    method: (opts.method ?? "POST") as "POST" | "GET" | "PUT" | "PATCH" | "DELETE",
    body: opts.body as Record<string, any> | string | undefined,
  });
  if (error) throw error;
  return data as T;
}

export async function getTodayPuzzle(): Promise<PuzzlePublic> {
  const { data, error } = await supabase.functions.invoke("get-today-puzzle", { method: "GET" });
  if (error) throw error;
  return (data as { puzzle: PuzzlePublic }).puzzle;
}

export async function getPracticePuzzle(): Promise<PuzzlePublic> {
  const { data, error } = await supabase.functions.invoke("get-practice-puzzle", { method: "GET" });
  if (error) throw error;
  return (data as { puzzle: PuzzlePublic }).puzzle;
}

export async function startAttempt(puzzle_id: string, mode: "daily" | "practice"): Promise<Attempt> {
  const res = await invoke<{ attempt: Attempt }>("start-attempt", { body: { puzzle_id, mode } });
  return res.attempt;
}

export type HintType = "shift_count" | "shift_position" | "reveal_letter";

export async function useHint(
  attempt_id: string,
  hint_type: HintType,
): Promise<{
  message: string;
  penalty_ms: number;
  meta?: Record<string, unknown>;
  attempt: Pick<Attempt, "id" | "penalty_ms" | "hints_used">;
}> {
  const res = await invoke<{ hint: { message: string; penalty_ms: number }; attempt: Pick<Attempt, "id" | "penalty_ms" | "hints_used"> }>("use-hint", {
    body: { attempt_id, hint_type },
  });
  return { message: res.hint.message, penalty_ms: res.hint.penalty_ms, meta: (res as any).hint?.meta, attempt: res.attempt };
}

export async function submitAttempt(attempt_id: string, guess_word: string): Promise<{ correct: boolean; attempt?: Attempt; rank?: number | null }> {
  return await invoke("submit-attempt", { body: { attempt_id, guess_word } });
}

export async function giveUpAttempt(attempt_id: string): Promise<{ gave_up: true; target_word: string }> {
  return await invoke("give-up", { body: { attempt_id } });
}

export type LeaderboardEntry = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  is_premium?: boolean;
  final_time_ms: number;
  penalty_ms: number;
  hints_used_count: number;
};

export type GlobalRankingEntry = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  puzzles_solved: number;
  avg_final_time_ms: number;
  is_premium?: boolean;
};

export async function getDailyLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.functions.invoke("get-daily-leaderboard", { method: "GET" });
  if (error) throw error;
  return (data as { entries: LeaderboardEntry[] }).entries ?? [];
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
  const { data, error } = await supabase.functions.invoke("get-friends-leaderboard", { method: "GET" });
  if (error) throw error;
  return (data as { entries: LeaderboardEntry[] }).entries ?? [];
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
  avg_7d_ms: number | null;
  avg_30d_ms: number | null;
  hint_usage_count: number;
}> {
  const { data, error } = await supabase.functions.invoke("get-my-stats", { method: "GET" });
  if (error) throw error;
  return data as any;
}


