import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../AppRoot";
import { useTheme } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "Legal">;

const PRIVACY = `
Privacy Policy

Effective date: 2026-01-09

MindShift (“we”, “us”) provides the MindShift mobile app.

Data we collect
- Account data: email (if you upgrade from guest), username, avatar (optional)
- Gameplay: puzzle attempts, timing, hint usage, streaks, and leaderboard stats
- Device data: basic diagnostics to improve reliability

How we use data
- Provide gameplay, leaderboards, and stats
- Prevent abuse and cheating
- Improve app performance and reliability

Sharing
- Leaderboards show your username/avatar and score metrics
- We do not sell personal data

Contact
- Support: support@mindshift.app
`;

const TERMS = `
Terms of Service

Effective date: 2026-01-09

By using MindShift you agree to these terms.

Subscriptions / Purchases
- Premium features may be sold via the App Store
- Purchases are subject to store terms and refund policies

Acceptable use
- Do not attempt to exploit, cheat, or disrupt the service

Disclaimer
- The app is provided “as is” without warranties

Contact
- Support: support@mindshift.app
`;

export function LegalScreen({ route }: Props) {
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  const doc = route.params.doc;
  const text = doc === "privacy" ? PRIVACY : TERMS;
  const title = doc === "privacy" ? "Privacy Policy" : "Terms of Service";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background.main }} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{text.trim()}</Text>
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: any, shadows: any, borderRadius: any) => StyleSheet.create({
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 18,
    ...shadows.small,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.primary.darkBlue,
    marginBottom: 12,
  },
  body: {
    color: colors.text.secondary,
    lineHeight: 20,
    fontSize: 14,
  },
});

