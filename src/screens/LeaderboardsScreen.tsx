import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { addFriendByInviteCode, getDailyLeaderboardByVariant, getFriendsLeaderboardByVariant, getGlobalRankings, type GlobalRankingEntry, type LeaderboardEntry } from "../lib/api";
import { useAuth } from "../state/AuthProvider";
import { useIap } from "../purchases/IapProvider";
import { useTheme } from "../theme/theme";
import { RootStackParamList } from "../AppRoot";
import { UpgradeModal } from "../components/UpgradeModal";

type Tab = "global" | "cipher" | "scramble" | "friends";
type Props = NativeStackScreenProps<RootStackParamList, "Leaderboards">;

function fmtMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const ms2 = String(Math.floor((ms % 1000) / 10)).padStart(2, "0");
  return `${mm}:${ss}.${ms2}`;
}

function getRankColor(rank: number, colors: any): string {
  if (rank === 1) return colors.primary.yellow;
  if (rank === 2) return colors.text.muted;
  if (rank === 3) return colors.tiles[1];
  return colors.background.card;
}

function parseEmojiAvatar(avatar_url: string | null | undefined): string | null {
  if (!avatar_url) return null;
  const s = String(avatar_url);
  if (!s.startsWith("emoji:")) return null;
  const e = s.slice("emoji:".length);
  return e || null;
}

const TAB_LABELS: Record<Tab, { emoji: string; label: string }> = {
  global: { emoji: "🌍", label: "Global Rankings" },
  cipher: { emoji: "🔐", label: "This Hour's Cipher Rankings" },
  scramble: { emoji: "🔀", label: "This Hour's Scramble Rankings" },
  friends: { emoji: "👥", label: "Friends" },
};

export function LeaderboardsScreen({ navigation, route }: Props) {
  const { user, signOut } = useAuth();
  const iap = useIap();
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  const initialTab = route.params?.initialTab ?? "global";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [dailyEntries, setDailyEntries] = useState<LeaderboardEntry[] | null>(null);
  const [globalRankings, setGlobalRankings] = useState<GlobalRankingEntry[] | null>(null);
  const [friendsEntries, setFriendsEntries] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState<null | Tab>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [friendsVariant, setFriendsVariant] = useState<"cipher" | "scramble">("scramble");
  const [showPicker, setShowPicker] = useState(false);

  const isAnonymous = Boolean((user as any)?.is_anonymous) || (user as any)?.app_metadata?.provider === "anonymous";
  const isPremium = Boolean(iap.premium);
  const canUseFriends = !isAnonymous && isPremium;
  const isFreeUser = !isPremium;
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeKind, setUpgradeKind] = useState<"friends" | "full_leaderboard">("full_leaderboard");

  const load = async (t: Tab) => {
    try {
      setLoading(t);
      // Prevent the "global list flashes in friends tab" effect.
      if (t === "cipher" || t === "scramble") setDailyEntries(null);
      if (t === "global") setGlobalRankings(null);
      if (t === "friends") setFriendsEntries(null);
      if (t === "cipher" || t === "scramble") {
        const entries = await getDailyLeaderboardByVariant(t === "cipher" ? "cipher" : "scramble");
        setDailyEntries(entries);
      }
      if (t === "global") {
        const ranks = await getGlobalRankings({ limit: 100, min_solved: 5 });
        setGlobalRankings(ranks);
      }
      if (t === "friends") {
        const data = await getFriendsLeaderboardByVariant(friendsVariant);
        setFriendsEntries(data);
      }
    } catch (e: any) {
      Alert.alert("Failed to load", e?.message ?? "Unknown error");
    } finally {
      setLoading(null);
    }
  };

  useEffect(() => {
    if (tab === "friends" && !canUseFriends) setTab("global");
    void load(tab);
  }, [tab, friendsVariant]);

  const selectTab = (t: Tab) => {
    if (t === "friends" && !canUseFriends) {
      setUpgradeKind("friends");
      setShowUpgrade(true);
      return;
    }
    setTab(t);
    setShowPicker(false);
  };

  return (
    <View style={styles.container}>
      <UpgradeModal
        visible={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        emoji={upgradeKind === "friends" ? "🤝" : "🏆"}
        title={
          upgradeKind === "friends"
            ? "Friends Leaderboards are Premium"
            : "Unlock the full leaderboard"
        }
        subtitle={
          upgradeKind === "friends"
            ? "Friends leaderboards require Premium + an account so you can add friends."
            : (isAnonymous
              ? "Subscribe with Guest Mode. Create an account later to sync Premium across devices."
              : "Upgrade to MindShiftz Premium to unlock this feature.")
        }
        bullets={[
          "Unlimited practice puzzles",
          "Friends leaderboards",
          "Full leaderboards + advanced stats",
        ]}
        primaryLabel={upgradeKind === "friends" ? "Create account" : "Upgrade to Premium"}
        onPrimary={() => {
          if (upgradeKind === "friends") {
            void signOut();
            return;
          }
          navigation.navigate("Paywall");
        }}
        secondaryLabel="Not now"
      />
      {/* Dropdown Selector */}
      <Pressable
        accessibilityRole="button"
        onPress={() => setShowPicker(true)}
        style={({ pressed }) => [
          styles.dropdownButton,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Text style={styles.dropdownButtonText}>
          {TAB_LABELS[tab].emoji} {TAB_LABELS[tab].label}
        </Text>
        <Text style={styles.dropdownArrow}>▼</Text>
      </Pressable>

      {/* Picker Modal */}
      <Modal
        visible={showPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPicker(false)}>
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Select Leaderboard</Text>
            {(["global", "cipher", "scramble", "friends"] as Tab[]).map((t) => {
              const isDisabled = t === "friends" && !canUseFriends;
              const isSelected = t === tab;
              const friendsSuffix = isAnonymous ? " (🔒 Create account + Premium)" : " (🔒 Premium)";
              return (
                <Pressable
                  key={t}
                  accessibilityRole="button"
                  onPress={() => selectTab(t)}
                  style={({ pressed }) => [
                    styles.pickerOption,
                    isSelected && styles.pickerOptionSelected,
                    isDisabled && styles.pickerOptionDisabled,
                    pressed && !isDisabled && { opacity: 0.8 },
                  ]}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    isSelected && styles.pickerOptionTextSelected,
                    isDisabled && styles.pickerOptionTextDisabled,
                  ]}>
                    {TAB_LABELS[t].emoji} {TAB_LABELS[t].label}
                    {t === "friends" && isDisabled ? friendsSuffix : ""}
                  </Text>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Guest CTA */}
        {isAnonymous && (
          <View style={styles.guestCard}>
            <Text style={styles.guestTitle}>Playing as Guest</Text>
            <Text style={styles.guestText}>Create an account to save progress across devices and use friends leaderboards.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                void signOut();
              }}
              style={({ pressed }) => [styles.guestButton, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.guestButtonText}>Create Account</Text>
            </Pressable>
          </View>
        )}

        {/* Add Friend Section */}
        {tab === "friends" && canUseFriends && (
          <View style={styles.addFriendCard}>
            <Text style={styles.cardTitle}>Add a Friend</Text>
            <TextInput
              autoCapitalize="none"
              placeholder="Enter invite code"
              placeholderTextColor={colors.text.muted}
              value={inviteCode}
              onChangeText={setInviteCode}
              style={styles.input}
            />
            <Pressable
              accessibilityRole="button"
              onPress={async () => {
                try {
                  const code = inviteCode.trim();
                  if (!code) return;
                  await addFriendByInviteCode(code);
                  setInviteCode("");
                  await load("friends");
                  Alert.alert("Friend added!");
                } catch (e: any) {
                  Alert.alert("Add friend failed", e?.message ?? "Unknown error");
                }
              }}
              style={({ pressed }) => [
                styles.addButton,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.addButtonText}>Add Friend</Text>
            </Pressable>
          </View>
        )}

        {/* Friends locked view */}
        {tab === "friends" && !canUseFriends && (
          <View style={styles.guestCard}>
            <Text style={styles.guestTitle}>🔒 Premium Feature</Text>
            <Text style={styles.guestText}>
              Friends leaderboards are available with MindShiftz Premium.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setUpgradeKind("friends");
                setShowUpgrade(true);
              }}
              style={({ pressed }) => [styles.guestButton, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.guestButtonText}>{isAnonymous ? "Create Account" : "Upgrade to Premium"}</Text>
            </Pressable>
          </View>
        )}

        {/* Friends variant switch */}
        {tab === "friends" && canUseFriends && (
          <View style={styles.friendVariantRow}>
            <Pressable
              accessibilityRole="button"
              onPress={() => setFriendsVariant("cipher")}
              style={[styles.friendVariantPill, friendsVariant === "cipher" ? styles.friendVariantPillActive : styles.friendVariantPillInactive]}
            >
              <Text style={[styles.friendVariantText, friendsVariant === "cipher" && styles.friendVariantTextActive]}>Cipher</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={() => setFriendsVariant("scramble")}
              style={[styles.friendVariantPill, friendsVariant === "scramble" ? styles.friendVariantPillActive : styles.friendVariantPillInactive]}
            >
              <Text style={[styles.friendVariantText, friendsVariant === "scramble" && styles.friendVariantTextActive]}>Scramble</Text>
            </Pressable>
          </View>
        )}

        {/* Loading State */}
        {loading === tab && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        )}

        {/* Empty State */}
        {(tab === "cipher" || tab === "scramble") && (dailyEntries?.length ?? 0) === 0 && loading !== tab && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🏆</Text>
            <Text style={styles.emptyTitle}>No entries yet</Text>
            <Text style={styles.emptyText}>
              Be the first to complete the current puzzle!
            </Text>
          </View>
        )}
        {tab === "friends" && (friendsEntries?.length ?? 0) === 0 && loading !== tab && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>👥</Text>
            <Text style={styles.emptyTitle}>No entries yet</Text>
            <Text style={styles.emptyText}>Add friends using their invite code to see their scores.</Text>
          </View>
        )}

        {/* Current puzzle entries (Cipher / Scramble) */}
        {(tab === "cipher" || tab === "scramble") &&
          (dailyEntries ?? []).slice(0, isFreeUser ? 5 : 10_000).map((e, i) => (
            <View
              key={`${e.user_id}:${i}`}
              style={[
                styles.entryCard,
                i < 3 && { borderLeftWidth: 4, borderLeftColor: getRankColor(i + 1, colors) },
                user?.id === e.user_id && styles.entryCardMe,
              ]}
            >
              <View style={[styles.rankBadge, { backgroundColor: getRankColor(i + 1, colors) }]}>
                <Text style={styles.rankText}>#{i + 1}</Text>
              </View>
              <View style={styles.entryInfo}>
                <View style={styles.userRow}>
                  {parseEmojiAvatar(e.avatar_url) ? (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarEmoji}>{parseEmojiAvatar(e.avatar_url)}</Text>
                    </View>
                  ) : e.avatar_url ? (
                    <Image source={{ uri: e.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>{String(e.username ?? "P").slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.usernameRow}>
                    <Text style={styles.username} numberOfLines={1}>
                      {e.username}
                      {e.is_premium ? " ⭐" : ""}
                    </Text>
                    {user?.id === e.user_id ? (
                      <View style={styles.mePillInline}>
                        <Text style={styles.mePillInlineText}>Me</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.entryDetails}>
                  💡 {e.hints_used_count} hints • ⏱️ +{Math.floor(e.penalty_ms / 1000)}s{e.location ? ` • 📍 ${e.location}` : ""}
                </Text>
              </View>
              <Text style={styles.entryTime}>{fmtMs(e.final_time_ms)}</Text>
            </View>
          ))}

        {(tab === "cipher" || tab === "scramble") && isFreeUser && (dailyEntries?.length ?? 0) > 5 ? (
          <View style={styles.guestCard}>
            <Text style={styles.guestTitle}>🏆 See the full leaderboard</Text>
            <Text style={styles.guestText}>Upgrade to MindShiftz Premium to unlock the full list.</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setUpgradeKind("full_leaderboard");
                setShowUpgrade(true);
              }}
              style={({ pressed }) => [styles.guestButton, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.guestButtonText}>{isAnonymous ? "Create Account" : "Upgrade to Premium"}</Text>
            </Pressable>
          </View>
        ) : null}

        {/* Global Rankings (average across daily puzzles) */}
        {tab === "global" ? (
          <View style={styles.globalRankingsSection}>
            <Text style={styles.globalRankingsTitle}>Global Rankings</Text>
            <Text style={styles.globalRankingsSub}>
              Average final time across daily puzzles{"\n"}
              (5 Solved Puzzles to Unlock)
            </Text>

            {(globalRankings ?? []).length === 0 && loading !== "daily" ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🌍</Text>
                <Text style={styles.emptyTitle}>Not enough data yet</Text>
                <Text style={styles.emptyText}>Complete more puzzles to appear in Global Rankings.</Text>
              </View>
            ) : null}

            {(globalRankings ?? []).slice(0, isFreeUser ? 5 : 10_000).map((e, i) => {
              const isMe = user?.id === e.user_id;
              return (
                <View key={`${e.user_id}:${i}`} style={[styles.rankRow, isMe && styles.rankRowMe]}>
                  <Text style={styles.rankNum}>#{i + 1}</Text>
                  {parseEmojiAvatar(e.avatar_url) ? (
                    <View style={styles.rankAvatarFallback}>
                      <Text style={styles.avatarEmojiSmall}>{parseEmojiAvatar(e.avatar_url)}</Text>
                    </View>
                  ) : e.avatar_url ? (
                    <Image source={{ uri: e.avatar_url }} style={styles.rankAvatar} />
                  ) : (
                    <View style={styles.rankAvatarFallback}>
                      <Text style={styles.avatarFallbackText}>{String(e.username ?? "P").slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.rankInfo}>
                    <View style={styles.rankNameRow}>
                      <Text style={styles.rankName} numberOfLines={1}>
                        {e.username}
                        {e.is_premium ? " ⭐" : ""}
                      </Text>
                      {isMe ? (
                        <View style={styles.mePillInline}>
                          <Text style={styles.mePillInlineText}>Me</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.rankMeta}>🧩 {e.puzzles_solved} solves{e.location ? ` • 📍 ${e.location}` : ""}</Text>
                  </View>
                  <Text style={styles.rankTime}>{fmtMs(e.avg_final_time_ms)}</Text>
                </View>
              );
            })}

            {isFreeUser && (globalRankings?.length ?? 0) > 5 ? (
              <View style={[styles.guestCard, { marginTop: 14 }]}>
                <Text style={styles.guestTitle}>🔒 Full Global Rankings</Text>
                <Text style={styles.guestText}>Upgrade to MindShiftz Premium to view the full rankings list.</Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setUpgradeKind("full_leaderboard");
                    setShowUpgrade(true);
                  }}
                  style={({ pressed }) => [styles.guestButton, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.guestButtonText}>{isAnonymous ? "Create Account" : "Upgrade to Premium"}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Friends entries (single list) */}
        {tab === "friends" &&
          (friendsEntries ?? []).map((e, i) => (
            <View
              key={`${e.user_id}:${i}`}
              style={[
                styles.entryCard,
                i < 3 && { borderLeftWidth: 4, borderLeftColor: getRankColor(i + 1, colors) },
                user?.id === e.user_id && styles.entryCardMe,
              ]}
            >
              <View style={[styles.rankBadge, { backgroundColor: getRankColor(i + 1, colors) }]}>
                <Text style={styles.rankText}>#{i + 1}</Text>
              </View>
              <View style={styles.entryInfo}>
                <View style={styles.userRow}>
                  {parseEmojiAvatar(e.avatar_url) ? (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarEmoji}>{parseEmojiAvatar(e.avatar_url)}</Text>
                    </View>
                  ) : e.avatar_url ? (
                    <Image source={{ uri: e.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarFallbackText}>{String(e.username ?? "P").slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.usernameRow}>
                    <Text style={styles.username} numberOfLines={1}>
                      {e.username}
                      {e.is_premium ? " ⭐" : ""}
                    </Text>
                    {user?.id === e.user_id ? (
                      <View style={styles.mePillInline}>
                        <Text style={styles.mePillInlineText}>Me</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Text style={styles.entryDetails}>
                  💡 {e.hints_used_count} hints • ⏱️ +{Math.floor(e.penalty_ms / 1000)}s{e.location ? ` • 📍 ${e.location}` : ""}
                </Text>
              </View>
              <Text style={styles.entryTime}>{fmtMs(e.final_time_ms)}</Text>
            </View>
          ))}
      </ScrollView>
    </View>
  );
}

function makeStyles(colors: any, shadows: any, borderRadius: any) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.main,
    padding: 16,
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary.darkBlue,
    borderRadius: borderRadius.large,
    padding: 16,
    marginBottom: 16,
    ...shadows.small,
  },
  dropdownButtonText: {
    fontWeight: "800",
    fontSize: 17,
    color: colors.text.light,
    textAlign: "center",
  },
  dropdownArrow: {
    fontSize: 14,
    color: colors.text.light,
    opacity: 0.8,
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  pickerContainer: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 16,
    width: "100%",
    maxWidth: 340,
    ...shadows.medium,
  },
  pickerTitle: {
    fontWeight: "900",
    fontSize: 18,
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 16,
  },
  pickerOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: borderRadius.large,
    marginBottom: 8,
    backgroundColor: colors.background.main,
  },
  pickerOptionSelected: {
    backgroundColor: colors.primary.darkBlue,
  },
  pickerOptionDisabled: {
    opacity: 0.5,
  },
  pickerOptionText: {
    fontWeight: "700",
    fontSize: 16,
    color: colors.text.primary,
  },
  pickerOptionTextSelected: {
    color: colors.text.light,
  },
  pickerOptionTextDisabled: {
    color: colors.text.muted,
  },
  checkmark: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text.light,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  guestCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(69, 170, 242, 0.35)",
    ...shadows.small,
  },
  guestTitle: {
    fontWeight: "900",
    fontSize: 16,
    color: colors.text.primary,
    marginBottom: 6,
  },
  guestText: {
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  guestButton: {
    backgroundColor: colors.primary.blue,
    borderRadius: borderRadius.large,
    paddingVertical: 12,
    alignItems: "center",
    ...shadows.small,
  },
  guestButtonText: {
    color: colors.text.light,
    fontWeight: "900",
    fontSize: 16,
  },
  upgradeHintCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 193, 7, 0.35)",
    ...shadows.small,
  },
  upgradeHintTitle: {
    fontWeight: "900",
    fontSize: 16,
    color: colors.text.primary,
    marginBottom: 4,
  },
  upgradeHintText: {
    color: colors.text.secondary,
    lineHeight: 20,
  },
  globalRankingsSection: {
    marginTop: 18,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 14,
    ...shadows.small,
  },
  globalRankingsTitle: {
    fontWeight: "900",
    fontSize: 18,
    color: colors.text.primary,
    marginBottom: 2,
  },
  globalRankingsSub: {
    color: colors.text.secondary,
    marginBottom: 12,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.ui.border,
  },
  rankRowMe: {
    borderRadius: borderRadius.large,
    borderWidth: 2,
    borderColor: "rgba(26, 115, 232, 0.35)",
    paddingHorizontal: 10,
  },
  rankNum: { width: 44, fontWeight: "900", color: colors.text.primary },
  rankAvatar: { width: 34, height: 34, borderRadius: 17, marginRight: 10 },
  rankAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary.darkBlue,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  rankInfo: { flex: 1, paddingRight: 10 },
  rankNameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rankName: { fontWeight: "900", color: colors.text.primary, maxWidth: 180 },
  rankMeta: { color: colors.text.secondary, marginTop: 2 },
  rankTime: { fontWeight: "900", color: colors.primary.darkBlue },
  addFriendCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 16,
    marginBottom: 16,
    ...shadows.small,
  },
  friendVariantRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  friendVariantPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: borderRadius.large,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.ui.border,
  },
  friendVariantPillActive: {
    backgroundColor: colors.primary.darkBlue,
    ...shadows.small,
  },
  friendVariantPillInactive: {
    backgroundColor: colors.background.card,
    ...shadows.small,
  },
  friendVariantText: {
    fontWeight: "800",
    color: colors.text.primary,
  },
  friendVariantTextActive: {
    color: colors.text.light,
  },
  cardTitle: {
    fontWeight: "800",
    fontSize: 16,
    color: colors.text.primary,
    marginBottom: 12,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.ui.border,
    borderRadius: borderRadius.medium,
    padding: 12,
    fontSize: 16,
    color: colors.text.primary,
  },
  addButton: {
    marginTop: 12,
    backgroundColor: colors.button.submit,
    borderRadius: borderRadius.medium,
    padding: 14,
    alignItems: "center",
    ...shadows.small,
  },
  addButtonText: {
    color: colors.text.light,
    fontWeight: "700",
    fontSize: 15,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 40,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontWeight: "800",
    fontSize: 18,
    color: colors.text.primary,
    marginBottom: 8,
  },
  emptyText: {
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 20,
  },
  entryCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.large,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    ...shadows.small,
  },
  entryCardMe: {
    borderWidth: 1,
    borderColor: "rgba(26, 115, 232, 0.35)",
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  rankText: {
    fontWeight: "800",
    fontSize: 14,
    color: colors.primary.darkBlue,
  },
  entryInfo: {
    flex: 1,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  usernameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  mePillInline: {
    backgroundColor: colors.primary.darkBlue,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  mePillInlineText: {
    color: colors.text.light,
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 0.2,
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.background.main,
  },
  avatarFallback: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary.darkBlue,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    color: colors.text.light,
    fontWeight: "900",
  },
  avatarEmoji: {
    fontSize: 18,
  },
  avatarEmojiSmall: {
    fontSize: 18,
  },
  username: {
    fontWeight: "700",
    fontSize: 16,
    color: colors.text.primary,
  },
  entryDetails: {
    color: colors.text.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  entryTime: {
    fontWeight: "900",
    fontSize: 18,
    color: colors.primary.darkBlue,
  },
  });
}
