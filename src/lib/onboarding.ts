import { getJson, setJson } from "./storage";

const KEY = "wordcrack:onboarded";

export async function hasOnboarded(): Promise<boolean> {
  const v = await getJson<boolean>(KEY);
  return v ?? false;
}

export async function markOnboarded(): Promise<void> {
  await setJson(KEY, true);
}

