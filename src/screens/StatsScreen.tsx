import React, { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";
import { getMyStats } from "../lib/api";

export function StatsScreen() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getMyStats>> | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const s = await getMyStats();
        if (mounted) setStats(s);
      } catch (e: any) {
        Alert.alert("Failed to load stats", e?.message ?? "Unknown error");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const fmtMs = (ms: number | null) => {
    if (ms == null) return "—";
    const s = Math.max(0, Math.floor(ms / 1000));
    const mm = String(Math.floor(s / 60)).padStart(2, "0");
    const ss = String(s % 60).padStart(2, "0");
    const ms2 = String(Math.floor((ms % 1000) / 10)).padStart(2, "0");
    return `${mm}:${ss}.${ms2}`;
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: "900" }}>Stats</Text>
      {loading ? <Text style={{ color: "#666" }}>Loading…</Text> : null}
      {!loading && stats ? (
        <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 16, padding: 14, gap: 8 }}>
          <Text>Current streak: {stats.current_streak}</Text>
          <Text>Best time: {fmtMs(stats.best_time_ms)}</Text>
          <Text>Average (7 days): {fmtMs(stats.avg_7d_ms)}</Text>
          <Text>Average (30 days): {fmtMs(stats.avg_30d_ms)}</Text>
          <Text>Total hints used: {stats.hint_usage_count}</Text>
        </View>
      ) : null}
    </View>
  );
}


