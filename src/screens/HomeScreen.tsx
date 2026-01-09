import React, { useEffect, useMemo, useState } from "react";
import { Image, Pressable, Text, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "../AppRoot";
import { colors, shadows, borderRadius } from "../theme/colors";
import { getTodayPuzzle } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useAuth } from "../state/AuthProvider";
import { useIap } from "../purchases/IapProvider";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

function msUntilNextUtcHour(now = new Date()): number {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() + 1, 0, 0));
  return next.getTime() - now.getTime();
}

function formatHms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const iap = useIap();
  const [tick, setTick] = useState(0);
  const [solvedToday, setSolvedToday] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("player");

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const refreshSolvedState = async () => {
    const puzzle = await getTodayPuzzle();
    const { data, error } = await supabase
      .from("attempts")
      .select("id")
      .eq("puzzle_id", puzzle.id)
      .eq("mode", "daily")
      .eq("is_completed", true)
      .limit(1);
    if (error) return;
    setSolvedToday((data?.length ?? 0) > 0);
  };

  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          await refreshSolvedState();
        } catch {
          // ignore
        }
      })();
      const id = setInterval(() => {
        if (cancelled) return;
        void refreshSolvedState();
      }, 60_000);
      return () => {
        cancelled = true;
        clearInterval(id);
      };
    }, [])
  );

  useFocusEffect(
    React.useCallback(() => {
      let mounted = true;
      (async () => {
        if (!user) return;
        try {
          const { data } = await supabase
            .from("profiles")
            .select("username")
            .eq("user_id", user.id)
            .maybeSingle();
          if (!mounted) return;
          if (data?.username) setUsername(data.username);
        } catch {
          // ignore
        }
      })();
      return () => {
        mounted = false;
      };
    }, [user?.id])
  );

  const today = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  }, [tick]);
  const countdown = useMemo(() => formatHms(msUntilNextUtcHour()), [tick]);

  return (
    <View style={styles.container}>
        {/* Centered logo */}
        <View style={styles.logoWrap}>
          <Image source={require("../../assets/icon.png")} style={styles.logoCentered} resizeMode="contain" />
          <Text style={styles.welcome}>Welcome back, {username}</Text>
        </View>

      {/* Next Puzzle Card */}
      <View style={styles.todayCard}>
        <View style={styles.todayHeader}>
          <Text style={styles.todayLabel}>Next Puzzle</Text>
          <View style={styles.dateBadge}>
            <Text style={styles.dateText}>{today}</Text>
          </View>
        </View>

        <View style={styles.countdownContainer}>
          <Text style={styles.countdownLabel}>Next puzzle in</Text>
          <Text style={styles.countdown}>{countdown}</Text>
        </View>
      </View>

      {/* Play Button */}
      <Pressable
        accessibilityRole="button"
        disabled={solvedToday}
        onPress={() => navigation.navigate("Puzzle", { mode: "daily" })}
        style={({ pressed }) => [
          styles.playButton,
          solvedToday && styles.playButtonDisabled,
          pressed && styles.playButtonPressed,
        ]}
      >
        <Text style={styles.playButtonText}>{solvedToday ? "Solved Today's Puzzle" : "Solve Today's Puzzle"}</Text>
        <Text style={styles.playButtonSubtext}>
          {solvedToday ? "Come back for the next puzzle." : "Solve the daily cipher!"}
        </Text>
      </Pressable>

      {/* Practice Button (Premium) */}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          if (iap.premium) navigation.navigate("Puzzle", { mode: "practice" });
          else navigation.navigate("Paywall");
        }}
        style={({ pressed }) => [
          styles.practiceButton,
          !iap.premium && styles.practiceButtonLocked,
          pressed && { opacity: 0.92 },
        ]}
      >
        <Text style={styles.practiceButtonText}>
          {iap.premium ? "Practice Puzzles" : "Practice Puzzles 🔒"}
        </Text>
        <Text style={styles.practiceButtonSubtext}>
          {iap.premium ? "Unlimited non‑leaderboard puzzles" : "Upgrade to unlock unlimited practice"}
        </Text>
      </Pressable>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Leaderboards")}
          style={({ pressed }) => [
            styles.quickButton,
            { backgroundColor: colors.tiles[0] },
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.quickButtonIcon}>🏆</Text>
          <Text style={styles.quickButtonText}>Leaderboard</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Stats")}
          style={({ pressed }) => [
            styles.quickButton,
            { backgroundColor: colors.tiles[1] },
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.quickButtonIcon}>📊</Text>
          <Text style={styles.quickButtonText}>Stats</Text>
        </Pressable>
      </View>

      {/* Settings */}
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate("Settings")}
        style={({ pressed }) => [
          styles.settingsButton,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Text style={styles.settingsIcon}>⚙️</Text>
        <Text style={styles.settingsText}>Settings</Text>
      </Pressable>
        <View style={{ flex: 1 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.main,
    padding: 20,
  },
  logoWrap: {
    alignItems: "center",
    marginBottom: 14,
    paddingTop: 10,
  },
  logoCentered: {
    width: 230,
    height: 96,
  },
  welcome: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.secondary,
  },
  todayCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 20,
    ...shadows.medium,
  },
  todayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  todayLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text.primary,
  },
  dateBadge: {
    backgroundColor: colors.primary.yellow,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.round,
  },
  dateText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary.darkBlue,
  },
  countdownContainer: {
    backgroundColor: colors.primary.darkBlue,
    borderRadius: borderRadius.large,
    padding: 16,
    alignItems: "center",
  },
  countdownLabel: {
    fontSize: 14,
    color: colors.primary.lightBlue,
    marginBottom: 4,
  },
  countdown: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.text.light,
    fontVariant: ["tabular-nums"],
  },
  playButton: {
    backgroundColor: colors.primary.blue,
    borderRadius: borderRadius.xl,
    padding: 20,
    alignItems: "center",
    marginTop: 16,
    ...shadows.medium,
  },
  playButtonPressed: {
    backgroundColor: colors.button.primaryPressed,
  },
  playButtonDisabled: {
    backgroundColor: colors.text.muted,
  },
  playButtonText: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text.light,
  },
  playButtonSubtext: {
    fontSize: 14,
    color: colors.primary.lightBlue,
    marginTop: 4,
  },
  practiceButton: {
    backgroundColor: colors.primary.darkBlue,
    borderRadius: borderRadius.xl,
    padding: 18,
    alignItems: "center",
    marginTop: 12,
    ...shadows.small,
  },
  practiceButtonLocked: {
    opacity: 0.9,
    backgroundColor: colors.text.muted,
  },
  practiceButtonText: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.text.light,
  },
  practiceButtonSubtext: {
    fontSize: 13,
    color: colors.primary.lightBlue,
    marginTop: 4,
  },
  quickActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  quickButton: {
    flex: 1,
    borderRadius: borderRadius.large,
    padding: 16,
    alignItems: "center",
    ...shadows.small,
  },
  quickButtonIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  quickButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.light,
  },
  settingsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.large,
    padding: 14,
    marginTop: 12,
    ...shadows.small,
  },
  settingsIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  settingsText: {
    fontSize: 16,
    fontWeight: "600",
    color: colors.text.primary,
  },
});
