import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/theme";

type Props = {
  visible: boolean;
  title?: string;
  message: string;
  onClose: () => void;
};

export function HintModal({ visible, title = "Hint", message, onClose }: Props) {
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>💡</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.button, pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] }]}
          >
            <Text style={styles.buttonText}>Got it</Text>
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
    maxWidth: 360,
    alignItems: "center",
    ...shadows.large,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.button.hint + "20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  icon: { fontSize: 38 },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.primary.darkBlue,
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 18,
  },
  button: {
    backgroundColor: colors.button.primary,
    borderRadius: borderRadius.large,
    paddingVertical: 14,
    paddingHorizontal: 40,
    width: "100%",
    alignItems: "center",
    ...shadows.small,
  },
  buttonText: {
    color: colors.text.light,
    fontSize: 16,
    fontWeight: "800",
  },
  });
}

