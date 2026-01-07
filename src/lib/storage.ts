import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getJson<T>(key: string): Promise<T | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function setJson(key: string, val: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(val));
}


