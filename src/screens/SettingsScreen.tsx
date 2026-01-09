import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import { getJson, setJson } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { useAuth } from "../state/AuthProvider";
import { useIap } from "../purchases/IapProvider";
import { PRODUCTS } from "../purchases/products";
import { colors, shadows, borderRadius } from "../theme/colors";
import { disableDailyReminder, enableDailyReminder, getDailyReminderState } from "../lib/notifications";
import { RootStackParamList } from "../AppRoot";

type Prefs = {
  pushEnabled: boolean;
};

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export function SettingsScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const iap = useIap();
  const [prefs, setPrefs] = useState<Prefs>({ pushEnabled: false });
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [upgradeEmail, setUpgradeEmail] = useState("");
  const [upgradeCode, setUpgradeCode] = useState("");
  const [upgradeStep, setUpgradeStep] = useState<"idle" | "sent">("idle");

  useEffect(() => {
    getJson<Prefs>("wordcrack:prefs").then((v) => v && setPrefs(v));
    getDailyReminderState().then((s) => {
      setPrefs((p) => ({ ...p, pushEnabled: s.enabled }));
    });
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      const { data, error } = await supabase.from("profiles").select("invite_code").eq("user_id", user.id).maybeSingle();
      if (!mounted) return;
      if (error) return;
      setInviteCode(data?.invite_code ?? null);
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const togglePush = async (next: boolean) => {
    if (next) {
      const perm = await Notifications.getPermissionsAsync();
      if (perm.status !== "granted") {
        const req = await Notifications.requestPermissionsAsync();
        if (req.status !== "granted") {
          Alert.alert("Notifications disabled", "You can enable notifications later in system settings.");
          return;
        }
      }
      await enableDailyReminder();
    } else {
      await disableDailyReminder();
    }
    const updated = { ...prefs, pushEnabled: next };
    setPrefs(updated);
    await setJson("wordcrack:prefs", updated);
  };

  const isAnonymous = Boolean((user as any)?.is_anonymous);
  const entitlementLabel = useMemo(() => {
    if (iap.loading) return "Checking…";
    if (!iap.premium) return "Free";
    return "WordCrack Premium";
  }, [iap.loading, iap.premium]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Profile Section */}
      {!isAnonymous ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>🪪</Text>
            <Text style={styles.cardTitle}>Profile</Text>
          </View>
          <Text style={styles.cardDescription}>
            Set your username and profile picture for leaderboards.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.navigate("ProfileSetup")}
            style={({ pressed }) => [
              styles.actionButton,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.actionButtonText}>Edit Profile</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Friends Section */}
      {!isAnonymous ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>👥</Text>
            <Text style={styles.cardTitle}>Friends</Text>
          </View>
          <Text style={styles.cardDescription}>
            Share your invite code so friends can add you.
          </Text>
          <View style={styles.inviteRow}>
            <View style={styles.inviteCodeBox}>
              <Text style={styles.inviteCode}>{inviteCode ?? "—"}</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (!inviteCode) return;
                void (async () => {
                  try {
                    const Share = require("react-native").Share;
                    await Share.share({ message: `Add me on WordCrack! My code: ${inviteCode}` });
                  } catch {
                    Alert.alert("Share failed");
                  }
                })();
              }}
              style={({ pressed }) => [
                styles.shareButton,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.shareButtonText}>Share</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Notifications Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>🔔</Text>
          <Text style={styles.cardTitle}>Notifications</Text>
        </View>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Daily reminder</Text>
          <Switch
            value={prefs.pushEnabled}
            onValueChange={togglePush}
            trackColor={{ false: colors.ui.border, true: colors.primary.blue }}
            thumbColor={colors.background.card}
          />
        </View>
        <Text style={styles.settingHint}>
          Get notified when the daily puzzle is available.
        </Text>
      </View>

      {/* Account Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>👤</Text>
          <Text style={styles.cardTitle}>Account</Text>
        </View>
        {isAnonymous ? (
          <>
            <Text style={styles.cardDescription}>
              You’re playing as a guest. Upgrade to keep your progress across devices.
            </Text>
            <View style={{ gap: 10 }}>
              <TextInput
                placeholder="Email address"
                autoCapitalize="none"
                keyboardType="email-address"
                value={upgradeEmail}
                onChangeText={setUpgradeEmail}
                style={styles.input}
              />
              {upgradeStep === "sent" ? (
                <TextInput
                  placeholder="OTP code"
                  keyboardType="number-pad"
                  value={upgradeCode}
                  onChangeText={setUpgradeCode}
                  style={styles.input}
                />
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  try {
                    const email = upgradeEmail.trim();
                    if (!email) return;
                    if (upgradeStep === "idle") {
                      // Best-effort upgrade: attach email then send OTP.
                      await supabase.auth.updateUser({ email });
                      const { error } = await supabase.auth.signInWithOtp({ email });
                      if (error) throw error;
                      setUpgradeStep("sent");
                      Alert.alert("Check your email", "Enter the code to complete account upgrade.");
                    } else {
                      const { error } = await supabase.auth.verifyOtp({ email, token: upgradeCode.trim(), type: "email" });
                      if (error) throw error;
                      setUpgradeStep("idle");
                      setUpgradeCode("");
                      Alert.alert("Upgraded!", "Your guest account is now linked to your email.");
                    }
                  } catch (e: any) {
                    Alert.alert("Upgrade failed", e?.message ?? "Unknown error");
                  }
                }}
                style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.9 }]}
              >
                <Text style={styles.actionButtonText}>
                  {upgradeStep === "idle" ? "Send Upgrade Code" : "Verify & Upgrade"}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.cardDescription}>Signed in.</Text>
        )}
      </View>

      {/* Premium Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>⭐</Text>
          <Text style={styles.cardTitle}>Upgrade to WordCrack Premium</Text>
        </View>
        <Text style={{ color: colors.text.secondary, marginBottom: 8 }}>Status: {entitlementLabel}</Text>
        <Text style={styles.cardDescription}>
          Unlock unlimited practice puzzles, advanced stats, and more!
        </Text>
        <View style={styles.premiumButtons}>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              try {
                navigation.navigate("Paywall");
              } catch (e: any) {
                Alert.alert("Purchase failed", e?.message ?? "Unknown error");
              }
            }}
            style={({ pressed }) => [
              styles.premiumButton,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.premiumButtonText}>Upgrade</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              try {
                await iap.restore();
                Alert.alert("Restored", "Your purchases have been synced.");
              } catch (e: any) {
                Alert.alert("Restore failed", e?.message ?? "Unknown error");
              }
            }}
            style={({ pressed }) => [
              styles.restoreButton,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.restoreButtonText}>Restore Purchases</Text>
          </Pressable>
        </View>
      </View>

      {/* Legal Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>📄</Text>
          <Text style={styles.cardTitle}>Legal</Text>
        </View>
        <View style={styles.legalLinks}>
          <Pressable
            style={styles.legalLink}
            onPress={() => navigation.navigate("Legal", { doc: "privacy" })}
          >
            <Text style={styles.legalLinkText}>Privacy Policy</Text>
          </Pressable>
          <Pressable
            style={styles.legalLink}
            onPress={() => navigation.navigate("Legal", { doc: "terms" })}
          >
            <Text style={styles.legalLinkText}>Terms of Service</Text>
          </Pressable>
        </View>
      </View>

      {/* Sign out */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>🚪</Text>
          <Text style={styles.cardTitle}>Sign out</Text>
        </View>
        <Text style={styles.cardDescription}>
          You can sign back in anytime.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            Alert.alert("Sign out?", "Are you sure you want to sign out?", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign Out", style: "destructive", onPress: () => void signOut() },
            ]);
          }}
          style={({ pressed }) => [
            styles.signOutButton,
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </Pressable>
      </View>

      <Text style={styles.version}>WordCrack v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.main,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 20,
    marginBottom: 16,
    ...shadows.small,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cardIcon: {
    fontSize: 24,
    marginRight: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text.primary,
  },
  cardDescription: {
    color: colors.text.secondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  inviteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  inviteCodeBox: {
    flex: 1,
    backgroundColor: colors.background.main,
    borderRadius: borderRadius.medium,
    padding: 14,
    alignItems: "center",
  },
  inviteCode: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary.darkBlue,
    letterSpacing: 2,
  },
  shareButton: {
    backgroundColor: colors.primary.blue,
    borderRadius: borderRadius.medium,
    paddingVertical: 14,
    paddingHorizontal: 20,
    ...shadows.small,
  },
  shareButtonText: {
    color: colors.text.light,
    fontWeight: "700",
    fontSize: 15,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  settingLabel: {
    fontSize: 16,
    color: colors.text.primary,
  },
  settingHint: {
    color: colors.text.muted,
    fontSize: 12,
  },
  actionButton: {
    backgroundColor: colors.background.main,
    borderRadius: borderRadius.medium,
    padding: 14,
    alignItems: "center",
  },
  actionButtonText: {
    color: colors.primary.blue,
    fontWeight: "700",
    fontSize: 15,
  },
  input: {
    backgroundColor: colors.background.main,
    borderRadius: borderRadius.medium,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.ui.border,
    color: colors.text.primary,
  },
  premiumButtons: {
    gap: 10,
  },
  premiumButton: {
    backgroundColor: colors.primary.yellow,
    borderRadius: borderRadius.medium,
    padding: 16,
    alignItems: "center",
    ...shadows.small,
  },
  premiumButtonText: {
    color: colors.primary.darkBlue,
    fontWeight: "800",
    fontSize: 16,
  },
  restoreButton: {
    backgroundColor: colors.background.main,
    borderRadius: borderRadius.medium,
    padding: 14,
    alignItems: "center",
  },
  restoreButtonText: {
    color: colors.text.secondary,
    fontWeight: "600",
    fontSize: 14,
  },
  legalLinks: {
    gap: 8,
  },
  legalLink: {
    padding: 12,
    backgroundColor: colors.background.main,
    borderRadius: borderRadius.medium,
  },
  legalLinkText: {
    color: colors.primary.blue,
    fontSize: 14,
    fontWeight: "600",
  },
  signOutButton: {
    backgroundColor: "rgba(220, 38, 38, 0.12)",
    borderRadius: borderRadius.medium,
    padding: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(220, 38, 38, 0.35)",
  },
  signOutButtonText: {
    color: "#dc2626",
    fontWeight: "900",
    fontSize: 15,
  },
  version: {
    textAlign: "center",
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 8,
  },
});
