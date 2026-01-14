import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Text, View, StyleSheet } from "react-native";
import { useTheme } from "../theme/theme";

type Props = {
  visible: boolean;
  variant: "cipher" | "scramble";
  onStart: () => void;
};

type Slide = { title: string; body: string; renderExtra?: () => React.ReactNode };

function renderCipherExample(styles: any) {
  const a = "SHOP".split("");
  const b = "VKRS".split("");
  return (
    <View style={styles.exampleBox}>
      <Text style={styles.exampleLabel}>Example (shift 3 to the right)</Text>
      <View style={styles.exampleRow}>
        {a.map((c: string, i: number) => (
          <View key={`a-${i}`} style={styles.exampleTile}>
            <Text style={styles.exampleTileText}>{c}</Text>
          </View>
        ))}
        <Text style={styles.exampleArrow}>→</Text>
        {b.map((c: string, i: number) => (
          <View key={`b-${i}`} style={styles.exampleTile}>
            <Text style={styles.exampleTileText}>{c}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function renderScrambleExample(styles: any) {
  const top = "PLANET".split("");
  const bottom = "LENTAP".split("");
  return (
    <View style={styles.exampleBox}>
      <Text style={styles.exampleLabel}>Example (scramble)</Text>
      <Text style={styles.exampleSmall}>Unscramble letters into the correct order.</Text>
      <View style={styles.exampleRow}>
        {bottom.map((c: string, i: number) => (
          <View key={`s-${i}`} style={styles.exampleTile}>
            <Text style={styles.exampleTileText}>{c}</Text>
          </View>
        ))}
      </View>
      <Text style={styles.exampleSmall}>Goal:</Text>
      <View style={styles.exampleRow}>
        {top.map((c: string, i: number) => (
          <View key={`g-${i}`} style={styles.exampleTile}>
            <Text style={styles.exampleTileText}>{c}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function PuzzleIntroModal({ visible, variant, onStart }: Props) {
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (visible) setPage(0);
  }, [visible, variant]);

  const accent = variant === "cipher" ? colors.primary.orange : colors.primary.cyan;
  const emoji = variant === "cipher" ? "🔐" : "🔀";
  const title = variant === "cipher" ? "Cipher Puzzle" : "Scramble Puzzle";
  const slides: Slide[] = useMemo(() => {
    if (variant === "cipher") {
      return [
        {
          title: "How it works",
          body: "Some letters are shifted by the same amount. You’ll always see the shift amount — the direction is hidden.",
        },
        {
          title: "Quick example",
          body: "If you knew the shift was 3 to the right, SHOP becomes VKRS.",
          renderExtra: () => renderCipherExample(styles),
        },
        {
          title: "Pro tip",
          body: "Use Theme + pattern matching. If you need it, the Hint can reveal the direction.",
        },
      ];
    }
    return [
      {
        title: "How it works",
        body: "A 6-letter word is scrambled. Cycle the letters until you form the correct word.",
      },
      {
        title: "Quick example",
        body: "Rearrange letters to match the goal word.",
        renderExtra: () => renderScrambleExample(styles),
      },
      {
        title: "Pro tip",
        body: "Look for common endings and letter pairs. Use Hints if you get stuck.",
      },
    ];
  }, [variant, styles]);

  const slide = slides[Math.max(0, Math.min(slides.length - 1, page))]!;
  const isLast = page >= slides.length - 1;
  const isFirst = page <= 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onStart}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={[styles.iconContainer, { backgroundColor: accent + "20" }]}>
            <Text style={styles.icon}>{emoji}</Text>
          </View>

          <Text style={[styles.title, { color: accent }]}>{title}</Text>
          <Text style={styles.stepTitle}>{slide.title}</Text>
          <Text style={styles.description}>{slide.body}</Text>
          {slide.renderExtra ? slide.renderExtra() : null}

          <View style={styles.navRow}>
            <Pressable
              accessibilityRole="button"
              disabled={isFirst}
              onPress={() => setPage((p) => Math.max(0, p - 1))}
              style={({ pressed }) => [
                styles.navButton,
                isFirst && styles.navButtonDisabled,
                pressed && !isFirst && { opacity: 0.9 },
              ]}
            >
              <Text style={[styles.navButtonText, isFirst && { color: colors.text.muted }]}>Back</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (isLast) onStart();
                else setPage((p) => Math.min(slides.length - 1, p + 1));
              }}
              style={({ pressed }) => [
                styles.startButton,
                { backgroundColor: accent },
                pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
              ]}
            >
              <Text style={styles.startText}>{isLast ? "Got it!" : "Next"}</Text>
            </Pressable>
          </View>

          <Text style={styles.pageDots}>{Array.from({ length: slides.length }, (_, i) => (i === page ? "●" : "○")).join(" ")}</Text>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: any, shadows: any, borderRadius: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    modal: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.xl,
      padding: 28,
      width: "100%",
      maxWidth: 360,
      alignItems: "center",
      ...shadows.large,
    },
    iconContainer: {
      width: 90,
      height: 90,
      borderRadius: 45,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 16,
    },
    icon: {
      fontSize: 48,
    },
    title: {
      fontSize: 28,
      fontWeight: "900",
      marginBottom: 8,
    },
    stepTitle: {
      marginTop: 6,
      fontSize: 16,
      fontWeight: "900",
      color: colors.text.primary,
      textAlign: "center",
    },
    description: {
      fontSize: 15,
      color: colors.text.secondary,
      textAlign: "center",
      lineHeight: 22,
      marginTop: 8,
      marginBottom: 14,
    },
    exampleBox: {
      width: "100%",
      borderWidth: 1,
      borderColor: colors.ui.border,
      backgroundColor: colors.background.main,
      borderRadius: borderRadius.large,
      padding: 12,
      marginBottom: 14,
    },
    exampleLabel: { fontWeight: "900", color: colors.text.primary, marginBottom: 8, textAlign: "center" },
    exampleSmall: { color: colors.text.secondary, fontWeight: "700", textAlign: "center", marginBottom: 8 },
    exampleRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" },
    exampleArrow: { fontSize: 18, fontWeight: "900", color: colors.text.secondary, marginHorizontal: 6 },
    exampleTile: {
      width: 34,
      height: 40,
      borderRadius: borderRadius.medium,
      borderWidth: 1,
      borderColor: colors.ui.border,
      backgroundColor: colors.background.card,
      alignItems: "center",
      justifyContent: "center",
    },
    exampleTileText: { fontSize: 18, fontWeight: "900", color: colors.text.primary },
    navRow: { flexDirection: "row", width: "100%", gap: 10, marginTop: 4 },
    navButton: {
      flex: 1,
      borderRadius: borderRadius.large,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.ui.border,
    },
    navButtonDisabled: { opacity: 0.6 },
    navButtonText: { fontWeight: "900", color: colors.text.primary },
    startButton: {
      flex: 1,
      borderRadius: borderRadius.large,
      paddingVertical: 14,
      alignItems: "center",
      ...shadows.small,
    },
    startText: {
      color: colors.text.light,
      fontSize: 18,
      fontWeight: "800",
    },
    pageDots: { marginTop: 14, color: colors.text.muted, fontWeight: "900" },
  });
}
