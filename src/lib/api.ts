import { supabase } from "./supabase";

export type PuzzlePublic = {
  id: string;
  puzzle_date: string;
  cipher_word: string;
  letter_sets: string[][];
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

export type HintType = "shift_count" | "shift_position" | "theme";

export async function useHint(attempt_id: string, hint_type: HintType): Promise<{ message: string; penalty_ms: number; attempt: Pick<Attempt, "id" | "penalty_ms" | "hints_used"> }> {
  const res = await invoke<{ hint: { message: string; penalty_ms: number }; attempt: Pick<Attempt, "id" | "penalty_ms" | "hints_used"> }>("use-hint", {
    body: { attempt_id, hint_type },
  });
  return { message: res.hint.message, penalty_ms: res.hint.penalty_ms, attempt: res.attempt };
}

export async function submitAttempt(attempt_id: string, guess_word: string): Promise<{ correct: boolean; attempt?: Attempt; rank?: number | null }> {
  return await invoke("submit-attempt", { body: { attempt_id, guess_word } });
}

export type LeaderboardEntry = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  final_time_ms: number;
  penalty_ms: number;
  hints_used_count: number;
};

export async function getDailyLeaderboard(): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.functions.invoke("get-daily-leaderboard", { method: "GET" });
  if (error) throw error;
  return (data as { entries: LeaderboardEntry[] }).entries ?? [];
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


