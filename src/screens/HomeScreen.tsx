import React, { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { RootStackParamList } from "../AppRoot";
import { useTheme } from "../theme/theme";
import { getTodayPuzzle } from "../lib/api";
import { supabase } from "../lib/supabase";
import { useAuth } from "../state/AuthProvider";
import { useIap } from "../purchases/IapProvider";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

function msUntilNextUtcHour(now = new Date()): number {
  const next = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    now.getUTCHours() + 1,
    0,
    0,
    0,
  );
  return Math.max(0, next - now.getTime());
}

function getPuzzleWindowKey(now = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}:${hh}`;
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
  const theme = useTheme();
  const { colors, shadows, borderRadius } = theme;
  const isFocused = useIsFocused();
  const [tick, setTick] = useState(0);
  const [solvedCurrentPuzzle, setSolvedCurrentPuzzle] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("player");
  const [currentPuzzleId, setCurrentPuzzleId] = useState<string | null>(null);
  const currentPuzzleIdRef = useRef<string | null>(null);
  const prevWindowRef = useRef<string>(getPuzzleWindowKey());

  // Always keep the countdown ticking (smooth UX).
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const refreshPuzzleAndSolved = async () => {
    if (!user) return;
    const puzzle = await getTodayPuzzle();
    if (puzzle.id !== currentPuzzleIdRef.current) {
      // New puzzle window (or first load): avoid UI flicker by resetting completion only after we know we have a new puzzle id.
      setSolvedCurrentPuzzle(false);
      setCurrentPuzzleId(puzzle.id);
      currentPuzzleIdRef.current = puzzle.id;
    }

    const { data, error } = await supabase
      .from("attempts")
      .select("id")
      .eq("user_id", user.id)
      .eq("puzzle_id", puzzle.id)
      .eq("mode", "daily")
      .eq("is_completed", true)
      .limit(1);
    if (error) return;
    setSolvedCurrentPuzzle((data?.length ?? 0) > 0);
  };

  // When the UTC hour boundary passes, refresh puzzle state (only while Home is focused).
  useEffect(() => {
    const k = getPuzzleWindowKey();
    if (k !== prevWindowRef.current) {
      prevWindowRef.current = k;
      if (isFocused) void refreshPuzzleAndSolved();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, isFocused]);

  // When screen gains focus (e.g., returning from puzzle), refresh current puzzle and completion state
  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        try {
          await refreshPuzzleAndSolved();
        } catch {
          // ignore
        }
      })();
    }, [user?.id])
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

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.background.main,
          paddingHorizontal: 20,
        },
        content: {
          flexGrow: 1,
          paddingTop: 18,
          paddingBottom: 40,
          justifyContent: "flex-start",
        },
        logoWrap: {
          alignItems: "center",
          marginBottom: 12,
        },
        logoCard: {
          backgroundColor: "transparent",
          borderRadius: borderRadius.xl,
          padding: 0,
        },
        logoCentered: {
          width: 140,
          height: 140,
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
        solveButton: {
          marginTop: 14,
          backgroundColor: colors.primary.blue,
          borderRadius: borderRadius.large,
          paddingVertical: 14,
          paddingHorizontal: 16,
          alignItems: "center",
          ...shadows.small,
        },
        solveButtonText: {
          color: colors.text.light,
          fontWeight: "900",
          fontSize: 16,
        },
        solvedBadge: {
          marginTop: 14,
          backgroundColor: colors.primary.green,
          borderRadius: borderRadius.large,
          paddingVertical: 14,
          paddingHorizontal: 16,
          alignItems: "center",
          ...shadows.small,
        },
        solvedText: {
          color: colors.text.light,
          fontWeight: "900",
          fontSize: 16,
        },
        practiceButton: {
          backgroundColor: colors.primary.darkBlue,
          borderRadius: borderRadius.xl,
          padding: 18,
          alignItems: "center",
          marginTop: 12,
          ...shadows.small,
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
          marginTop: 14,
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
        howToPlayButton: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background.card,
          borderRadius: borderRadius.large,
          padding: 14,
          marginTop: 12,
          ...shadows.small,
        },
        howToPlayIcon: {
          fontSize: 20,
          marginRight: 8,
        },
        howToPlayText: {
          fontSize: 16,
          fontWeight: "600",
          color: colors.text.primary,
        },
      }),
    [colors, shadows, borderRadius],
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
        {/* Centered logo */}
        <View style={styles.logoWrap}>
          <View style={styles.logoCard}>
            <Image source={require("../../assets/icon.png")} style={styles.logoCentered} resizeMode="contain" />
          </View>
          <Text style={styles.welcome}>Welcome back, {username}</Text>
        </View>

      {/* Puzzle Card */}
      <View style={styles.todayCard}>
        <View style={styles.todayHeader}>
          <Text style={styles.todayLabel}>{solvedCurrentPuzzle ? "Next Puzzle" : "WordCrack Puzzle"}</Text>
          <View style={styles.dateBadge}>
            <Text style={styles.dateText}>{today}</Text>
          </View>
        </View>

        {/* Show countdown to next puzzle */}
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownLabel}>
            {solvedCurrentPuzzle ? "Next puzzle in" : "Time remaining"}
          </Text>
          <Text style={styles.countdown}>{countdown}</Text>
        </View>

        {!solvedCurrentPuzzle ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("Puzzle", { mode: "daily" })}
            style={({ pressed }) => [
              styles.solveButton,
              pressed && { opacity: 0.92 },
            ]}
          >
            <Text style={styles.solveButtonText}>Solve Current Puzzle</Text>
          </Pressable>
        ) : (
          <View style={styles.solvedBadge}>
            <Text style={styles.solvedText}>Completed!</Text>
          </View>
        )}
      </View>

      {/* Practice Button (Premium) */}
      {iap.premium ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Puzzle", { mode: "practice" })}
          style={({ pressed }) => [
            styles.practiceButton,
            pressed && { opacity: 0.92 },
          ]}
        >
          <Text style={styles.practiceButtonText}>Practice Puzzles</Text>
          <Text style={styles.practiceButtonSubtext}>Unlimited non‑leaderboard puzzles</Text>
        </Pressable>
      ) : null}

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

      {/* How to Play */}
      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate("HowToPlay")}
        style={({ pressed }) => [
          styles.howToPlayButton,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Text style={styles.howToPlayIcon}>❓</Text>
        <Text style={styles.howToPlayText}>How to Play</Text>
      </Pressable>

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
    </ScrollView>
  );
}

