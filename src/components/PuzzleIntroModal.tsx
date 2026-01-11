import React, { useMemo } from "react";
import { Modal, Pressable, Text, View, StyleSheet } from "react-native";
import { useTheme } from "../theme/theme";

type Props = {
  visible: boolean;
  variant: "cipher" | "scramble";
  onStart: () => void;
};

const INTRO_CONTENT = {
  cipher: {
    emoji: "🔐",
    title: "Cipher Puzzle",
    description: "Each letter has been shifted to the left or to the right a number of times. Use the theme and your best shifting skills to help crack the code!",
  },
  scramble: {
    emoji: "🔀",
    title: "Scramble Puzzle",
    description: "A 6-letter word is scrambled. Rearrange the letters into the correct order to find the answer.",
  },
};

export function PuzzleIntroModal({ visible, variant, onStart }: Props) {
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  const content = INTRO_CONTENT[variant];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onStart}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={[styles.iconContainer, { backgroundColor: variant === "cipher" ? colors.primary.orange + "20" : colors.primary.cyan + "20" }]}>
            <Text style={styles.icon}>{content.emoji}</Text>
          </View>

          <Text style={[styles.title, { color: variant === "cipher" ? colors.primary.orange : colors.primary.cyan }]}>
            {content.title}
          </Text>
          <Text style={styles.description}>{content.description}</Text>

          <Pressable
            accessibilityRole="button"
            onPress={onStart}
            style={({ pressed }) => [
              styles.startButton,
              { backgroundColor: variant === "cipher" ? colors.primary.orange : colors.primary.cyan },
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.startText}>Got it!</Text>
          </Pressable>
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
      maxWidth: 340,
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
    description: {
      fontSize: 15,
      color: colors.text.secondary,
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 28,
    },
    startButton: {
      borderRadius: borderRadius.large,
      paddingVertical: 16,
      paddingHorizontal: 48,
      width: "100%",
      alignItems: "center",
      ...shadows.small,
    },
    startText: {
      color: colors.text.light,
      fontSize: 18,
      fontWeight: "800",
    },
  });
}
