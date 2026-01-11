import React, { useMemo } from "react";
import { Modal, Pressable, Text, View, StyleSheet } from "react-native";
import { useTheme } from "../theme/theme";

type Props = {
  visible: boolean;
  attemptsRemaining?: number;
  onTryAgain: () => void;
};

export function IncorrectModal({ visible, attemptsRemaining, onTryAgain }: Props) {
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onTryAgain}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Animated X icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>❌</Text>
          </View>

          <Text style={styles.title}>Not Quite!</Text>
          <Text style={styles.message}>
            That's not the right word. Keep rearranging!
          </Text>

          {attemptsRemaining !== undefined && (
            <View style={styles.hintBox}>
              <Text style={styles.hintText}>
                💡 Tip: Use hints to check correct positions or reveal a position
              </Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            onPress={onTryAgain}
            style={({ pressed }) => [
              styles.tryAgainButton,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Text style={styles.tryAgainText}>Try Again</Text>
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
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.ui.error + "20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 20,
  },
  hintBox: {
    backgroundColor: colors.primary.yellow + "20",
    borderRadius: borderRadius.medium,
    padding: 14,
    marginBottom: 24,
    width: "100%",
  },
  hintText: {
    fontSize: 14,
    color: colors.primary.darkBlue,
    textAlign: "center",
  },
  tryAgainButton: {
    backgroundColor: colors.primary.blue,
    borderRadius: borderRadius.large,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: "100%",
    alignItems: "center",
    ...shadows.small,
  },
  tryAgainText: {
    color: colors.text.light,
    fontSize: 18,
    fontWeight: "700",
  },
  });
}
