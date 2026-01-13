import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/theme";

export function UpgradeModal(props: {
  visible: boolean;
  onClose: () => void;
  emoji?: string;
  title: string;
  subtitle?: string;
  bullets?: string[];
  primaryLabel: string;
  onPrimary: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);

  return (
    <Modal
      visible={props.visible}
      transparent
      animationType="fade"
      onRequestClose={props.onClose}
    >
      <Pressable style={styles.overlay} onPress={props.onClose}>
        <Pressable style={styles.card} onPress={() => undefined}>
          <View style={styles.emojiCircle}>
            <Text style={styles.emoji}>{props.emoji ?? "⭐"}</Text>
          </View>

          <Text style={styles.title}>{props.title}</Text>
          {props.subtitle ? <Text style={styles.subtitle}>{props.subtitle}</Text> : null}

          {props.bullets?.length ? (
            <View style={styles.bullets}>
              {props.bullets.map((b) => (
                <View key={b} style={styles.bulletRow}>
                  <Text style={styles.bulletDot}>•</Text>
                  <Text style={styles.bulletText}>{b}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              props.onClose();
              props.onPrimary();
            }}
            style={({ pressed }) => [styles.primaryButton, pressed && { opacity: 0.92 }]}
          >
            <Text style={styles.primaryButtonText}>{props.primaryLabel}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => {
              props.onClose();
              (props.onSecondary ?? props.onClose)();
            }}
            style={({ pressed }) => [styles.secondaryButton, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.secondaryButtonText}>{props.secondaryLabel ?? "Not now"}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: any, shadows: any, borderRadius: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.65)",
      padding: 22,
      justifyContent: "center",
      alignItems: "center",
    },
    card: {
      width: "100%",
      maxWidth: 380,
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.xl,
      padding: 20,
      borderWidth: 2,
      borderColor: "rgba(250, 204, 21, 0.35)",
      ...shadows.large,
      alignItems: "center",
    },
    emojiCircle: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: "rgba(250, 204, 21, 0.18)",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 10,
    },
    emoji: { fontSize: 42 },
    title: {
      fontSize: 22,
      fontWeight: "900",
      color: colors.text.primary,
      textAlign: "center",
    },
    subtitle: {
      marginTop: 8,
      color: colors.text.secondary,
      textAlign: "center",
      lineHeight: 20,
    },
    bullets: {
      marginTop: 14,
      width: "100%",
      gap: 10,
      padding: 14,
      borderRadius: borderRadius.large,
      backgroundColor: colors.background.main,
      borderWidth: 1,
      borderColor: colors.ui.border,
    },
    bulletRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
    bulletDot: { color: colors.primary.yellow, fontWeight: "900", marginTop: 2 },
    bulletText: { flex: 1, color: colors.text.secondary, fontWeight: "700", lineHeight: 18 },
    primaryButton: {
      marginTop: 16,
      width: "100%",
      backgroundColor: colors.primary.yellow,
      borderRadius: borderRadius.large,
      paddingVertical: 14,
      alignItems: "center",
      ...shadows.small,
    },
    primaryButtonText: { color: colors.primary.darkBlue, fontWeight: "900", fontSize: 16 },
    secondaryButton: {
      marginTop: 10,
      width: "100%",
      paddingVertical: 12,
      alignItems: "center",
    },
    secondaryButtonText: { color: colors.text.secondary, fontWeight: "800" },
  });
}

