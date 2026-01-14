import React, { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/theme";
import type { HintType } from "../lib/api";

type Item = { type: HintType; title: string; subtitle: string };

const SCRAMBLE_ITEMS: Item[] = [
  { type: "check_positions", title: "Check correct positions", subtitle: "Cost: +5s" },
  { type: "reveal_position", title: "Reveal a position", subtitle: "Cost: +8s" },
  { type: "reveal_theme", title: "Reveal theme hint", subtitle: "Cost: +10s" },
];

const CIPHER_ITEMS: Item[] = [
  { type: "check_positions", title: "Check correct positions", subtitle: "Cost: +5s" },
  { type: "shift_direction", title: "Reveal direction", subtitle: "Cost: +8s" },
  { type: "unshifted_positions", title: "Unshifted positions", subtitle: "Cost: +10s" },
];

type Props = {
  visible: boolean;
  remainingHints: number;
  variant: "cipher" | "scramble";
  usedTypes: Set<HintType>;
  onPick: (type: HintType) => void;
  onClose: () => void;
};

export function HintPickerModal({ visible, remainingHints, variant, usedTypes, onPick, onClose }: Props) {
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  const items = variant === "cipher" ? CIPHER_ITEMS : SCRAMBLE_ITEMS;
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Choose a hint</Text>
          <Text style={styles.subtitle}>Hints remaining: {Math.max(0, remainingHints)}</Text>

          <View style={{ width: "100%", gap: 10, marginTop: 14 }}>
            {items.map((it) => {
              const used = usedTypes.has(it.type);
              const disabled = used || remainingHints <= 0;
              return (
                <Pressable
                  key={it.type}
                  accessibilityRole="button"
                  disabled={disabled}
                  onPress={() => onPick(it.type)}
                  style={({ pressed }) => [
                    styles.item,
                    disabled && styles.itemDisabled,
                    pressed && !disabled && { opacity: 0.92, transform: [{ scale: 0.99 }] },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.itemTitle, disabled && { color: colors.text.muted }]}>
                      {it.title} {used ? "(Used)" : ""}
                    </Text>
                    <Text style={[styles.itemSub, disabled && { color: colors.text.muted }]}>{it.subtitle}</Text>
                  </View>
                  <Text style={[styles.chev, disabled && { color: colors.text.muted }]}>›</Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.cancel, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.cancelText}>Cancel</Text>
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
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modal: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 20,
    ...shadows.large,
  },
  title: { fontSize: 20, fontWeight: "900", color: colors.primary.darkBlue },
  subtitle: { marginTop: 6, color: colors.text.secondary },
  item: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: borderRadius.large,
    borderWidth: 1,
    borderColor: colors.ui.border,
    backgroundColor: colors.background.main,
    ...shadows.small,
  },
  itemDisabled: {
    // Use a neutral grey that reads as "disabled" in both light + dark themes.
    backgroundColor: "rgba(150, 150, 150, 0.35)",
    borderColor: "rgba(150, 150, 150, 0.55)",
    shadowOpacity: 0,
    elevation: 0,
  },
  itemTitle: { fontSize: 16, fontWeight: "800", color: colors.text.primary },
  itemSub: { marginTop: 6, fontSize: 14, fontWeight: "800", color: colors.text.secondary },
  chev: { fontSize: 24, color: colors.primary.darkBlue, marginLeft: 10 },
  cancel: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: borderRadius.large,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.ui.border,
  },
  cancelText: { fontWeight: "800", color: colors.text.primary },
  });
}

