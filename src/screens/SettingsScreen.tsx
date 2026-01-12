import React, { useEffect, useMemo, useState } from "react";
import { Alert, Linking, Pressable, ScrollView, Switch, Text, TextInput, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as Notifications from "expo-notifications";
import { getJson, setJson } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { useAuth } from "../state/AuthProvider";
import { useIap } from "../purchases/IapProvider";
import { useTheme, type ThemePreference } from "../theme/theme";
import { disableDailyReminder, enableDailyReminder, getDailyReminderState, sendTestNewPuzzleNotification } from "../lib/notifications";
import { deleteAccount, getIapStatus, submitFeedback, type IapStatus } from "../lib/api";
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
  const [deleting, setDeleting] = useState(false);
  const [iapDebugEnabled, setIapDebugEnabled] = useState(false);
  const [debugTapCount, setDebugTapCount] = useState(0);
  const [iapStatus, setIapStatus] = useState<IapStatus | null>(null);
  const [iapStatusLoading, setIapStatusLoading] = useState(false);
  const [iapSyncing, setIapSyncing] = useState(false);
  const [iapLastSyncAt, setIapLastSyncAt] = useState<number | null>(null);

  useEffect(() => {
    getJson<Prefs>("wordcrack:prefs").then((v) => v && setPrefs(v));
    getDailyReminderState().then((s) => {
      setPrefs((p) => ({ ...p, pushEnabled: s.enabled }));
    });
    getJson<boolean>("wordcrack:iapDebug").then((v) => setIapDebugEnabled(Boolean(v)));
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
  const showIapDebug = (__DEV__ || iapDebugEnabled) && !isAnonymous;
  const entitlementLabel = useMemo(() => {
    if (iap.loading) return "Checking…";
    if (!iap.premium) return "Free";
    return "WordCrack Premium";
  }, [iap.loading, iap.premium]);

  const fmtTs = (iso: string | null | undefined) => {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  };

  const loadIap = async () => {
    if (!user || isAnonymous) return;
    try {
      setIapStatusLoading(true);
      const s = await getIapStatus();
      setIapStatus(s);
    } catch (e: any) {
      // Keep this quiet unless debug is enabled.
      if (showIapDebug) Alert.alert("IAP status failed", e?.message ?? "Unknown error");
    } finally {
      setIapStatusLoading(false);
    }
  };

  useEffect(() => {
    if (!showIapDebug) return;
    void loadIap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showIapDebug, user?.id]);

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
              onPress={() => {
                if (isAnonymous) {
                  navigation.navigate("UpgradeAccount", { postUpgradeTo: "Paywall" });
                  return;
                }
                navigation.navigate("Paywall");
              }}
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
                setIapLastSyncAt(Date.now());
                if (showIapDebug) await loadIap();
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

      {/* IAP Debug / Status (hidden toggle; available in TestFlight when enabled) */}
      {showIapDebug ? (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardIcon}>🧪</Text>
            <Text style={styles.cardTitle}>Subscription Status</Text>
          </View>
          <Text style={styles.cardDescription}>
            Use this to confirm Premium status updates after purchase/renewal/cancel.
          </Text>

          <View style={{ marginTop: 10, gap: 6 }}>
            <Text style={styles.kv}>Premium active: <Text style={styles.kvValue}>{iap.premium ? "Yes" : "No"}</Text></Text>
            <Text style={styles.kv}>premium_until: <Text style={styles.kvValue}>{fmtTs(iapStatus?.entitlement?.premium_until)}</Text></Text>
            <Text style={styles.kv}>entitlement updated: <Text style={styles.kvValue}>{fmtTs(iapStatus?.entitlement?.updated_at)}</Text></Text>
            <Text style={styles.kv}>last sync: <Text style={styles.kvValue}>{iapLastSyncAt ? new Date(iapLastSyncAt).toLocaleString() : "—"}</Text></Text>
          </View>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <Pressable
              accessibilityRole="button"
              disabled={iapStatusLoading || iapSyncing}
              onPress={() => void loadIap()}
              style={({ pressed }) => [
                styles.smallButton,
                (iapStatusLoading || iapSyncing) && { opacity: 0.55 },
                pressed && !(iapStatusLoading || iapSyncing) && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.smallButtonText}>{iapStatusLoading ? "Refreshing…" : "Refresh status"}</Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={iapStatusLoading || iapSyncing}
              onPress={() => {
                void (async () => {
                  try {
                    setIapSyncing(true);
                    await iap.restore();
                    setIapLastSyncAt(Date.now());
                    await loadIap();
                    Alert.alert("Synced", "Subscription status refreshed.");
                  } catch (e: any) {
                    Alert.alert("Sync failed", e?.message ?? "Unknown error");
                  } finally {
                    setIapSyncing(false);
                  }
                })();
              }}
              style={({ pressed }) => [
                styles.smallButtonPrimary,
                (iapStatusLoading || iapSyncing) && { opacity: 0.55 },
                pressed && !(iapStatusLoading || iapSyncing) && { opacity: 0.92 },
              ]}
            >
              <Text style={styles.smallButtonPrimaryText}>{iapSyncing ? "Syncing…" : "Sync subscription"}</Text>
            </Pressable>
          </View>

          <View style={{ marginTop: 12 }}>
            <Text style={[styles.cardDescription, { marginBottom: 8 }]}>Recent purchase records:</Text>
            {(iapStatus?.purchases ?? []).length ? (
              (iapStatus?.purchases ?? []).slice(0, 4).map((p, idx) => (
                <View key={`${p.platform}-${p.product_id}-${idx}`} style={styles.purchaseRow}>
                  <Text style={styles.purchaseRowText}>
                    {p.platform.toUpperCase()} • {p.product_id} • {p.status}
                    {p.expires_at ? ` • exp ${new Date(p.expires_at).toLocaleString()}` : ""}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={styles.cardDescription}>No purchases found yet.</Text>
            )}
          </View>
        </View>
      ) : null}

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
                      setDeleting(false);
                      Alert.alert("Account Deleted", "Your account has been permanently deleted.", [
                        {
                          text: "OK",
                          onPress: () => {
                            // The auth user is gone server-side; make sure we clear local session too.
                            void signOut();
                            // BootRouter conditionally mounts Auth only when `!user`,
                            // so resetting to "Auth" from the signed-in stack can be unhandled.
                            // Signing out is enough; BootRouter will re-render to the Auth flow.
                          },
                        },
                      ]);
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

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          const next = debugTapCount + 1;
          if (next >= 7) {
            const enabled = !iapDebugEnabled;
            setDebugTapCount(0);
            setIapDebugEnabled(enabled);
            void setJson("wordcrack:iapDebug", enabled);
            Alert.alert("Debug", enabled ? "Subscription debug enabled." : "Subscription debug disabled.");
          } else {
            setDebugTapCount(next);
          }
        }}
        style={({ pressed }) => [pressed && { opacity: 0.8 }]}
      >
        <Text style={styles.version}>WordCrack v1.0.0</Text>
      </Pressable>

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
  kv: { color: colors.text.secondary, fontSize: 13, fontWeight: "700" },
  kvValue: { color: colors.text.primary, fontWeight: "800" },
  smallButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.background.main,
    borderWidth: 1,
    borderColor: colors.ui.border,
    ...shadows.small,
  },
  smallButtonText: { color: colors.text.primary, fontWeight: "800", fontSize: 13 },
  smallButtonPrimary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.primary.blue,
    ...shadows.small,
  },
  smallButtonPrimaryText: { color: colors.text.light, fontWeight: "900", fontSize: 13 },
  purchaseRow: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: borderRadius.medium,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.ui.border,
    marginBottom: 8,
  },
  purchaseRowText: { color: colors.text.secondary, fontSize: 12, fontWeight: "700" },
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
  // (Removed) Coming-soon modal styles: App Review requires IAP flows to be functional.
});
