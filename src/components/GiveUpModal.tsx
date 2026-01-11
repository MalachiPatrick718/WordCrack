import React, { useMemo } from "react";
import { Modal, Pressable, Text, View, StyleSheet } from "react-native";
import { useTheme } from "../theme/theme";

type Props = {
  visible: boolean;
  targetWord: string;
  onClose: () => void;
};

export function GiveUpModal({ visible, targetWord, onClose }: Props) {
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔓</Text>
          </View>

          <Text style={styles.title}>Word Revealed</Text>
          <Text style={styles.subtitle}>Better luck next time!</Text>

          <View style={styles.wordContainer}>
            <Text style={styles.wordLabel}>The word was</Text>
            <View style={styles.wordTiles}>
              {targetWord.split("").map((letter, i) => (
                <View key={i} style={[styles.letterTile, { backgroundColor: colors.tiles[i % colors.tiles.length] }]}>
                  <Text style={styles.letter}>{letter}</Text>
                </View>
              ))}
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [
              styles.continueButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.continueText}>Back to Home</Text>
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
      padding: 32,
      width: "100%",
      maxWidth: 340,
      alignItems: "center",
      ...shadows.large,
    },
    iconContainer: {
      width: 100,
      height: 100,
      borderRadius: 50,
      backgroundColor: colors.primary.orange + "20",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 20,
    },
    icon: {
      fontSize: 56,
    },
    title: {
      fontSize: 32,
      fontWeight: "900",
      color: colors.primary.orange,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 16,
      color: colors.text.secondary,
      marginBottom: 24,
    },
    wordContainer: {
      alignItems: "center",
      marginBottom: 24,
    },
    wordLabel: {
      fontSize: 14,
      color: colors.text.secondary,
      marginBottom: 12,
    },
    wordTiles: {
      flexDirection: "row",
      gap: 6,
    },
    letterTile: {
      width: 52,
      height: 52,
      borderRadius: borderRadius.medium,
      alignItems: "center",
      justifyContent: "center",
      ...shadows.small,
    },
    letter: {
      fontSize: 28,
      fontWeight: "800",
      color: colors.text.light,
    },
    continueButton: {
      backgroundColor: colors.primary.darkBlue,
      borderRadius: borderRadius.large,
      paddingVertical: 16,
      paddingHorizontal: 48,
      width: "100%",
      alignItems: "center",
      ...shadows.small,
    },
    continueText: {
      color: colors.text.light,
      fontSize: 18,
      fontWeight: "700",
    },
  });
}
