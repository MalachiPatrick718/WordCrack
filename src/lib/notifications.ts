import * as Notifications from "expo-notifications";
import { getJson, setJson } from "./storage";

const KEY = "wordcrack:dailyReminder";
const ANDROID_CHANNEL_ID = "default";

type Stored = {
  enabled: boolean;
  // Legacy single-id storage (kept for backwards compatibility)
  notificationId?: string;
  // New: schedule multiple upcoming notifications aligned to the UTC puzzle boundary.
  notificationIds?: string[];
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

function nextUtcHourBoundary(now = new Date()): Date {
  const d = new Date(now);
  d.setUTCMilliseconds(0);
  d.setUTCSeconds(0);
  d.setUTCMinutes(0);
  d.setUTCHours(now.getUTCHours() + 1);
  return d;
}

export async function enableDailyReminder(hour = 9, minute = 0): Promise<void> {
  await ensureNotificationPermissionAndChannel();

  // Cancel previous scheduled reminder if any
  const prev = await getJson<Stored>(KEY);
  await cancelPrevious(prev ?? null);

  // Fire every hour at :00 (local time). This matches the UTC puzzle boundary since it's always at minute 0.
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "New WordCrack Puzzle Available",
      body: "A new puzzle is ready. Tap to play.",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      minute: 0,
      second: 0,
      repeats: true,
      channelId: ANDROID_CHANNEL_ID,
    },
  });

  await setJson(KEY, { enabled: true, notificationId: id, hour, minute });
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
      title: "New WordCrack Puzzle Available",
      body: "Test notification — this doesn’t change your countdown. New puzzles unlock at the next UTC hour.",
      data: { kind: "test_new_puzzle" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: delaySeconds,
      repeats: false,
    },
  });
}

