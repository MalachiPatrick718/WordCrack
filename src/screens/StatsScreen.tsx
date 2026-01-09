import React, { useEffect, useState } from "react";
import { Alert, Pressable, Text, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { getMyStats } from "../lib/api";
import { RootStackParamList } from "../AppRoot";
import { useIap } from "../purchases/IapProvider";
import { colors, shadows, borderRadius } from "../theme/colors";

type Props = NativeStackScreenProps<RootStackParamList, "Stats">;

export function StatsScreen({ navigation }: Props) {
  const iap = useIap();
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
    <View style={styles.container}>
      <Text style={styles.title}>Your Stats</Text>

      {loading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}

      {!loading && stats && (
        <>
          {/* Streak Card */}
          <View style={styles.streakCard}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={styles.streakValue}>{stats.current_streak}</Text>
            <Text style={styles.streakLabel}>Day Streak</Text>
          </View>

          {/* Stats Grid */}
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.tiles[0] }]}>
              <Text style={styles.statIcon}>⚡</Text>
              <Text style={styles.statValue}>{fmtMs(stats.best_time_ms)}</Text>
              <Text style={styles.statLabel}>Best Time</Text>
            </View>

            {iap.premium ? (
              <View style={[styles.statCard, { backgroundColor: colors.tiles[1] }]}>
                <Text style={styles.statIcon}>💡</Text>
                <Text style={styles.statValue}>{stats.hint_usage_count}</Text>
                <Text style={styles.statLabel}>Hints Used</Text>
              </View>
            ) : (
              <View style={[styles.statCard, { backgroundColor: colors.tiles[1], opacity: 0.75 }]}>
                <Text style={styles.statIcon}>⭐</Text>
                <Text style={styles.statValue}>Premium</Text>
                <Text style={styles.statLabel}>Unlock more stats</Text>
              </View>
            )}
          </View>

          {iap.premium ? (
            <View style={styles.averagesCard}>
              <Text style={styles.cardTitle}>Average Times</Text>

              <View style={styles.averageRow}>
                <View style={styles.averageInfo}>
                  <Text style={styles.averageLabel}>Last 7 Days</Text>
                  <Text style={styles.averageValue}>{fmtMs(stats.avg_7d_ms)}</Text>
                </View>
                <View style={[styles.averageBadge, { backgroundColor: colors.tiles[2] }]}>
                  <Text style={styles.averageBadgeText}>7D</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.averageRow}>
                <View style={styles.averageInfo}>
                  <Text style={styles.averageLabel}>Last 30 Days</Text>
                  <Text style={styles.averageValue}>{fmtMs(stats.avg_30d_ms)}</Text>
                </View>
                <View style={[styles.averageBadge, { backgroundColor: colors.tiles[4] }]}>
                  <Text style={styles.averageBadgeText}>30D</Text>
                </View>
              </View>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate("Paywall")}
              style={({ pressed }) => [styles.upgradeCard, pressed && { opacity: 0.92 }]}
            >
              <Text style={styles.upgradeTitle}>Unlock advanced stats</Text>
              <Text style={styles.upgradeText}>Upgrade to WordCrack Premium to see averages, trends, and more.</Text>
              <Text style={styles.upgradeCta}>Upgrade</Text>
            </Pressable>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.main,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary.darkBlue,
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: colors.text.secondary,
    fontSize: 16,
  },
  streakCard: {
    backgroundColor: colors.primary.darkBlue,
    borderRadius: borderRadius.xl,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    ...shadows.medium,
  },
  streakEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  streakValue: {
    fontSize: 56,
    fontWeight: "900",
    color: colors.primary.yellow,
  },
  streakLabel: {
    fontSize: 16,
    color: colors.primary.lightBlue,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    borderRadius: borderRadius.xl,
    padding: 20,
    alignItems: "center",
    ...shadows.small,
  },
  statIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text.light,
  },
  statLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    marginTop: 4,
  },
  averagesCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 20,
    ...shadows.small,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 16,
  },
  averageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  averageInfo: {
    flex: 1,
  },
  averageLabel: {
    fontSize: 14,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  averageValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.primary.darkBlue,
  },
  averageBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.round,
  },
  averageBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.light,
  },
  divider: {
    height: 1,
    backgroundColor: colors.ui.border,
    marginVertical: 16,
  },
  upgradeCard: {
    backgroundColor: colors.primary.darkBlue,
    borderRadius: borderRadius.xl,
    padding: 18,
    ...shadows.small,
  },
  upgradeTitle: {
    color: colors.text.light,
    fontWeight: "900",
    fontSize: 16,
    marginBottom: 6,
  },
  upgradeText: {
    color: colors.primary.lightBlue,
    lineHeight: 20,
  },
  upgradeCta: {
    marginTop: 12,
    color: colors.primary.yellow,
    fontWeight: "900",
  },
});
