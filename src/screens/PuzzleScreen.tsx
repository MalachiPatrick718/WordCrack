import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, Text, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../AppRoot";
import { getTodayPuzzle, startAttempt, submitAttempt, useHint, type HintType } from "../lib/api";
import { setJson } from "../lib/storage";
import { colors, shadows, borderRadius } from "../theme/colors";
import { IncorrectModal } from "../components/IncorrectModal";
import { SuccessModal } from "../components/SuccessModal";
import { HintModal } from "../components/HintModal";
import { HintPickerModal } from "../components/HintPickerModal";

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
  const [puzzleId, setPuzzleId] = useState<string | null>(null);
  const [cipherWord, setCipherWord] = useState<string>("");
  const [letterSets, setLetterSets] = useState<string[][]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [penaltyMs, setPenaltyMs] = useState(0);
  const [hintsUsedCount, setHintsUsedCount] = useState(0);

  // Modal states
  const [showIncorrect, setShowIncorrect] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showHintPicker, setShowHintPicker] = useState(false);
  const [hintMessage, setHintMessage] = useState("");
  const [successData, setSuccessData] = useState<{
    finalTime: string;
    rank: number | null;
    attemptId: string;
    solve_time_ms: number;
    penalty_ms: number;
    final_time_ms: number;
    hints_used_count: number;
  } | null>(null);

  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const startedAtLocalRef = useRef<number>(0);
  const pausedAtRef = useRef<number>(0);
  const pausedTotalRef = useRef<number>(0);
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
        // Load puzzle, but don't start attempt/timer until user presses Start.
        setStarted(false);
        setPaused(false);
        startedAtLocalRef.current = 0;
        pausedAtRef.current = 0;
        pausedTotalRef.current = 0;
        setAttemptId(null);
        setPenaltyMs(0);
        setHintsUsedCount(0);

        const puzzle = await getTodayPuzzle();

        if (!mounted) return;
        setPuzzleId(puzzle.id);
        setCipherWord(puzzle.cipher_word);
        setLetterSets(puzzle.letter_sets);
        await setJson("wordcrack:todayPuzzleCache", puzzle);
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
    if (!started || !startedAtLocalRef.current) return 0;
    const baseNow = paused ? (pausedAtRef.current || now) : now;
    return Math.max(0, baseNow - startedAtLocalRef.current - pausedTotalRef.current);
  }, [now, started, paused]);

  // Start blank (no pre-selected letters)
  const [idxs, setIdxs] = useState<(number | null)[]>([null, null, null, null, null, null]);
  useEffect(() => {
    setIdxs([null, null, null, null, null, null]);
  }, [cipherWord]);

  const getSelectedLetter = (col: number): string | null => {
    const set = letterSets[col];
    const idx = idxs[col];
    if (!set || !set.length || idx == null) return null;
    return set[idx % set.length] ?? null;
  };

  const guessWord = useMemo(() => {
    if (letterSets.length !== 6) return "";
    const letters = letterSets.map((_, i) => getSelectedLetter(i));
    if (letters.some((l) => l == null)) return "";
    return (letters as string[]).join("");
  }, [letterSets, idxs]);

  const remainingHints = 3 - hintsUsedCount;
  const allSelected = idxs.every((i) => i !== null);

  const canInteractLetters = started && !paused && !loading;
  const [usedHintTypesLocal, setUsedHintTypesLocal] = useState<Set<HintType>>(new Set());

  const bump = (col: number, dir: -1 | 1) => {
    if (!canInteractLetters) return;
    setIdxs((prev) => {
      const next = [...prev];
      const len = letterSets[col]?.length ?? 1;
      if (next[col] == null) {
        next[col] = dir === 1 ? 0 : len - 1;
        return next;
      }
      next[col] = ((next[col] as number) + dir + len) % len;
      return next;
    });
  };

  const onStart = async () => {
    if (started) return;
    if (!puzzleId) return Alert.alert("Puzzle not ready", "Please try again in a moment.");
    try {
      setLoading(true);

      const attempt = await startAttempt(puzzleId, mode);
      setAttemptId(attempt.id);
      setPenaltyMs(attempt.penalty_ms);
      setHintsUsedCount(Array.isArray(attempt.hints_used) ? attempt.hints_used.length : 0);

      // Populate boxes with a random starting letter (not blank)
      const nextIdxs = letterSets.map((set) => {
        const len = set?.length ?? 0;
        if (len <= 0) return 0;
        return Math.floor(Math.random() * len);
      });
      setIdxs(nextIdxs.map((n) => (Number.isFinite(n) ? n : 0)));

      pausedTotalRef.current = 0;
      pausedAtRef.current = 0;
      startedAtLocalRef.current = Date.now();
      setPaused(false);
      setStarted(true);
    } catch (e: any) {
      Alert.alert("Can't start puzzle", e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const togglePause = () => {
    if (!started) return;
    if (!paused) {
      pausedAtRef.current = Date.now();
      setPaused(true);
    } else {
      const pausedFor = Date.now() - (pausedAtRef.current || Date.now());
      pausedTotalRef.current += Math.max(0, pausedFor);
      pausedAtRef.current = 0;
      setPaused(false);
    }
  };

  const showHints = () => {
    if (!attemptId || !started) return;
    if (remainingHints <= 0) return Alert.alert("No hints remaining", "You've used all 3 hints for this puzzle.");
    setShowHintPicker(true);
  };

  const pickHint = async (type: HintType) => {
    if (!attemptId) return;
    if (usedHintTypesLocal.has(type)) return;
    try {
      const res = await useHint(attemptId, type);
      setPenaltyMs(res.attempt.penalty_ms);
      setHintsUsedCount(Array.isArray(res.attempt.hints_used) ? res.attempt.hints_used.length : 0);
      setUsedHintTypesLocal((prev) => new Set(prev).add(type));
      setShowHintPicker(false);
      setHintMessage(res.message);
      setShowHint(true);
    } catch (e: any) {
      setShowHintPicker(false);
      Alert.alert("Hint failed", e?.message ?? "Unknown error");
    }
  };

  const submit = async () => {
    if (!attemptId || !started || paused || !allSelected) return;
    try {
      const res = await submitAttempt(attemptId, guessWord);
      if (!res.correct || !res.attempt) {
        // Show incorrect modal instead of Alert
        setShowIncorrect(true);
        return;
      }
      const attempt = res.attempt;
      const hintsCount = Array.isArray(attempt.hints_used) ? attempt.hints_used.length : 0;

      // Store success data and show modal
      setSuccessData({
        finalTime: formatMs(attempt.final_time_ms ?? 0),
        rank: res.rank ?? null,
        attemptId: attempt.id,
        solve_time_ms: attempt.solve_time_ms ?? 0,
        penalty_ms: attempt.penalty_ms,
        final_time_ms: attempt.final_time_ms ?? 0,
        hints_used_count: hintsCount,
      });
      setShowSuccess(true);
    } catch (e: any) {
      Alert.alert("Submit failed", e?.message ?? "Unknown error");
    }
  };

  const handleSuccessContinue = () => {
    if (!successData) return;
    setShowSuccess(false);
    navigation.replace("Results", {
      attemptId: successData.attemptId,
      solve_time_ms: successData.solve_time_ms,
      penalty_ms: successData.penalty_ms,
      final_time_ms: successData.final_time_ms,
      hints_used_count: successData.hints_used_count,
      rank: successData.rank,
    });
  };

  return (
    <View style={styles.container}>
      {/* Cipher Word Display */}
      <View style={styles.cipherContainer}>
        <Text style={styles.cipherLabel}>Cipher Word</Text>
        <View style={styles.cipherTiles}>
          {(cipherWord || "------").split("").map((letter, i) => (
            <View key={i} style={[styles.cipherTile, { backgroundColor: colors.tiles[i % colors.tiles.length] }]}>
              <Text style={styles.cipherLetter}>{letter}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Timer Card */}
      <View style={styles.timerCard}>
        <View style={styles.timerRow}>
          <View style={styles.timerSection}>
            <Text style={styles.timerLabel}>Time</Text>
            <Text style={styles.timerValue}>{formatMs(elapsedMs)}</Text>
          </View>
          <View style={styles.timerDivider} />
          <View style={styles.timerSection}>
            <Text style={styles.timerLabel}>Penalties</Text>
            <Text style={styles.penaltyValue}>+{Math.floor(penaltyMs / 1000)}s</Text>
          </View>
        </View>
        <View style={styles.timerActions}>
          {!started ? (
            <Pressable
              accessibilityRole="button"
              onPress={onStart}
              disabled={loading || !puzzleId}
              style={({ pressed }) => [
                styles.startButton,
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}
            >
              <Text style={styles.startButtonText}>Start</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={togglePause}
              style={({ pressed }) => [
                styles.pauseButton,
                pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
              ]}
            >
              <Text style={styles.pauseButtonText}>{paused ? "Resume" : "Pause"}</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Letter Columns */}
      <View style={styles.columnsContainer}>
        {Array.from({ length: 6 }, (_, col) => {
          const sel = getSelectedLetter(col);
          const cur = started ? (sel ?? "?") : "—";
          const hasSelection = sel !== null;
          const tileColor = colors.tiles[col % colors.tiles.length];

          return (
            <View key={col} style={styles.column}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Column ${col + 1} up`}
                onPress={() => bump(col, -1)}
                disabled={!canInteractLetters}
                style={({ pressed }) => [
                  styles.arrowButton,
                  !canInteractLetters && { opacity: 0.4 },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                ]}
              >
                <Text style={styles.arrowText}>▲</Text>
              </Pressable>

              <View style={[
                styles.letterTile,
                hasSelection
                  ? { backgroundColor: tileColor }
                  : { backgroundColor: colors.background.card, borderWidth: 2, borderColor: colors.ui.border }
              ]}>
                <Text style={[
                  styles.letterText,
                  !hasSelection && { color: colors.text.muted }
                ]}>{cur}</Text>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Column ${col + 1} down`}
                onPress={() => bump(col, 1)}
                disabled={!canInteractLetters}
                style={({ pressed }) => [
                  styles.arrowButton,
                  !canInteractLetters && { opacity: 0.4 },
                  pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
                ]}
              >
                <Text style={styles.arrowText}>▼</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      {/* Current Guess Display */}
      <View style={styles.guessContainer}>
        <Text style={styles.guessLabel}>Your Answer</Text>
        <Text style={[styles.guessWord, !allSelected && { color: colors.text.muted }]}>
          {guessWord || "------"}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={showHints}
          disabled={loading || !attemptId || !started}
          style={({ pressed }) => [
            styles.hintButton,
            remainingHints <= 0 && styles.hintButtonDisabled,
            (!started || !attemptId) && styles.hintButtonDisabled,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.hintButtonIcon}>💡</Text>
          <Text style={styles.hintButtonText}>Hint ({Math.max(0, remainingHints)})</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={submit}
          disabled={loading || !attemptId || !started || paused || !allSelected}
          style={({ pressed }) => [
            styles.submitButton,
            (!allSelected || !started || paused) && styles.submitButtonDisabled,
            pressed && allSelected && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.submitButtonText}>Submit</Text>
        </Pressable>
      </View>

      <HintPickerModal
        visible={showHintPicker}
        remainingHints={remainingHints}
        usedTypes={usedHintTypesLocal}
        onPick={pickHint}
        onClose={() => setShowHintPicker(false)}
      />

      <HintModal
        visible={showHint}
        message={hintMessage}
        onClose={() => setShowHint(false)}
      />

      {/* Incorrect Answer Modal */}
      <IncorrectModal
        visible={showIncorrect}
        onTryAgain={() => setShowIncorrect(false)}
      />

      {/* Success Modal */}
      <SuccessModal
        visible={showSuccess}
        finalTime={successData?.finalTime ?? "00:00.00"}
        rank={successData?.rank ?? null}
        onContinue={handleSuccessContinue}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.main,
    padding: 16,
  },
  cipherContainer: {
    alignItems: "center",
    marginBottom: 12,
  },
  cipherLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.secondary,
    marginBottom: 8,
  },
  cipherTiles: {
    flexDirection: "row",
    gap: 6,
  },
  cipherTile: {
    width: 46,
    height: 46,
    borderRadius: borderRadius.medium,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.small,
  },
  cipherLetter: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text.light,
  },
  timerCard: {
    backgroundColor: colors.primary.darkBlue,
    borderRadius: borderRadius.large,
    padding: 16,
    marginBottom: 16,
  },
  timerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timerSection: {
    flex: 1,
    alignItems: "center",
  },
  timerDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.primary.lightBlue,
    opacity: 0.3,
  },
  timerLabel: {
    fontSize: 12,
    color: colors.primary.lightBlue,
    marginBottom: 4,
  },
  timerValue: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.light,
    fontVariant: ["tabular-nums"],
  },
  penaltyValue: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primary.yellow,
  },
  timerActions: {
    marginTop: 14,
  },
  startButton: {
    backgroundColor: colors.button.submit,
    borderRadius: borderRadius.large,
    paddingVertical: 12,
    alignItems: "center",
    ...shadows.small,
  },
  startButtonText: {
    color: colors.text.light,
    fontSize: 18,
    fontWeight: "900",
  },
  pauseButton: {
    backgroundColor: colors.button.secondary,
    borderRadius: borderRadius.large,
    paddingVertical: 12,
    alignItems: "center",
    ...shadows.small,
  },
  pauseButtonText: {
    color: colors.primary.darkBlue,
    fontSize: 18,
    fontWeight: "900",
  },
  columnsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
    marginBottom: 16,
  },
  column: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  arrowButton: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.medium,
    paddingVertical: 10,
    paddingHorizontal: 14,
    ...shadows.small,
  },
  arrowText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primary.darkBlue,
  },
  letterTile: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: borderRadius.large,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.medium,
  },
  letterText: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.light,
  },
  guessContainer: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.large,
    padding: 16,
    alignItems: "center",
    marginBottom: 16,
    ...shadows.small,
  },
  guessLabel: {
    fontSize: 12,
    color: colors.text.secondary,
    marginBottom: 6,
  },
  guessWord: {
    fontSize: 32,
    fontWeight: "800",
    color: colors.primary.darkBlue,
    letterSpacing: 4,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  hintButton: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: colors.button.hint,
    borderRadius: borderRadius.large,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    ...shadows.small,
  },
  hintButtonDisabled: {
    backgroundColor: colors.text.muted,
  },
  hintButtonIcon: {
    fontSize: 18,
  },
  hintButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text.light,
  },
  submitButton: {
    flex: 1,
    backgroundColor: colors.button.submit,
    borderRadius: borderRadius.large,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    ...shadows.small,
  },
  submitButtonDisabled: {
    backgroundColor: colors.text.muted,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text.light,
  },
});
