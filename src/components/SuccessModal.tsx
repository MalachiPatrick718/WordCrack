import React from "react";
import { Modal, Pressable, Text, View, StyleSheet } from "react-native";
import { colors, shadows, borderRadius } from "../theme/colors";

type Props = {
  visible: boolean;
  finalTime: string;
  rank: number | null;
  onContinue: () => void;
};

export function SuccessModal({ visible, finalTime, rank, onContinue }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onContinue}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Celebration icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🎉</Text>
          </View>

          <Text style={styles.title}>Cracked!</Text>
          <Text style={styles.subtitle}>You solved the cipher!</Text>

          {/* Time Display */}
          <View style={styles.timeContainer}>
            <Text style={styles.timeLabel}>Final Time</Text>
            <Text style={styles.timeValue}>{finalTime}</Text>
          </View>

          {/* Rank Badge */}
          {rank && (
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>#{rank} Global</Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={onContinue}
            style={({ pressed }) => [
              styles.continueButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.continueText}>View Results</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: colors.button.submit + "20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  icon: {
    fontSize: 56,
  },
  title: {
    fontSize: 36,
    fontWeight: "900",
    color: colors.button.submit,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.text.secondary,
    marginBottom: 24,
  },
  timeContainer: {
    backgroundColor: colors.primary.darkBlue,
    borderRadius: borderRadius.large,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: "center",
    marginBottom: 16,
  },
  timeLabel: {
    fontSize: 12,
    color: colors.primary.lightBlue,
    marginBottom: 4,
  },
  timeValue: {
    fontSize: 32,
    fontWeight: "900",
    color: colors.text.light,
    fontVariant: ["tabular-nums"],
  },
  rankBadge: {
    backgroundColor: colors.primary.yellow,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: borderRadius.round,
    marginBottom: 24,
  },
  rankText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary.darkBlue,
  },
  continueButton: {
    backgroundColor: colors.button.submit,
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
