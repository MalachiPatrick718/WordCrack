import * as Notifications from "expo-notifications";
import { getJson, setJson } from "./storage";

const KEY = "mindshift:dailyReminder";
const ANDROID_CHANNEL_ID = "default";
const PUZZLE_WINDOW_HOURS = 3;
const WINDOW_SECONDS = PUZZLE_WINDOW_HOURS * 60 * 60;

type Stored = {
  enabled: boolean;
  // Legacy single-id storage (kept for backwards compatibility)
  notificationId?: string;
  // New: schedule multiple upcoming notifications aligned to the UTC puzzle boundary.
  notificationIds?: string[];
  // New: end-of-day leaderboard reminder (UTC).
  leaderboardNotificationIds?: string[];
  hour: number;
  minute: number;
};

async function ensureNotificationPermissionAndChannel(): Promise<void> {
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    if (req.status !== "granted") throw new Error("Notifications permission not granted");
  }

  // Android requires a channel for notifications to appear consistently.
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => undefined);
}

async function cancelPrevious(prev: Stored | null): Promise<void> {
  // Safety: if we previously scheduled repeating notifications (e.g., old dev 2-minute interval),
  // they can keep firing even if we no longer track their IDs. Clearing all scheduled notifications
  // here ensures we don't end up with duplicate schedules.
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);

  if (!prev) return;
  if (prev.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(prev.notificationId).catch(() => undefined);
  }
  if (Array.isArray(prev.notificationIds) && prev.notificationIds.length > 0) {
    await Promise.all(prev.notificationIds.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  }
}

function nextUtcWindowBoundary(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCMilliseconds(0);
  d.setUTCSeconds(0);
  d.setUTCMinutes(0);
  const h = now.getUTCHours();
  const delta = PUZZLE_WINDOW_HOURS - (h % PUZZLE_WINDOW_HOURS);
  d.setUTCHours(h + delta);
  return d;
}

function nextUtcMidnight(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCMilliseconds(0);
  d.setUTCSeconds(0);
  d.setUTCMinutes(0);
  d.setUTCHours(0);
  // Next midnight (if we're already at midnight, schedule tomorrow).
  if (d.getTime() <= now.getTime()) d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

export async function enableDailyReminder(hour = 9, minute = 0): Promise<void> {
  await ensureNotificationPermissionAndChannel();

  // Cancel previous scheduled reminder if any
  const prev = await getJson<Stored>(KEY);
  await cancelPrevious(prev ?? null);

  // Android (Expo Notifications) does NOT support `calendar` triggers.
  // To keep "puzzle window boundary" alignment, schedule the next 24h worth of notifications as DATE triggers.
  const first = nextUtcWindowBoundary();
  const count = Math.ceil(24 / PUZZLE_WINDOW_HOURS);
  const ids: string[] = [];

  for (let i = 0; i < count; i++) {
    const at = new Date(first.getTime() + i * WINDOW_SECONDS * 1000);
    // eslint-disable-next-line no-await-in-loop
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "New MindShift Puzzle Available",
        body: "A new puzzle is ready. Tap to play.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: ANDROID_CHANNEL_ID,
      },
    });
    ids.push(id);
  }

  // End-of-day leaderboard reminder (00:05 UTC).
  const leaderboardIds: string[] = [];
  const firstMidnight = nextUtcMidnight();
  const EOD_COUNT = 7; // schedule a week ahead (simple + reliable on both iOS/Android)
  for (let i = 0; i < EOD_COUNT; i++) {
    const at = new Date(firstMidnight.getTime() + i * 24 * 60 * 60 * 1000 + 5 * 60 * 1000);
    // eslint-disable-next-line no-await-in-loop
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Daily leaderboard is final 🏆",
        body: "Tap to see where you placed today.",
        data: { kind: "daily_leaderboard_final" },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: at,
        channelId: ANDROID_CHANNEL_ID,
      },
    });
    leaderboardIds.push(id);
  }

  await setJson(KEY, { enabled: true, notificationIds: ids, leaderboardNotificationIds: leaderboardIds, hour, minute });
}

export async function disableDailyReminder(): Promise<void> {
  const prev = await getJson<Stored>(KEY);
  await cancelPrevious(prev ?? null);
  await setJson(KEY, { enabled: false, hour: prev?.hour ?? 9, minute: prev?.minute ?? 0 });
}

export async function getDailyReminderState(): Promise<Stored> {
  return (await getJson<Stored>(KEY)) ?? { enabled: false, hour: 9, minute: 0 };
}

export async function sendTestNewPuzzleNotification(opts?: { delaySeconds?: number }): Promise<void> {
  await ensureNotificationPermissionAndChannel();
  const delaySeconds = Math.max(0, Number(opts?.delaySeconds ?? 2));

  // Schedule a real OS notification so it can be seen even if the app is backgrounded.
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "New MindShift Puzzle Available",
      body: "Test notification — this doesn’t change your countdown. New puzzles unlock every 3 hours (UTC).",
      data: { kind: "test_new_puzzle" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: delaySeconds,
      repeats: false,
    },
  });
}

