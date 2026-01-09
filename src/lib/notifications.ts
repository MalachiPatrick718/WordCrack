import * as Notifications from "expo-notifications";
import { getJson, setJson } from "./storage";

const KEY = "wordcrack:dailyReminder";

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

  // Cancel previous scheduled reminder if any
  const prev = await getJson<Stored>(KEY);
  if (prev?.notificationId) {
    await Notifications.cancelScheduledNotificationAsync(prev.notificationId).catch(() => undefined);
  }

  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: "WordCrack",
      body: "Today's puzzle is ready. Can you crack it faster?",
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      hour,
      minute,
      repeats: true,
    },
  });

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

