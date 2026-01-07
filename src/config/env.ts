import Constants from "expo-constants";

type Extra = {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  sentryDsn?: string;
};

function getExtra(): Extra {
  const expoConfig = Constants.expoConfig;
  const extra = (expoConfig?.extra ?? {}) as Extra;
  return extra;
}

export function getSupabaseUrl(): string {
  const v = getExtra().supabaseUrl;
  if (!v) throw new Error("Missing expo.extra.supabaseUrl in app.json");
  return v;
}

export function getSupabaseAnonKey(): string {
  const v = getExtra().supabaseAnonKey;
  if (!v) throw new Error("Missing expo.extra.supabaseAnonKey in app.json");
  return v;
}

export function getSentryDsn(): string | null {
  return getExtra().sentryDsn ?? null;
}


