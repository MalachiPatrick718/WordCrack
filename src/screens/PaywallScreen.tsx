import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../AppRoot";
import { useIap } from "../purchases/IapProvider";
import { PRODUCTS } from "../purchases/products";
import { useTheme } from "../theme/theme";
import { useAuth } from "../state/AuthProvider";

type Props = NativeStackScreenProps<RootStackParamList, "Paywall">;

export function PaywallScreen({ navigation }: Props) {
  const iap = useIap();
  const { user, signOut } = useAuth();
  const { colors, shadows, borderRadius } = useTheme();
  const { width } = useWindowDimensions();
  const isTabletLike = width >= 768;
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius, isTabletLike), [colors, shadows, borderRadius, isTabletLike]);
  const [selected, setSelected] = useState<"annual" | "monthly">("annual");
  const isAnonymous = Boolean((user as any)?.is_anonymous) || (user as any)?.app_metadata?.provider === "anonymous";
  const [showSuccess, setShowSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState<string>("Opening payment…");
  const [didAutoReload, setDidAutoReload] = useState(false);

  const annual = iap.products[PRODUCTS.premium_annual];
  const monthly = iap.products[PRODUCTS.premium_monthly];
  const storeHasMonthly = Boolean(monthly?.localizedPrice || monthly?.title || monthly?.priceNumber);
  const storeHasAnnual = Boolean(annual?.localizedPrice || annual?.title || annual?.priceNumber);
  const usingFallbackPrices = !(storeHasMonthly && storeHasAnnual);
  const storeDebugLine = useMemo(() => {
    const d = iap.productsDebug;
    if (!usingFallbackPrices) return `Store pricing loaded from Apple (${d.lastCount} products)`;
    const base = `Store pricing not loaded (showing fallback) (${d.lastCount} products)`;
    if (!d.lastLoadError) return base;
    return `${base} — ${d.lastLoadError}`;
  }, [iap.productsDebug, usingFallbackPrices]);

  useEffect(() => {
    // If StoreKit product metadata hasn't loaded yet, try one automatic reload.
    // This helps avoid confusing "SKU not found" failures due to transient StoreKit/propagation issues.
    if (Platform.OS !== "ios") return;
    if (didAutoReload) return;
    if (!usingFallbackPrices) return;
    setDidAutoReload(true);
    const t = setTimeout(() => {
      void iap.reloadProducts().catch(() => undefined);
    }, 800);
    return () => clearTimeout(t);
  }, [didAutoReload, usingFallbackPrices, iap]);

  // If store pricing hasn't loaded yet, show your configured USD defaults so the UI isn't blank.
  // Once IAP product info is available, we use localized store pricing automatically.
  const monthlyPriceFallback = "$2.99";
  const annualPriceFallback = "$29.99";
  const monthlyPrice = monthly?.localizedPrice ?? monthlyPriceFallback;
  const annualPrice = annual?.localizedPrice ?? annualPriceFallback;
  const appleEulaUrl = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";

  const currencyMark = useMemo(() => {
    const fromAnnual = (annual?.localizedPrice ?? "").replace(/[0-9.,\s]/g, "").trim();
    const fromMonthly = (monthly?.localizedPrice ?? "").replace(/[0-9.,\s]/g, "").trim();
    return fromAnnual || fromMonthly || "$";
  }, [annual?.localizedPrice, monthly?.localizedPrice]);

  const annualPerMonth = useMemo(() => {
    const a = Number.isFinite(Number(annual?.priceNumber)) ? Number(annual?.priceNumber) : 29.99;
    if (!Number.isFinite(a) || a <= 0) return null;
    return Math.round((a / 12) * 100) / 100;
  }, [annual?.priceNumber]);

  const savePct = useMemo(() => {
    const a = Number.isFinite(Number(annual?.priceNumber)) ? Number(annual?.priceNumber) : 29.99;
    const m = Number.isFinite(Number(monthly?.priceNumber)) ? Number(monthly?.priceNumber) : 2.99;
    if (!Number.isFinite(a) || !Number.isFinite(m) || a <= 0 || m <= 0) return null;
    const yearlyAtMonthly = m * 12;
    const pct = Math.round(((yearlyAtMonthly - a) / yearlyAtMonthly) * 100);
    return pct > 0 && pct < 95 ? pct : null;
  }, [annual?.priceNumber, monthly?.priceNumber]);

  const ctaProduct = selected === "annual" ? PRODUCTS.premium_annual : PRODUCTS.premium_monthly;
  const ctaLabel = selected === "annual" ? "Start MindShiftz Premium Annual" : "Start MindShiftz Premium Monthly";
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!processing) return;
    const timeout = setTimeout(() => {
      // Avoid an indefinite spinner if StoreKit never calls back or validation hangs.
      setProcessing(false);
      setBusy(false);
      Alert.alert(
        "Still finalizing…",
        "This is taking longer than expected. Please try “Restore Purchases”. If it still doesn’t activate, ensure you’re on a stable connection and try again.",
      );
    }, 35_000);

    // Only show success once Premium is actually active.
    if (iap.premium) {
      setProcessing(false);
      setBusy(false);
      setShowSuccess(true);
      clearTimeout(timeout);
      return;
    }
    // If validation failed server-side, surface the actual error.
    if (iap.lastPurchaseError) {
      setProcessing(false);
      setBusy(false);
      Alert.alert(
        "Purchase not activated",
        `${iap.lastPurchaseError}\n\nIf you already completed the purchase, try “Restore Purchases”.`,
      );
      iap.clearLastPurchaseError();
      clearTimeout(timeout);
    }
    return () => clearTimeout(timeout);
  }, [processing, iap.premium, iap.lastPurchaseError, navigation]);

  const buy = async () => {
    try {
      if (!user?.id) throw new Error("Not signed in");
      iap.clearLastPurchaseError();
      setBusyText(Platform.OS === "ios" ? "Opening App Store…" : "Opening Google Play…");
      setBusy(true);
      setProcessing(true);
      await iap.buy(ctaProduct, user.id);
      // iap.buy may resolve before server validation/premium refresh finishes.
      setBusyText("Finalizing your Premium…");
    } catch (e: any) {
      setProcessing(false);
      setBusy(false);
      Alert.alert(
        "Purchase failed",
        e?.message ??
          "Unknown error. If this keeps happening, confirm the Paid Apps Agreement is active in App Store Connect and try again.",
      );
    }
  };

  const restore = async () => {
    try {
      if (!user?.id) throw new Error("Not signed in");
      setBusyText("Restoring purchases…");
      setBusy(true);
      await iap.restore();
      setBusy(false);
      setShowSuccess(true);
    } catch (e: any) {
      setBusy(false);
      Alert.alert("Restore failed", e?.message ?? "Unknown error");
    }
  };

  return (
    <View style={styles.container}>
      {/* Busy overlay so the app never feels "frozen" while the store sheet is opening / validation runs */}
      <Modal
        visible={busy || processing}
        transparent
        animationType="fade"
        onRequestClose={() => undefined}
      >
        <View style={styles.busyOverlay}>
          <View style={styles.busyCard}>
            <ActivityIndicator size="large" color={colors.primary.yellow} />
            <Text style={styles.busyTitle}>{busyText}</Text>
            <Text style={styles.busySub}>One moment…</Text>
          </View>
        </View>
      </Modal>

      {/* Success modal */}
      <Modal
        visible={showSuccess}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccess(false)}
      >
        <Pressable style={styles.successOverlay} onPress={() => setShowSuccess(false)}>
          <Pressable style={styles.successCard} onPress={() => undefined}>
            <View style={styles.successEmojiCircle}>
              <Text style={styles.successEmoji}>🎉</Text>
            </View>
            <Text style={styles.successTitle}>Premium unlocked!</Text>
            <Text style={styles.successText}>You’re all set. Enjoy the full MindShiftz experience.</Text>

            <View style={styles.successBullets}>
              <Text style={styles.successBullet}>🧩 Unlimited practice puzzles</Text>
              <Text style={styles.successBullet}>🏆 Full leaderboards</Text>
              <Text style={styles.successBullet}>📈 Advanced stats</Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setShowSuccess(false);
                navigation.goBack();
              }}
              style={({ pressed }) => [styles.successButton, pressed && { opacity: 0.92 }]}
            >
              <Text style={styles.successButtonText}>Let’s go!</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.topTitle}>MindShiftz Premium</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.inner}>
        <View style={styles.hero}>
          <View style={styles.heroGlowA} />
          <View style={styles.heroGlowB} />
          <View style={styles.heroPillRow}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>⭐ MindShiftz Premium</Text>
            </View>
            {savePct ? (
              <View style={styles.heroPillAlt}>
                <Text style={styles.heroPillAltText}>Save {savePct}% yearly</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.heroTitle}>Upgrade to Premium</Text>
          <Text style={styles.heroSubtitle}>Unlimited practice + full leaderboards + advanced stats</Text>

          {isAnonymous ? (
            <View style={styles.heroGuestRow}>
              <Text style={styles.heroGuestText}>Playing as Guest</Text>
              <Text style={styles.heroGuestTextMuted}>Subscribe now. Create an account later to sync across devices.</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void signOut()}
                style={({ pressed }) => [styles.heroGuestButton, pressed && { opacity: 0.92 }]}
              >
                <Text style={styles.heroGuestButtonText}>Create account (optional)</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.heroTrustRow}>
              <Text style={styles.heroTrustText}>🔒 Secure checkout • Cancel anytime</Text>
            </View>
          )}
        </View>

        <View style={styles.featuresCard}>
          <Text style={styles.sectionTitle}>Unlock with Premium</Text>

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
            <Text style={styles.featureIcon}>🤝</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Friends Leaderboards</Text>
              <Text style={styles.featureSubtitle}>Compare times with friends using invite codes</Text>
            </View>
          </View>
          <View style={styles.divider} />

          <View style={styles.featureRow}>
            <Text style={styles.featureIcon}>⭐</Text>
            <View style={styles.featureText}>
              <Text style={styles.featureTitle}>Premium Badge</Text>
              <Text style={styles.featureSubtitle}>Show a Premium badge on leaderboards</Text>
            </View>
          </View>
        </View>

        <View style={styles.planSection}>
          <View style={styles.planHeader}>
            <Text style={styles.sectionTitle}>Choose Your Plan</Text>
            <View style={styles.cancelPill}>
              <Text style={styles.cancelPillText}>Cancel anytime</Text>
            </View>
          </View>
          <Text style={[styles.storeStatus, usingFallbackPrices && styles.storeStatusWarn]}>
            {storeDebugLine}
          </Text>

          <View style={styles.planRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setSelected("monthly")}
              style={({ pressed }) => [
                styles.planCard,
                selected === "monthly" && styles.planCardSelected,
                pressed && { opacity: 0.96 },
              ]}
            >
              <View style={styles.planRadioRow}>
                <View style={[styles.radioOuter, selected === "monthly" && styles.radioOuterSelected]}>
                  {selected === "monthly" ? <View style={styles.radioInner} /> : null}
                </View>
                <Text style={styles.planName}>Monthly</Text>
              </View>
              <Text style={styles.planBigPrice} numberOfLines={1} adjustsFontSizeToFit>{monthlyPrice}</Text>
              <Text style={styles.planSmallText}>per month</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={() => setSelected("annual")}
              style={({ pressed }) => [
                styles.planCard,
                selected === "annual" && styles.planCardSelected,
                pressed && { opacity: 0.96 },
              ]}
            >
              {savePct ? (
                <View style={styles.savePillTop}>
                  <Text style={styles.savePillTopText}>Save {savePct}%</Text>
                </View>
              ) : null}
              <View style={styles.planRadioRow}>
                <View style={[styles.radioOuter, selected === "annual" && styles.radioOuterSelected]}>
                  {selected === "annual" ? <View style={styles.radioInner} /> : null}
                </View>
                <Text style={styles.planName}>Annual</Text>
              </View>
              <Text style={styles.planBigPrice} numberOfLines={1} adjustsFontSizeToFit>{annualPrice}</Text>
              <Text style={styles.planSmallText}>per year</Text>
              {annualPerMonth != null ? (
                <Text style={styles.planAccent}>{currencyMark}{annualPerMonth.toFixed(2)}/month</Text>
              ) : null}
            </Pressable>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={processing}
            onPress={buy}
            style={({ pressed }) => [
              styles.cta,
              processing && { opacity: 0.6 },
              pressed && { opacity: 0.96 },
            ]}
          >
            <Text style={styles.ctaText}>{processing ? "Starting Premium…" : ctaLabel}</Text>
          </Pressable>

          <Pressable accessibilityRole="button" disabled={processing} onPress={restore} style={styles.restoreLink}>
            <Text style={styles.restoreLinkText}>Restore Purchases</Text>
          </Pressable>

          {usingFallbackPrices ? (
            <Pressable
              accessibilityRole="button"
              disabled={processing}
              onPress={async () => {
                try {
                  setBusyText("Loading store pricing…");
                  setBusy(true);
                  await iap.reloadProducts();
                  Alert.alert(
                    "Store products",
                    `Loaded ${iap.productsDebug.lastCount} products.\n\nMonthly: ${Boolean(iap.products[PRODUCTS.premium_monthly])}\nAnnual: ${Boolean(iap.products[PRODUCTS.premium_annual])}`,
                  );
                } catch (e: any) {
                  Alert.alert("Couldn’t load pricing", e?.message ?? "Unknown error");
                } finally {
                  setBusy(false);
                }
              }}
              style={styles.reloadLink}
            >
              <Text style={styles.reloadLinkText}>Having trouble? Tap to reload pricing</Text>
            </Pressable>
          ) : null}

          <Text style={styles.finePrint}>
            Payment will be charged to your {Platform.OS === "ios" ? "App Store" : "Google Play"} account at confirmation. Subscriptions automatically renew unless canceled at least 24 hours before the end of the current period.
          </Text>
          <Text style={styles.finePrint}>
            You can manage or cancel your subscription in your {Platform.OS === "ios" ? "App Store" : "Google Play"} account settings.
          </Text>

          <View style={styles.legalRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void Linking.openURL(appleEulaUrl).catch(() => undefined)}
            >
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

        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors: any, shadows: any, borderRadius: any, isTabletLike: boolean) => StyleSheet.create({
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
  content: { padding: 16, paddingBottom: isTabletLike ? 40 : 28, gap: 14 },
  inner: {
    width: "100%",
    maxWidth: isTabletLike ? 560 : 520,
    alignSelf: "center",
    gap: 14,
  },

  hero: {
    backgroundColor: colors.primary.darkBlue,
    borderRadius: borderRadius.xl,
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: "center",
    ...shadows.medium,
    overflow: "hidden",
  },
  heroGlowA: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(250, 204, 21, 0.18)",
    top: -120,
    left: -120,
  },
  heroGlowB: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: "rgba(59, 130, 246, 0.20)",
    bottom: -160,
    right: -160,
  },
  heroPillRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginBottom: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  heroPill: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  heroPillText: { color: colors.text.light, fontWeight: "900" },
  heroPillAlt: {
    backgroundColor: "rgba(38, 222, 129, 0.92)",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  heroPillAltText: { color: "#053B22", fontWeight: "900" },
  heroTitle: { color: colors.text.light, fontSize: isTabletLike ? 30 : 34, fontWeight: "900", textAlign: "center" },
  heroSubtitle: {
    color: "rgba(255,255,255,0.82)",
    marginTop: 8,
    fontSize: 15,
    textAlign: "center",
    lineHeight: 20,
  },
  heroTrustRow: {
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.22)",
  },
  heroTrustText: { color: "rgba(255,255,255,0.88)", fontWeight: "800" },
  heroGuestRow: { marginTop: 14, alignItems: "center", gap: 8 },
  heroGuestText: { color: colors.text.light, fontWeight: "900" },
  heroGuestTextMuted: { color: "rgba(255,255,255,0.80)", fontWeight: "700" },
  heroGuestButton: {
    marginTop: 4,
    backgroundColor: colors.primary.yellow,
    borderRadius: borderRadius.large,
    paddingVertical: 12,
    paddingHorizontal: 16,
    ...shadows.small,
  },
  heroGuestButtonText: { color: colors.primary.darkBlue, fontWeight: "900", fontSize: 16 },

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
  planHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  storeStatus: { marginTop: 6, marginBottom: 10, color: colors.text.secondary, fontWeight: "700", fontSize: 12 },
  storeStatusWarn: { color: colors.primary.orange },
  cancelPill: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.ui.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  cancelPillText: { color: colors.text.secondary, fontWeight: "800", fontSize: 12 },
  planCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: colors.ui.border,
    borderRadius: borderRadius.large,
    paddingVertical: 18,
    paddingHorizontal: 16,
    // Contrast correctly in both light/dark themes
    backgroundColor: colors.background.main,
    position: "relative",
  },
  planRadioRow: { flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.ui.border,
    alignItems: "center",
    justifyContent: "center",
  },
  radioOuterSelected: { borderColor: colors.primary.yellow },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary.yellow },
  planCardSelected: {
    borderColor: colors.primary.yellow,
    backgroundColor: colors.background.card,
    shadowColor: colors.ui.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  planRow: { flexDirection: "row", gap: 12 },
  planName: { color: colors.text.secondary, fontWeight: "800", fontSize: 16, textAlign: "center" },
  planBigPrice: { color: colors.text.primary, fontWeight: "900", fontSize: 34, textAlign: "center", marginTop: 6 },
  planSmallText: { color: colors.text.muted, fontWeight: "700", fontSize: 14, textAlign: "center", marginTop: 2 },
  planAccent: { color: "rgba(38, 222, 129, 0.95)", fontWeight: "900", fontSize: 16, textAlign: "center", marginTop: 10 },
  savePillTop: {
    position: "absolute",
    top: -12,
    left: 0,
    right: 0,
    alignSelf: "center",
    marginHorizontal: 28,
    backgroundColor: "rgba(38, 222, 129, 0.95)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: "center",
  },
  savePillTopText: { color: "#053B22", fontWeight: "900", fontSize: 13 },

  cta: {
    marginTop: 14,
    backgroundColor: colors.primary.orange,
    borderRadius: borderRadius.large,
    paddingVertical: 16,
    alignItems: "center",
    ...shadows.small,
  },
  ctaText: { color: "#fff", fontWeight: "900", fontSize: 18 },
  ctaSubText: { marginTop: 6, color: "rgba(255,255,255,0.82)", fontWeight: "700", fontSize: 12, textAlign: "center" },
  restoreLink: { alignItems: "center", paddingVertical: 10 },
  restoreLinkText: { color: colors.text.secondary, fontWeight: "700" },
  reloadLink: { alignItems: "center", paddingVertical: 6 },
  reloadLinkText: { color: colors.primary.blue, fontWeight: "800" },
  finePrint: { color: colors.text.muted, fontSize: 12, lineHeight: 18, textAlign: "center" },
  legalRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 10, flexWrap: "wrap", gap: 8 },
  legalLink: { color: colors.primary.blue, fontWeight: "800" },
  legalDot: { color: colors.text.muted },

  busyOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  busyCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 18,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(250, 204, 21, 0.35)",
    ...shadows.large,
  },
  busyTitle: { marginTop: 12, fontSize: 16, fontWeight: "900", color: colors.text.primary, textAlign: "center" },
  busySub: { marginTop: 6, color: colors.text.secondary, fontWeight: "700" },

  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  successCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 20,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(250, 204, 21, 0.35)",
    ...shadows.large,
  },
  successEmojiCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: "rgba(250, 204, 21, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  successEmoji: { fontSize: 42 },
  successTitle: { fontSize: 22, fontWeight: "900", color: colors.text.primary, textAlign: "center" },
  successText: { marginTop: 8, color: colors.text.secondary, textAlign: "center", lineHeight: 20 },
  successBullets: {
    marginTop: 14,
    width: "100%",
    gap: 10,
    padding: 14,
    borderRadius: borderRadius.large,
    backgroundColor: colors.background.main,
    borderWidth: 1,
    borderColor: colors.ui.border,
  },
  successBullet: { color: colors.text.secondary, fontWeight: "800" },
  successButton: {
    marginTop: 16,
    width: "100%",
    backgroundColor: colors.primary.yellow,
    borderRadius: borderRadius.large,
    paddingVertical: 14,
    alignItems: "center",
    ...shadows.small,
  },
  successButtonText: { color: colors.primary.darkBlue, fontWeight: "900", fontSize: 16 },

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

