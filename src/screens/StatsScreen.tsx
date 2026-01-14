import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { getMyStats } from "../lib/api";
import { RootStackParamList } from "../AppRoot";
import { useTheme } from "../theme/theme";
import { useAuth } from "../state/AuthProvider";
import { useIap } from "../purchases/IapProvider";
import { UpgradeModal } from "../components/UpgradeModal";

type Props = NativeStackScreenProps<RootStackParamList, "Stats">;

export function StatsScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const iap = useIap();
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof getMyStats>> | null>(null);
  const isAnonymous = Boolean((user as any)?.is_anonymous) || (user as any)?.app_metadata?.provider === "anonymous";
  const isPremium = Boolean(iap.premium);
  const [showUpgrade, setShowUpgrade] = useState(false);

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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Your Stats</Text>
      <UpgradeModal
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        emoji="📈"
        title="Unlock more stats with Premium"
        subtitle={
          isAnonymous
            ? "Subscribe with Guest Mode. Create an account later to sync Premium across devices."
            : "Upgrade to MindShift Premium to unlock full stats."
        }
        bullets={[
          "Best time + hints breakdown",
          "Last 30 days average times",
          "Unlimited practice puzzles",
        ]}
        primaryLabel="Upgrade to Premium"
        onPrimary={() => {
          navigation.navigate("Paywall");
        }}
        secondaryLabel="Not now"
      />

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

          {/* Cipher vs Scramble */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Cipher</Text>
            <View style={styles.statsGrid}>
              <Pressable
                accessibilityRole="button"
                disabled={isPremium}
                onPress={() => setShowUpgrade(true)}
                style={[styles.statCard, { backgroundColor: colors.tiles[0], opacity: isPremium ? 1 : 0.8 }]}
              >
                <Text style={styles.statIcon}>⚡</Text>
                <Text style={styles.statValue}>{isPremium ? fmtMs(stats.cipher.best_time_ms) : "🔒"}</Text>
                <Text style={styles.statLabel}>Best Time</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isPremium}
                onPress={() => setShowUpgrade(true)}
                style={[styles.statCard, { backgroundColor: colors.tiles[1], opacity: isPremium ? 1 : 0.8 }]}
              >
                <Text style={styles.statIcon}>💡</Text>
                <Text style={styles.statValue}>{isPremium ? String(stats.cipher.hint_usage_count) : "🔒"}</Text>
                <Text style={styles.statLabel}>Hints Used</Text>
              </Pressable>
            </View>
            <View style={styles.averagesCard}>
              <Text style={styles.cardTitle}>Average Times</Text>
              <View style={styles.averageRow}>
                <View style={styles.averageInfo}>
                  <Text style={styles.averageLabel}>Last 3 Days</Text>
                  <Text style={styles.averageValue}>{fmtMs(stats.cipher.avg_3d_ms)}</Text>
                </View>
                <View style={[styles.averageBadge, { backgroundColor: colors.tiles[3] }]}>
                  <Text style={styles.averageBadgeText}>3D</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.averageRow}>
                <View style={styles.averageInfo}>
                  <Text style={styles.averageLabel}>Last 7 Days</Text>
                  <Text style={styles.averageValue}>{fmtMs(stats.cipher.avg_7d_ms)}</Text>
                </View>
                <View style={[styles.averageBadge, { backgroundColor: colors.tiles[2] }]}>
                  <Text style={styles.averageBadgeText}>7D</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <Pressable
                accessibilityRole="button"
                disabled={isPremium}
                onPress={() => setShowUpgrade(true)}
                style={styles.averageRow}
              >
                <View style={styles.averageInfo}>
                  <Text style={styles.averageLabel}>Last 30 Days</Text>
                  <Text style={styles.averageValue}>{isPremium ? fmtMs(stats.cipher.avg_30d_ms) : "🔒"}</Text>
                </View>
                <View style={[styles.averageBadge, { backgroundColor: colors.tiles[4] }]}>
                  <Text style={styles.averageBadgeText}>30D</Text>
                </View>
              </Pressable>
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>Scramble</Text>
            <View style={styles.statsGrid}>
              <Pressable
                accessibilityRole="button"
                disabled={isPremium}
                onPress={() => setShowUpgrade(true)}
                style={[styles.statCard, { backgroundColor: colors.tiles[2], opacity: isPremium ? 1 : 0.8 }]}
              >
                <Text style={styles.statIcon}>⚡</Text>
                <Text style={styles.statValue}>{isPremium ? fmtMs(stats.scramble.best_time_ms) : "🔒"}</Text>
                <Text style={styles.statLabel}>Best Time</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={isPremium}
                onPress={() => setShowUpgrade(true)}
                style={[styles.statCard, { backgroundColor: colors.tiles[3], opacity: isPremium ? 1 : 0.8 }]}
              >
                <Text style={styles.statIcon}>💡</Text>
                <Text style={styles.statValue}>{isPremium ? String(stats.scramble.hint_usage_count) : "🔒"}</Text>
                <Text style={styles.statLabel}>Hints Used</Text>
              </Pressable>
            </View>
            <View style={styles.averagesCard}>
              <Text style={styles.cardTitle}>Average Times</Text>
              <View style={styles.averageRow}>
                <View style={styles.averageInfo}>
                  <Text style={styles.averageLabel}>Last 3 Days</Text>
                  <Text style={styles.averageValue}>{fmtMs(stats.scramble.avg_3d_ms)}</Text>
                </View>
                <View style={[styles.averageBadge, { backgroundColor: colors.tiles[4] }]}>
                  <Text style={styles.averageBadgeText}>3D</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.averageRow}>
                <View style={styles.averageInfo}>
                  <Text style={styles.averageLabel}>Last 7 Days</Text>
                  <Text style={styles.averageValue}>{fmtMs(stats.scramble.avg_7d_ms)}</Text>
                </View>
                <View style={[styles.averageBadge, { backgroundColor: colors.tiles[0] }]}>
                  <Text style={styles.averageBadgeText}>7D</Text>
                </View>
              </View>
              <View style={styles.divider} />
              <Pressable
                accessibilityRole="button"
                disabled={isPremium}
                onPress={() => setShowUpgrade(true)}
                style={styles.averageRow}
              >
                <View style={styles.averageInfo}>
                  <Text style={styles.averageLabel}>Last 30 Days</Text>
                  <Text style={styles.averageValue}>{isPremium ? fmtMs(stats.scramble.avg_30d_ms) : "🔒"}</Text>
                </View>
                <View style={[styles.averageBadge, { backgroundColor: colors.tiles[1] }]}>
                  <Text style={styles.averageBadgeText}>30D</Text>
                </View>
              </Pressable>
            </View>
          </View>

          {!isPremium ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowUpgrade(true)}
              style={styles.lockCard}
            >
              <Text style={styles.lockTitle}>🔒 More stats available</Text>
              <Text style={styles.lockText}>Upgrade to see Best Time, Hints, and Last 30 Days averages.</Text>
              <Text style={styles.lockCta}>{isAnonymous ? "Create account" : "Upgrade to Premium"} →</Text>
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

function makeStyles(colors: any, shadows: any, borderRadius: any) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.main,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  lockCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 16,
    borderWidth: 2,
    borderColor: "rgba(250, 204, 21, 0.35)",
    ...shadows.small,
    marginBottom: 16,
  },
  lockTitle: { fontWeight: "900", color: colors.text.primary, marginBottom: 6, fontSize: 16 },
  lockText: { color: colors.text.secondary, lineHeight: 20 },
  lockCta: { marginTop: 10, color: colors.primary.yellow, fontWeight: "900" },
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
    marginBottom: 12,
  },
  sectionCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 16,
    marginBottom: 16,
    ...shadows.small,
  },
  sectionTitle: {
    fontWeight: "900",
    fontSize: 16,
    color: colors.text.primary,
    marginBottom: 12,
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
}
