import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../AppRoot";
import { getTodayPuzzle, startAttempt, submitAttempt, useHint, type HintType } from "../lib/api";
import { setJson, getJson } from "../lib/storage";

type Props = NativeStackScreenProps<RootStackParamList, "Puzzle">;

function formatMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const ms2 = String(Math.floor((ms % 1000) / 10)).padStart(2, "0");
  return `${mm}:${ss}.${ms2}`;
}

export function PuzzleScreen({ navigation, route }: Props) {
  const mode = route.params.mode;

  const [loading, setLoading] = useState(true);
  const [cipherWord, setCipherWord] = useState<string>("");
  const [letterSets, setLetterSets] = useState<string[][]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [penaltyMs, setPenaltyMs] = useState(0);
  const [hintsUsedCount, setHintsUsedCount] = useState(0);

  const startedAtLocalRef = useRef<number>(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 50);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        startedAtLocalRef.current = Date.now();

        // v1: daily puzzle only (practice wiring comes later)
        const puzzle = await getTodayPuzzle();

        if (!mounted) return;
        setCipherWord(puzzle.cipher_word);
        setLetterSets(puzzle.letter_sets);
        await setJson("wordcrack:todayPuzzleCache", puzzle);

        const attempt = await startAttempt(puzzle.id, mode);
        if (!mounted) return;
        setAttemptId(attempt.id);
        setPenaltyMs(attempt.penalty_ms);
        setHintsUsedCount(Array.isArray(attempt.hints_used) ? attempt.hints_used.length : 0);
      } catch (e: any) {
        Alert.alert("Can't start puzzle", e?.message ?? "Unknown error", [{ text: "OK", onPress: () => navigation.goBack() }]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [mode, navigation]);

  const elapsedMs = useMemo(() => {
    if (!startedAtLocalRef.current) return 0;
    return now - startedAtLocalRef.current;
  }, [now]);

  const [idxs, setIdxs] = useState<number[]>([0, 0, 0, 0, 0, 0]);
  useEffect(() => {
    setIdxs([0, 0, 0, 0, 0, 0]);
  }, [cipherWord]);

  const guessWord = useMemo(() => {
    if (letterSets.length !== 6) return "";
    return letterSets.map((set, i) => set[idxs[i] % set.length]).join("");
  }, [letterSets, idxs]);

  const remainingHints = 3 - hintsUsedCount;

  const bump = (col: number, dir: -1 | 1) => {
    setIdxs((prev) => {
      const next = [...prev];
      const len = letterSets[col]?.length ?? 1;
      next[col] = (next[col] + dir + len) % len;
      return next;
    });
  };

  const showHints = () => {
    if (!attemptId) return;
    if (remainingHints <= 0) return Alert.alert("No hints remaining", "You’ve used all 3 hints for this puzzle.");

    const options: { label: string; type: HintType }[] = [
      { label: "Shift Count (+5s)", type: "shift_count" },
      { label: "Shift Positions (+10s)", type: "shift_position" },
      { label: "Theme (+8s)", type: "theme" },
    ];

    const pick = async (type: HintType) => {
      try {
        const res = await useHint(attemptId, type);
        setPenaltyMs(res.attempt.penalty_ms);
        setHintsUsedCount(Array.isArray(res.attempt.hints_used) ? res.attempt.hints_used.length : 0);
        Alert.alert("Hint", res.message);
      } catch (e: any) {
        Alert.alert("Hint failed", e?.message ?? "Unknown error");
      }
    };

    if (Platform.OS === "ios") {
      // Lazy import to avoid platform-specific module warnings
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ActionSheetIOS = require("react-native").ActionSheetIOS;
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [...options.map((o) => o.label), "Cancel"],
          cancelButtonIndex: options.length,
          title: `Hints remaining: ${remainingHints}`,
        },
        (buttonIndex: number) => {
          if (buttonIndex >= 0 && buttonIndex < options.length) void pick(options[buttonIndex].type);
        },
      );
    } else {
      Alert.alert(
        `Hints remaining: ${remainingHints}`,
        "Choose a hint:",
        [...options.map((o) => ({ text: o.label, onPress: () => void pick(o.type) })), { text: "Cancel", style: "cancel" }],
      );
    }
  };

  const submit = async () => {
    if (!attemptId) return;
    try {
      const res = await submitAttempt(attemptId, guessWord);
      if (!res.correct || !res.attempt) {
        Alert.alert("Not quite", "That’s not correct yet. Keep cracking.");
        return;
      }
      const attempt = res.attempt;
      navigation.replace("Results", {
        attemptId: attempt.id,
        solve_time_ms: attempt.solve_time_ms ?? 0,
        penalty_ms: attempt.penalty_ms,
        final_time_ms: attempt.final_time_ms ?? 0,
        hints_used_count: Array.isArray(attempt.hints_used) ? attempt.hints_used.length : 0,
        rank: res.rank ?? null,
      });
    } catch (e: any) {
      Alert.alert("Submit failed", e?.message ?? "Unknown error");
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 16, color: "#333" }}>Word: {cipherWord || "------"}</Text>

      <View style={{ backgroundColor: "#0B1020", borderRadius: 16, padding: 14 }}>
        <Text style={{ color: "rgba(255,255,255,0.75)" }}>Timer</Text>
        <Text style={{ color: "white", fontSize: 28, fontWeight: "800", marginTop: 6 }}>{formatMs(elapsedMs)}</Text>
        <Text style={{ color: "rgba(255,255,255,0.75)", marginTop: 6 }}>Penalties: +{Math.floor(penaltyMs / 1000)}s</Text>
      </View>

      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8, marginTop: 6 }}>
        {Array.from({ length: 6 }, (_, col) => {
          const set = letterSets[col] ?? ["?"];
          const cur = set[idxs[col] % set.length] ?? "?";
          return (
            <View key={col} style={{ flex: 1, alignItems: "center", gap: 8 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Column ${col + 1} up`}
                onPress={() => bump(col, 1)}
                style={({ pressed }) => ({
                  backgroundColor: "#eee",
                  borderRadius: 10,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ fontWeight: "800" }}>▲</Text>
              </Pressable>

              <View
                style={{
                  width: "100%",
                  backgroundColor: "#fff",
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: "#ddd",
                  paddingVertical: 14,
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 20, fontWeight: "800" }}>{cur}</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Column ${col + 1} down`}
                onPress={() => bump(col, -1)}
                style={({ pressed }) => ({
                  backgroundColor: "#eee",
                  borderRadius: 10,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text style={{ fontWeight: "800" }}>▼</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
        <Pressable
          accessibilityRole="button"
          onPress={showHints}
          disabled={loading || !attemptId}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: remainingHints > 0 ? "#F39C12" : "#bbb",
            borderRadius: 14,
            padding: 14,
            opacity: pressed ? 0.9 : 1,
            alignItems: "center",
          })}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>Hint ({Math.max(0, remainingHints)})</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={submit}
          disabled={loading || !attemptId || guessWord.length !== 6}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: "#2ECC71",
            borderRadius: 14,
            padding: 14,
            opacity: pressed ? 0.9 : 1,
            alignItems: "center",
          })}
        >
          <Text style={{ color: "white", fontWeight: "800" }}>Submit</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", marginTop: 4, fontSize: 12 }}>{guessWord}</Text>
        </Pressable>
      </View>
    </View>
  );
}


