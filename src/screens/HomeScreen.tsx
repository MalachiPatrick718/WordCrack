import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { RootStackParamList } from "../AppRoot";
import { useTheme } from "../theme/theme";
import { getTodayPuzzleByVariant } from "../lib/api";
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
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");

  // Drop leading "00:" groups for a cleaner countdown.
  // Examples: 00:32:10 -> 32:10, 00:00:09 -> 09, 01:05:00 -> 01:05:00
  if (h > 0) return `${hh}:${mm}:${ss}`;
  if (m > 0) return `${mm}:${ss}`;
  return ss;
}

export function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const iap = useIap();
  const theme = useTheme();
  const { colors, shadows, borderRadius } = theme;
  const isFocused = useIsFocused();
  const [tick, setTick] = useState(0);
  const [solvedCipher, setSolvedCipher] = useState<boolean>(false);
  const [solvedScramble, setSolvedScramble] = useState<boolean>(false);
  const [username, setUsername] = useState<string>("player");
  const currentCipherIdRef = useRef<string | null>(null);
  const currentScrambleIdRef = useRef<string | null>(null);
  const prevWindowRef = useRef<string>(getPuzzleWindowKey());

  // Always keep the countdown ticking (smooth UX).
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const refreshPuzzleAndSolved = async () => {
    if (!user) return;
    const [cipherPuzzle, scramblePuzzle] = await Promise.all([
      getTodayPuzzleByVariant("cipher"),
      getTodayPuzzleByVariant("scramble"),
    ]);

    // Reset solved flags when a new hour's puzzle id appears.
    if (cipherPuzzle.id !== currentCipherIdRef.current) {
      setSolvedCipher(false);
      currentCipherIdRef.current = cipherPuzzle.id;
    }
    if (scramblePuzzle.id !== currentScrambleIdRef.current) {
      setSolvedScramble(false);
      currentScrambleIdRef.current = scramblePuzzle.id;
    }

    const [cipherAttempts, scrambleAttempts] = await Promise.all([
      supabase
        .from("attempts")
        .select("id")
        .eq("user_id", user.id)
        .eq("puzzle_id", cipherPuzzle.id)
        .eq("mode", "daily")
        .eq("is_completed", true)
        .limit(1),
      supabase
        .from("attempts")
        .select("id")
        .eq("user_id", user.id)
        .eq("puzzle_id", scramblePuzzle.id)
        .eq("mode", "daily")
        .eq("is_completed", true)
        .limit(1),
    ]);

    if (!cipherAttempts.error) setSolvedCipher((cipherAttempts.data?.length ?? 0) > 0);
    if (!scrambleAttempts.error) setSolvedScramble((scrambleAttempts.data?.length ?? 0) > 0);
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
          paddingTop: 0,
          paddingBottom: 40,
          justifyContent: "flex-start",
        },
        logoWrap: {
          alignItems: "center",
          marginBottom: 8,
        },
        logoCard: {
          backgroundColor: "transparent",
          borderRadius: borderRadius.xl,
          padding: 0,
        },
        logoCentered: {
          width: 120,
          height: 120,
        },
        welcome: {
          marginTop: 4,
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
          <Text style={styles.todayLabel}>WordCrack Puzzle</Text>
          <View style={styles.dateBadge}>
            <Text style={styles.dateText}>{today}</Text>
          </View>
        </View>

        {/* Show countdown to next puzzle */}
        <View style={styles.countdownContainer}>
          <Text style={styles.countdownLabel}>
            {"Time remaining"}
          </Text>
          <Text style={styles.countdown}>{countdown}</Text>
        </View>

        <View style={{ gap: 10, marginTop: 14 }}>
          <Pressable
            accessibilityRole="button"
            disabled={solvedCipher}
            onPress={() => navigation.navigate("Puzzle", { mode: "daily", variant: "cipher" })}
            style={({ pressed }) => [
              styles.solveButton,
              { backgroundColor: solvedCipher ? colors.primary.green : colors.primary.orange },
              pressed && !solvedCipher && { opacity: 0.92 },
            ]}
          >
            <Text style={styles.solveButtonText}>{solvedCipher ? "Cipher Completed" : "Solve Cipher Puzzle"}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={solvedScramble}
            onPress={() => navigation.navigate("Puzzle", { mode: "daily", variant: "scramble" })}
            style={({ pressed }) => [
              styles.solveButton,
              { backgroundColor: solvedScramble ? colors.primary.green : colors.primary.cyan },
              pressed && !solvedScramble && { opacity: 0.92 },
            ]}
          >
            <Text style={styles.solveButtonText}>{solvedScramble ? "Scramble Completed" : "Solve Scramble Puzzle"}</Text>
          </Pressable>
        </View>
      </View>

      {/* Practice Button (Premium) */}
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              Alert.alert("Practice Puzzles", "Choose a puzzle type:", [
                { text: "Cancel", style: "cancel" },
                { text: "Cipher Practice", onPress: () => navigation.navigate("Puzzle", { mode: "practice", variant: "cipher" }) },
                { text: "Scramble Practice", onPress: () => navigation.navigate("Puzzle", { mode: "practice", variant: "scramble" }) },
              ]);
            }}
            style={({ pressed }) => [
              styles.practiceButton,
              pressed && { opacity: 0.92 },
            ]}
          >
            <Text style={styles.practiceButtonText}>Practice Puzzles</Text>
            <Text style={styles.practiceButtonSubtext}>
              {iap.premium ? "Unlimited non‑leaderboard puzzles" : "Free: 5 per day (Unlimited with Premium)"}
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

