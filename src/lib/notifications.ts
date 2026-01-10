import * as Notifications from "expo-notifications";
import { getJson, setJson } from "./storage";

const KEY = "wordcrack:dailyReminder";
const TEST_PUZZLE_INTERVAL_SECONDS = 120;
const HOURLY_SECONDS = 60 * 60;

type Stored = {
  enabled: boolean;
  notificationId?: string;
  hour: number;
  minute: number;
};

export async function enableDailyReminder(hour = 9, minute = 0): Promise<void> {
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    if (req.status !== "granted") throw new Error("Notifications permission not granted");
  }

  // Android requires a channel for notifications to appear consistently.
  await Notifications.setNotificationChannelAsync("default", {
    name: "Default",
    importance: Notifications.AndroidImportance.DEFAULT,
  }).catch(() => undefined);

  // Cancel previous scheduled reminder if any
  const prev = await getJson<Stored>(KEY);
  if (prev?.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(prev.notificationId).catch(() => undefined);
  }

  const isTest = typeof __DEV__ !== "undefined" && __DEV__;
  const notificationId = await Notifications.scheduleNotificationAsync(
    isTest
      ? {
          content: {
            title: "New WordCrack Puzzle Available",
            body: "A new puzzle is ready. Tap to play.",
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: TEST_PUZZLE_INTERVAL_SECONDS,
            repeats: true,
          },
        }
      : {
          content: {
            title: "New WordCrack Puzzle Available",
            body: "A new puzzle is ready. Tap to play.",
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: HOURLY_SECONDS,
            repeats: true,
          },
        },
  );

  await setJson(KEY, { enabled: true, notificationId, hour, minute });
}

export async function disableDailyReminder(): Promise<void> {
  const prev = await getJson<Stored>(KEY);
  if (prev?.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(prev.notificationId).catch(() => undefined);
  }
  await setJson(KEY, { enabled: false, hour: prev?.hour ?? 9, minute: prev?.minute ?? 0 });
}

export async function getDailyReminderState(): Promise<Stored> {
  return (await getJson<Stored>(KEY)) ?? { enabled: false, hour: 9, minute: 0 };
}

