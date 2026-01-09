import React from "react";
import { Alert, Pressable, Share, Text, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../AppRoot";
import { colors, shadows, borderRadius } from "../theme/colors";
import { enableDailyReminder } from "../lib/notifications";

type Props = NativeStackScreenProps<RootStackParamList, "Results">;

function fmtMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const ms2 = String(Math.floor((ms % 1000) / 10)).padStart(2, "0");
  return `${mm}:${ss}.${ms2}`;
}

export function ResultsScreen({ navigation, route }: Props) {
  const { solve_time_ms, penalty_ms, final_time_ms, hints_used_count, rank } = route.params;

  const share = async () => {
    try {
      const msg =
        `🔓 WordCrack — Daily Puzzle\n\n` +
        `⏱️ Raw: ${fmtMs(solve_time_ms)}\n` +
        `⚠️ Penalties: +${Math.floor(penalty_ms / 1000)}s (${hints_used_count} hints)\n` +
        `🏆 Final: ${fmtMs(final_time_ms)}\n` +
        (rank ? `📊 Rank: #${rank}\n` : "") +
        `\nCan you crack it faster?`;
      await Share.share({ message: msg });
    } catch {
      Alert.alert("Share failed");
    }
  };

  return (
    <View style={styles.container}>
      {/* Success Header */}
      <View style={styles.successHeader}>
        <Text style={styles.successEmoji}>🎉</Text>
        <Text style={styles.successTitle}>Cracked!</Text>
      </View>

      {/* Final Time Card */}
      <View style={styles.finalTimeCard}>
        <Text style={styles.finalTimeLabel}>Final Time</Text>
        <Text style={styles.finalTimeValue}>{fmtMs(final_time_ms)}</Text>
        {rank && (
          <View style={styles.rankBadge}>
            <Text style={styles.rankText}>#{rank} Global</Text>
          </View>
        )}
      </View>

      {/* Stats Breakdown */}
      <View style={styles.statsCard}>
        <View style={styles.statRow}>
          <View style={[styles.statIcon, { backgroundColor: colors.tiles[0] }]}>
            <Text style={styles.statIconText}>⏱️</Text>
          </View>
          <View style={styles.statInfo}>
            <Text style={styles.statLabel}>Raw Time</Text>
            <Text style={styles.statValue}>{fmtMs(solve_time_ms)}</Text>
          </View>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statRow}>
          <View style={[styles.statIcon, { backgroundColor: colors.tiles[1] }]}>
            <Text style={styles.statIconText}>⚠️</Text>
          </View>
          <View style={styles.statInfo}>
            <Text style={styles.statLabel}>Penalties</Text>
            <Text style={styles.statValue}>+{Math.floor(penalty_ms / 1000)}s</Text>
          </View>
        </View>

        <View style={styles.statDivider} />

        <View style={styles.statRow}>
          <View style={[styles.statIcon, { backgroundColor: colors.tiles[2] }]}>
            <Text style={styles.statIconText}>💡</Text>
          </View>
          <View style={styles.statInfo}>
            <Text style={styles.statLabel}>Hints Used</Text>
            <Text style={styles.statValue}>{hints_used_count}/3</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={share}
          style={({ pressed }) => [
            styles.shareButton,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.shareButtonText}>📤 Share Result</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={async () => {
            try {
              await enableDailyReminder();
              Alert.alert("Daily reminder enabled", "We’ll remind you every day at 9:00 AM (local time). You can turn this off in Settings.");
            } catch (e: any) {
              Alert.alert("Couldn't enable reminder", e?.message ?? "Unknown error");
            }
          }}
          style={({ pressed }) => [
            styles.reminderButton,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.reminderButtonText}>🔔 Enable Daily Reminder</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }} />

      {/* Home Button */}
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          navigation.reset({
            index: 0,
            routes: [{ name: "Home" }],
          })
        }
        style={({ pressed }) => [
          styles.homeButton,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Text style={styles.homeButtonText}>Back to Home</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.main,
    padding: 16,
  },
  successHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  successEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.primary.darkBlue,
  },
  finalTimeCard: {
    backgroundColor: colors.primary.darkBlue,
    borderRadius: borderRadius.xl,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
    ...shadows.medium,
  },
  finalTimeLabel: {
    fontSize: 14,
    color: colors.primary.lightBlue,
    marginBottom: 8,
  },
  finalTimeValue: {
    fontSize: 48,
    fontWeight: "900",
    color: colors.text.light,
    fontVariant: ["tabular-nums"],
  },
  rankBadge: {
    backgroundColor: colors.primary.yellow,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.round,
    marginTop: 12,
  },
  rankText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary.darkBlue,
  },
  statsCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 16,
    marginBottom: 16,
    ...shadows.small,
  },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.medium,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  statIconText: {
    fontSize: 20,
  },
  statInfo: {
    flex: 1,
  },
  statLabel: {
    fontSize: 13,
    color: colors.text.secondary,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
  },
  statDivider: {
    height: 1,
    backgroundColor: colors.ui.border,
    marginVertical: 4,
  },
  actions: {
    gap: 12,
  },
  shareButton: {
    backgroundColor: colors.primary.blue,
    borderRadius: borderRadius.large,
    padding: 16,
    alignItems: "center",
    ...shadows.small,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.light,
  },
  reminderButton: {
    backgroundColor: colors.background.card,
    borderWidth: 2,
    borderColor: colors.ui.border,
    borderRadius: borderRadius.large,
    padding: 16,
    alignItems: "center",
  },
  reminderButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.primary,
  },
  homeButton: {
    backgroundColor: colors.button.submit,
    borderRadius: borderRadius.large,
    padding: 16,
    alignItems: "center",
    ...shadows.small,
  },
  homeButtonText: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text.light,
  },
});
