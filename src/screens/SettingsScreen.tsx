import React, { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Modal, Pressable, ScrollView, Switch, Text, TextInput, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import { getJson, setJson } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { useAuth } from "../state/AuthProvider";
import { useIap } from "../purchases/IapProvider";
import { PRODUCTS } from "../purchases/products";
import { useTheme, type ThemePreference } from "../theme/theme";
import { disableDailyReminder, enableDailyReminder, getDailyReminderState, sendTestNewPuzzleNotification } from "../lib/notifications";
import { deleteAccount, submitFeedback } from "../lib/api";
import { RootStackParamList } from "../AppRoot";

type Prefs = {
  pushEnabled: boolean;
};

type Props = NativeStackScreenProps<RootStackParamList, "Settings">;

export function SettingsScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const iap = useIap();
  const { colors, shadows, borderRadius, preference, setPreference } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  const [prefs, setPrefs] = useState<Prefs>({ pushEnabled: false });
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
    // Optimistic UI so the switch doesn't feel "stuck".
    const prevPrefs = prefs;
    const optimistic = { ...prefs, pushEnabled: next };
    setPrefs(optimistic);

    try {
      if (next) {
        // Always request when toggling on so the OS "Allow Notifications?" prompt appears the first time.
        const req = await Notifications.requestPermissionsAsync();
        const granted = (req as any)?.granted === true || req.status === "granted";
        if (!granted) {
          setPrefs(prevPrefs);
          Alert.alert(
            "Enable notifications",
            "To turn on hourly reminders, allow notifications for WordCrack. If you previously denied it, enable it in system settings.",
            [
              { text: "Not now", style: "cancel" },
              { text: "Open Settings", onPress: () => void Linking.openSettings().catch(() => undefined) },
            ],
          );
          return;
        }
        await enableDailyReminder();
      } else {
        await disableDailyReminder();
      }

      await setJson("wordcrack:prefs", optimistic);
    } catch (e: any) {
      setPrefs(prevPrefs);
      Alert.alert("Couldn't update reminders", e?.message ?? "Unknown error");
    }
  };

  const isAnonymous = Boolean((user as any)?.is_anonymous);
  const entitlementLabel = useMemo(() => {
    if (iap.loading) return "Checking…";
    if (!iap.premium) return "Free";
    return "WordCrack Premium";
  }, [iap.loading, iap.premium]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Theme */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>🎨</Text>
          <Text style={styles.cardTitle}>Theme</Text>
        </View>
        <Text style={styles.cardDescription}>Choose Light, Dark, or follow your device setting.</Text>
        <View style={styles.themeRow}>
          {(["system", "light", "dark"] as ThemePreference[]).map((opt) => {
            const active = preference === opt;
            return (
              <Pressable
                key={opt}
                accessibilityRole="button"
                onPress={() => setPreference(opt)}
                style={({ pressed }) => [
                  styles.themePill,
                  active && styles.themePillActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Text style={[styles.themePillText, active && styles.themePillTextActive]}>
                  {opt === "system" ? "System" : opt === "light" ? "Light" : "Dark"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

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

      {/* Friends Section (Premium only) */}
      {!isAnonymous && iap.premium ? (
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
          <Text style={styles.settingLabel}>Hourly reminders</Text>
          <Switch
            value={prefs.pushEnabled}
            onValueChange={togglePush}
            trackColor={{ false: colors.ui.border, true: colors.primary.blue }}
            thumbColor={colors.background.card}
          />
        </View>
        <Text style={styles.settingHint}>
          Get notified when a new puzzle is available.
        </Text>
      </View>

      {/* Feedback Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>📝</Text>
          <Text style={styles.cardTitle}>Feedback</Text>
        </View>
        <Text style={styles.cardDescription}>
          Send feedback, bugs, or feature requests. This goes straight to the WordCrack team.
        </Text>
        <TextInput
          multiline
          placeholder="What should we improve?"
          placeholderTextColor={colors.text.muted}
          value={feedback}
          onChangeText={setFeedback}
          style={[styles.input, { minHeight: 110, textAlignVertical: "top" }]}
        />
        <Pressable
          accessibilityRole="button"
          disabled={sendingFeedback || !user || !feedback.trim()}
          onPress={async () => {
            try {
              if (!user) return;
              const msg = feedback.trim();
              if (!msg) return;
              setSendingFeedback(true);
              await submitFeedback({
                message: msg,
                category: "app",
                context: {
                  screen: "Settings",
                  is_anonymous: Boolean((user as any)?.is_anonymous),
                  platform: require("react-native").Platform.OS,
                },
              });
              setFeedback("");
              Alert.alert("Thanks!", "Feedback sent.");
            } catch (e: any) {
              Alert.alert("Couldn't send feedback", e?.message ?? "Unknown error");
            } finally {
              setSendingFeedback(false);
            }
          }}
          style={({ pressed }) => [
            styles.actionButton,
            { marginTop: 12 },
            (sendingFeedback || !user || !feedback.trim()) && { opacity: 0.5 },
            pressed && !sendingFeedback && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.actionButtonText}>{sendingFeedback ? "Sending..." : "Send feedback"}</Text>
        </Pressable>
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
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate("UpgradeAccount", { postUpgradeTo: "Back" })}
              style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.actionButtonText}>Create account</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.cardDescription}>Signed in.</Text>
        )}
      </View>

      {/* Premium Section */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>⭐</Text>
          <Text style={styles.cardTitle}>{iap.premium ? "WordCrack Premium" : "Upgrade to WordCrack Premium"}</Text>
        </View>
        <Text style={{ color: colors.text.secondary, marginBottom: 8 }}>Status: {entitlementLabel}</Text>
        <Text style={styles.cardDescription}>
          {iap.premium
            ? "You have full access to premium features."
            : "Unlock unlimited practice puzzles, advanced stats, and more!"}
        </Text>
        <View style={styles.premiumButtons}>
          {!iap.premium ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowComingSoon(true)}
              style={({ pressed }) => [
                styles.premiumButton,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.premiumButtonText}>Upgrade</Text>
            </Pressable>
          ) : null}
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

      {/* Delete Account */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardIcon}>🗑️</Text>
          <Text style={styles.cardTitle}>Delete Account</Text>
        </View>
        <Text style={styles.cardDescription}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </Text>
        <Pressable
          accessibilityRole="button"
          disabled={deleting}
          onPress={() => {
            Alert.alert(
              "Delete Account?",
              "This will permanently delete your account, profile, stats, and all game data. This action cannot be undone.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete Forever",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      setDeleting(true);
                      await deleteAccount();
                      Alert.alert("Account Deleted", "Your account has been permanently deleted.");
                    } catch (e: any) {
                      Alert.alert("Delete failed", e?.message ?? "Unknown error");
                      setDeleting(false);
                    }
                  },
                },
              ],
            );
          }}
          style={({ pressed }) => [
            styles.deleteButton,
            deleting && { opacity: 0.5 },
            pressed && !deleting && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.deleteButtonText}>{deleting ? "Deleting..." : "Delete My Account"}</Text>
        </Pressable>
      </View>

      <Text style={styles.version}>WordCrack v1.0.0</Text>

      {/* Coming Soon Modal */}
      <Modal
        visible={showComingSoon}
        transparent
        animationType="fade"
        onRequestClose={() => setShowComingSoon(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconContainer}>
              <Text style={styles.modalIcon}>🚀</Text>
            </View>
            <Text style={styles.modalTitle}>Coming Soon!</Text>
            <Text style={styles.modalDescription}>
              WordCrack Premium is launching soon with amazing features:
            </Text>
            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Text style={styles.featureEmoji}>🧩</Text>
                <Text style={styles.featureText}>Unlimited practice puzzles</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureEmoji}>👥</Text>
                <Text style={styles.featureText}>Friends leaderboards</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureEmoji}>📊</Text>
                <Text style={styles.featureText}>Advanced statistics</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureEmoji}>🎯</Text>
                <Text style={styles.featureText}>Exclusive puzzle themes</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureEmoji}>🏆</Text>
                <Text style={styles.featureText}>Premium profile badges</Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setShowComingSoon(false)}
              style={({ pressed }) => [
                styles.modalButton,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.modalButtonText}>Got it!</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (colors: any, shadows: any, borderRadius: any) => StyleSheet.create({
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
  themeRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  themePill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.round,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background.main,
    borderWidth: 1,
    borderColor: colors.ui.border,
  },
  themePillActive: {
    backgroundColor: colors.primary.blue,
    borderColor: colors.primary.blue,
  },
  themePillText: {
    fontWeight: "800",
    color: colors.text.primary,
  },
  themePillTextActive: {
    color: colors.text.light,
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
  deleteButton: {
    backgroundColor: "#dc2626",
    borderRadius: borderRadius.medium,
    padding: 14,
    alignItems: "center",
    ...shadows.small,
  },
  deleteButtonText: {
    color: colors.text.light,
    fontWeight: "900",
    fontSize: 15,
  },
  version: {
    textAlign: "center",
    color: colors.text.muted,
    fontSize: 12,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    ...shadows.large,
  },
  modalIconContainer: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.primary.yellow + "20",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalIcon: {
    fontSize: 48,
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: colors.primary.yellow,
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 15,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  featuresList: {
    width: "100%",
    gap: 12,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  featureEmoji: {
    fontSize: 20,
  },
  featureText: {
    fontSize: 15,
    color: colors.text.primary,
    fontWeight: "600",
  },
  modalButton: {
    backgroundColor: colors.primary.yellow,
    borderRadius: borderRadius.large,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: "100%",
    alignItems: "center",
    ...shadows.small,
  },
  modalButtonText: {
    color: colors.primary.darkBlue,
    fontSize: 18,
    fontWeight: "800",
  },
});
