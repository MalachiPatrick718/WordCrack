import React from "react";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme/theme";

export function BootSplash(props: { subtitle?: string }) {
  const { colors, shadows, borderRadius } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Image source={require("../../assets/icon.png")} style={styles.logo} resizeMode="contain" />
        <Text style={styles.title}>MindShift</Text>
        <Text style={styles.tagline}>Crack the Cipher</Text>
        <Text style={styles.tagline}>Solve the Scramble</Text>
        <View style={styles.divider} />
        <ActivityIndicator color={colors.primary.yellow} />
        <Text style={styles.sub}>{props.subtitle ?? "Getting things ready…"}</Text>
      </View>
    </View>
  );
}

function makeStyles(colors: any, shadows: any, borderRadius: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background.main,
      padding: 20,
    },
    card: {
      width: "100%",
      maxWidth: 420,
      borderRadius: borderRadius.xl,
      backgroundColor: colors.background.card,
      alignItems: "center",
      paddingVertical: 26,
      paddingHorizontal: 22,
      borderWidth: 1,
      borderColor: colors.ui.border,
      ...shadows.medium,
    },
    logo: { width: 92, height: 92, marginBottom: 10 },
    title: { fontSize: 22, fontWeight: "900", color: colors.text.primary, marginBottom: 10 },
    tagline: { fontSize: 16, fontWeight: "800", color: colors.text.secondary, lineHeight: 22 },
    divider: { height: 1, alignSelf: "stretch", backgroundColor: colors.ui.border, marginTop: 16, marginBottom: 14 },
    sub: { marginTop: 10, color: colors.text.muted, fontWeight: "700" },
  });
}

