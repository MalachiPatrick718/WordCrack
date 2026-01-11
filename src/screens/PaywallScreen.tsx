import React, { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../AppRoot";
import { useIap } from "../purchases/IapProvider";
import { PRODUCTS } from "../purchases/products";
import { useTheme } from "../theme/theme";
import { useAuth } from "../state/AuthProvider";

type Props = NativeStackScreenProps<RootStackParamList, "Paywall">;

export function PaywallScreen({ navigation }: Props) {
  const iap = useIap();
  const { user } = useAuth();
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  const [selected, setSelected] = useState<"annual" | "monthly">("annual");
  const isAnonymous = Boolean((user as any)?.is_anonymous) || (user as any)?.app_metadata?.provider === "anonymous";

  const annual = iap.products[PRODUCTS.premium_annual];
  const monthly = iap.products[PRODUCTS.premium_monthly];

  const annualPrice = annual?.localizedPrice ?? "Annual";
  const monthlyPrice = monthly?.localizedPrice ?? "Monthly";

  const savePct = useMemo(() => {
    const a = Number(annual?.priceNumber);
    const m = Number(monthly?.priceNumber);
    if (!Number.isFinite(a) || !Number.isFinite(m) || a <= 0 || m <= 0) return null;
    const yearlyAtMonthly = m * 12;
    const pct = Math.round(((yearlyAtMonthly - a) / yearlyAtMonthly) * 100);
    return pct > 0 && pct < 95 ? pct : null;
  }, [annual?.priceNumber, monthly?.priceNumber]);

  const ctaProduct = selected === "annual" ? PRODUCTS.premium_annual : PRODUCTS.premium_monthly;
  const ctaLabel = selected === "annual" ? "Start WordCrack Premium Annual" : "Start WordCrack Premium Monthly";

  const buy = async () => {
    try {
      if (isAnonymous) {
        navigation.replace("UpgradeAccount", { postUpgradeTo: "Paywall" });
        return;
      }
      await iap.buy(ctaProduct);
      Alert.alert("Success", "WordCrack Premium is now active.");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Purchase failed", e?.message ?? "Unknown error");
    }
  };

  const restore = async () => {
    try {
      if (isAnonymous) {
        navigation.replace("UpgradeAccount", { postUpgradeTo: "Paywall" });
        return;
      }
      await iap.restore();
      Alert.alert("Restored", "Your purchases have been synced.");
      navigation.goBack();
    } catch (e: any) {
      Alert.alert("Restore failed", e?.message ?? "Unknown error");
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle}>WordCrack Premium</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isAnonymous ? (
          <View style={styles.guestGate}>
            <Text style={styles.guestGateTitle}>Create an account to subscribe</Text>
            <Text style={styles.guestGateText}>
              You’re currently playing as a guest. Create an account first, then you can start WordCrack Premium.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.replace("UpgradeAccount", { postUpgradeTo: "Paywall" })}
              style={({ pressed }) => [styles.guestGateButton, pressed && { opacity: 0.92 }]}
            >
              <Text style={styles.guestGateButtonText}>Create account</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.hero}>
          <Text style={styles.heroIcon}>⭐</Text>
          <Text style={styles.heroTitle}>Upgrade to WordCrack Premium</Text>
          <Text style={styles.heroSubtitle}>Unlock the full WordCrack experience</Text>
        </View>

        <View style={styles.featuresCard}>
          <Text style={styles.sectionTitle}>Unlock with WordCrack Premium</Text>

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>🧩</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Unlimited Practice</Text>
              <Text style={styles.featureSubtitle}>Play as many extra puzzles as you want</Text>
            </View>
          </View>
          <View style={styles.divider} />

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>🏆</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Full Leaderboards</Text>
              <Text style={styles.featureSubtitle}>Global + friends rankings</Text>
            </View>
          </View>
          <View style={styles.divider} />

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>📈</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Advanced Stats</Text>
              <Text style={styles.featureSubtitle}>Trends, averages, and more</Text>
            </View>
          </View>
          <View style={styles.divider} />

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>🎨</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Cosmetics</Text>
              <Text style={styles.featureSubtitle}>Exclusive avatars & themes</Text>
            </View>
          </View>
          <View style={styles.divider} />

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>🚫</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Ad‑free</Text>
              <Text style={styles.featureSubtitle}>No interruptions while cracking</Text>
            </View>
          </View>
        </View>

        <View style={styles.planSection}>
          <Text style={styles.sectionTitle}>Choose Your Plan</Text>

          <Pressable
            accessibilityRole="button"
            disabled={iap.loading}
            onPress={() => setSelected("annual")}
            style={({ pressed }) => [
              styles.planCard,
              selected === "annual" && styles.planCardSelected,
              pressed && { opacity: 0.96 },
            ]}
          >
            <View style={styles.planLeft}>
              <View style={[styles.radio, selected === "annual" && styles.radioOn]}>
                {selected === "annual" ? <Text style={styles.radioCheck}>✓</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.planTitleRow}>
                  <Text style={styles.planTitle}>Annual</Text>
                  {savePct ? (
                    <View style={styles.savePill}>
                      <Text style={styles.savePillText}>SAVE {savePct}%</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.planSub}>Best value • Billed annually</Text>
              </View>
            </View>
            <Text style={styles.planPrice}>{annualPrice}</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            disabled={iap.loading}
            onPress={() => setSelected("monthly")}
            style={({ pressed }) => [
              styles.planCard,
              selected === "monthly" && styles.planCardSelected,
              pressed && { opacity: 0.96 },
            ]}
          >
            <View style={styles.planLeft}>
              <View style={[styles.radio, selected === "monthly" && styles.radioOn]}>
                {selected === "monthly" ? <Text style={styles.radioCheck}>✓</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>Monthly</Text>
                <Text style={styles.planSub}>Flexible • Cancel anytime</Text>
              </View>
            </View>
            <Text style={styles.planPrice}>{monthlyPrice}</Text>
          </Pressable>

          <Pressable accessibilityRole="button" disabled={iap.loading} onPress={buy} style={({ pressed }) => [styles.cta, pressed && { opacity: 0.96 }]}>
            <Text style={styles.ctaText}>{ctaLabel}</Text>
          </Pressable>

          <Pressable accessibilityRole="button" disabled={iap.loading} onPress={restore} style={styles.restoreLink}>
            <Text style={styles.restoreLinkText}>Restore Purchases</Text>
          </Pressable>

          <Text style={styles.finePrint}>
            Payment will be charged to your App Store/Google Play account at confirmation. Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period.
          </Text>

          <View style={styles.legalRow}>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Legal", { doc: "terms" })}>
              <Text style={styles.legalLink}>Terms of Use (EULA)</Text>
            </Pressable>
            <Text style={styles.legalDot}>•</Text>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Legal", { doc: "terms" })}>
              <Text style={styles.legalLink}>Terms</Text>
            </Pressable>
            <Text style={styles.legalDot}>•</Text>
            <Pressable accessibilityRole="button" onPress={() => navigation.navigate("Legal", { doc: "privacy" })}>
              <Text style={styles.legalLink}>Privacy Policy</Text>
            </Pressable>
          </View>
        </View>

        {__DEV__ ? (
          <View style={styles.devCard}>
            <Text style={styles.devTitle}>Developer</Text>
            <Text style={styles.devText}>Force Premium on this device (testing only).</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void iap.setPremiumTestEnabled(!iap.premiumTestEnabled)}
              style={({ pressed }) => [
                styles.devButton,
                iap.premiumTestEnabled && styles.devButtonOn,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.devButtonText}>
                {iap.premiumTestEnabled ? "Disable Test Premium" : "Enable Test Premium"}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: any, shadows: any, borderRadius: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background.main },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  backText: { fontSize: 28, fontWeight: "900", color: colors.text.primary, marginTop: -2 },
  topTitle: { flex: 1, textAlign: "center", fontWeight: "900", color: colors.text.primary, fontSize: 16 },
  content: { padding: 16, paddingBottom: 28, gap: 14 },

  guestGate: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(26, 115, 232, 0.25)",
    ...shadows.small,
  },
  guestGateTitle: { fontSize: 16, fontWeight: "900", color: colors.text.primary, marginBottom: 6 },
  guestGateText: { color: colors.text.secondary, lineHeight: 20, marginBottom: 12 },
  guestGateButton: {
    backgroundColor: colors.primary.blue,
    borderRadius: borderRadius.large,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    ...shadows.small,
  },
  guestGateButtonText: { color: colors.text.light, fontWeight: "900", fontSize: 16 },

  hero: {
    backgroundColor: colors.primary.darkBlue,
    borderRadius: borderRadius.xl,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: "center",
    ...shadows.medium,
  },
  heroIcon: { fontSize: 44, marginBottom: 6 },
  heroTitle: { color: colors.text.light, fontSize: 30, fontWeight: "900", textAlign: "center" },
  heroSubtitle: { color: colors.primary.lightBlue, marginTop: 6, fontSize: 16, textAlign: "center" },

  featuresCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 18,
    ...shadows.small,
  },
  sectionTitle: { fontSize: 18, fontWeight: "900", color: colors.text.primary, marginBottom: 12 },
  featureRow: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 10 },
  featureIcon: { fontSize: 24, width: 28, textAlign: "center" },
  featureText: { flex: 1 },
  featureTitle: { fontWeight: "900", color: colors.text.primary, fontSize: 15 },
  featureSubtitle: { color: colors.text.secondary, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.ui.border },

  planSection: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 18,
    ...shadows.small,
  },
  planCard: {
    borderWidth: 2,
    borderColor: colors.ui.border,
    borderRadius: borderRadius.large,
    paddingVertical: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    backgroundColor: "#fff",
  },
  planCardSelected: {
    borderColor: colors.primary.orange,
    shadowColor: colors.ui.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  planLeft: { flexDirection: "row", gap: 12, alignItems: "center", flex: 1, paddingRight: 10 },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.ui.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOn: {
    borderColor: colors.primary.orange,
    backgroundColor: colors.primary.orange,
  },
  radioCheck: { color: "#fff", fontWeight: "900", fontSize: 14, marginTop: -1 },
  planTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 2 },
  planTitle: { fontSize: 20, fontWeight: "900", color: colors.text.primary },
  savePill: {
    backgroundColor: "rgba(38, 222, 129, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  savePillText: { color: "#1e7f4a", fontWeight: "900", fontSize: 12, letterSpacing: 0.2 },
  planSub: { color: colors.text.secondary },
  planPrice: { fontSize: 22, fontWeight: "900", color: colors.text.primary },

  cta: {
    marginTop: 4,
    backgroundColor: colors.primary.orange,
    borderRadius: borderRadius.large,
    paddingVertical: 16,
    alignItems: "center",
    ...shadows.small,
  },
  ctaText: { color: "#fff", fontWeight: "900", fontSize: 18 },
  restoreLink: { alignItems: "center", paddingVertical: 10 },
  restoreLinkText: { color: colors.text.secondary, fontWeight: "700" },
  finePrint: { color: colors.text.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  legalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 8 },
  legalLink: { color: colors.primary.blue, fontWeight: "800" },
  legalDot: { color: colors.text.muted },

  devCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(26, 115, 232, 0.25)",
  },
  devTitle: { fontWeight: "900", color: colors.primary.blue, marginBottom: 6 },
  devText: { color: colors.text.secondary, marginBottom: 12 },
  devButton: {
    backgroundColor: colors.background.main,
    borderRadius: borderRadius.large,
    padding: 14,
    alignItems: "center",
  },
  devButtonOn: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  devButtonText: { fontWeight: "900", color: colors.text.primary },
});

