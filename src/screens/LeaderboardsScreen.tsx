import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from "react-native";
import { addFriendByInviteCode, getDailyLeaderboard, getFriendsLeaderboard, getGlobalRankings, type GlobalRankingEntry, type LeaderboardEntry } from "../lib/api";
import { useAuth } from "../state/AuthProvider";
import { useIap } from "../purchases/IapProvider";
import { useTheme } from "../theme/theme";

type Tab = "daily" | "friends";

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

export function LeaderboardsScreen() {
  const { user } = useAuth();
  const iap = useIap();
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  const [tab, setTab] = useState<Tab>("daily");
  const [dailyEntries, setDailyEntries] = useState<LeaderboardEntry[] | null>(null);
  const [globalRankings, setGlobalRankings] = useState<GlobalRankingEntry[] | null>(null);
  const [friendsEntries, setFriendsEntries] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState<null | Tab>(null);
  const [inviteCode, setInviteCode] = useState("");

  const isAnonymous = Boolean((user as any)?.is_anonymous) || (user as any)?.app_metadata?.provider === "anonymous";
  const canUseFriends = !isAnonymous && iap.premium;

  const load = async (t: Tab) => {
    try {
      setLoading(t);
      // Prevent the "global list flashes in friends tab" effect.
      if (t === "daily") setDailyEntries(null);
      if (t === "daily") setGlobalRankings(null);
      if (t === "friends") setFriendsEntries(null);
      if (t === "daily") {
        const entries = await getDailyLeaderboard();
        // Non-premium: show top 3, but always show "Me" if present.
        if (iap.premium) {
          setDailyEntries(entries);
        } else {
          const top3 = entries.slice(0, 3);
          const me = user?.id ? entries.find((e) => e.user_id === user.id) : undefined;
          const merged = me && !top3.some((e) => e.user_id === me.user_id) ? [...top3, me] : top3;
          setDailyEntries(merged);
        }

        const ranks = await getGlobalRankings({ limit: iap.premium ? 100 : 25, min_solved: 5 });
        setGlobalRankings(ranks);
      }
      if (t === "friends") {
        const data = await getFriendsLeaderboard();
        setFriendsEntries(data);
      }
    } catch (e: any) {
      Alert.alert("Failed to load", e?.message ?? "Unknown error");
    } finally {
      setLoading(null);
    }
  };

  useEffect(() => {
    // Friends requires Premium.
    if (tab === "friends" && !canUseFriends) {
      setTab("daily");
      return;
    }
    void load(tab);
  }, [tab]);

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabContainer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setTab("daily")}
          style={[
            styles.tab,
            tab === "daily" ? styles.tabActive : styles.tabInactive,
          ]}
        >
          <Text style={[styles.tabText, tab === "daily" && styles.tabTextActive]}>
            🌍 Global
          </Text>
        </Pressable>
        {canUseFriends ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setTab("friends")}
            style={[
              styles.tab,
              tab === "friends" ? styles.tabActive : styles.tabInactive,
            ]}
          >
            <Text style={[styles.tabText, tab === "friends" && styles.tabTextActive]}>
              👥 Friends
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              Alert.alert("WordCrack Premium", "Upgrade to unlock friends leaderboards.", [
                { text: "Not now", style: "cancel" },
              ]);
            }}
            style={[styles.tab, styles.tabInactive, { opacity: 0.5 }]}
          >
            <Text style={styles.tabText}>👥 Friends</Text>
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
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

        {/* Loading State */}
        {loading === tab && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading...</Text>
          </View>
        )}

        {/* Empty State */}
        {tab === "daily" && (dailyEntries?.length ?? 0) === 0 && loading !== tab && (
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

        {/* Daily entries (single list - current puzzle) */}
        {tab === "daily" &&
          (dailyEntries ?? []).map((e, i) => (
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
                  {e.avatar_url ? (
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
                  💡 {e.hints_used_count} hints • ⏱️ +{Math.floor(e.penalty_ms / 1000)}s
                </Text>
              </View>
              <Text style={styles.entryTime}>{fmtMs(e.final_time_ms)}</Text>
            </View>
          ))}

        {/* Global Rankings (average across daily puzzles) */}
        {tab === "daily" ? (
          <View style={styles.globalRankingsSection}>
            <Text style={styles.globalRankingsTitle}>Global Rankings</Text>
            <Text style={styles.globalRankingsSub}>Average final time across daily puzzles (min 5 solves)</Text>

            {(globalRankings ?? []).length === 0 && loading !== "daily" ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyEmoji}>🌍</Text>
                <Text style={styles.emptyTitle}>Not enough data yet</Text>
                <Text style={styles.emptyText}>Complete more puzzles to appear in Global Rankings.</Text>
              </View>
            ) : null}

            {(globalRankings ?? []).map((e, i) => {
              const isMe = user?.id === e.user_id;
              return (
                <View key={`${e.user_id}:${i}`} style={[styles.rankRow, isMe && styles.rankRowMe]}>
                  <Text style={styles.rankNum}>#{i + 1}</Text>
                  {e.avatar_url ? (
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
                    <Text style={styles.rankMeta}>🧩 {e.puzzles_solved} solves</Text>
                  </View>
                  <Text style={styles.rankTime}>{fmtMs(e.avg_final_time_ms)}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Upgrade CTA (daily) */}
        {tab === "daily" && !iap.premium ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => (isAnonymous ? Alert.alert("Create an account", "Create an account to upgrade to Premium.") : null)}
            style={({ pressed }) => [
              styles.upgradeHintCard,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.upgradeHintTitle}>Want full leaderboards?</Text>
            <Text style={styles.upgradeHintText}>Upgrade to WordCrack Premium to unlock full global + friends leaderboards.</Text>
          </Pressable>
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
                  {e.avatar_url ? (
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
                  💡 {e.hints_used_count} hints • ⏱️ +{Math.floor(e.penalty_ms / 1000)}s
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
  tabContainer: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    padding: 14,
    borderRadius: borderRadius.large,
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: colors.primary.darkBlue,
    ...shadows.small,
  },
  tabInactive: {
    backgroundColor: colors.background.card,
    ...shadows.small,
  },
  tabText: {
    fontWeight: "700",
    fontSize: 15,
    color: colors.text.primary,
  },
  tabTextActive: {
    color: colors.text.light,
  },
  scrollContent: {
    paddingBottom: 24,
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
