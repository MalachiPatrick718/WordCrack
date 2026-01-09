import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from "react-native";
import { addFriendByInviteCode, getDailyLeaderboard, getFriendsLeaderboard, type LeaderboardEntry } from "../lib/api";
import { useAuth } from "../state/AuthProvider";
import { colors, shadows, borderRadius } from "../theme/colors";

type Tab = "daily" | "friends";

function fmtMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const ms2 = String(Math.floor((ms % 1000) / 10)).padStart(2, "0");
  return `${mm}:${ss}.${ms2}`;
}

function getRankColor(rank: number): string {
  if (rank === 1) return colors.primary.yellow;
  if (rank === 2) return colors.text.muted;
  if (rank === 3) return colors.tiles[1];
  return colors.background.card;
}

export function LeaderboardsScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("daily");
  const [dailyEntries, setDailyEntries] = useState<LeaderboardEntry[] | null>(null);
  const [friendsEntries, setFriendsEntries] = useState<LeaderboardEntry[] | null>(null);
  const [loading, setLoading] = useState<null | Tab>(null);
  const [inviteCode, setInviteCode] = useState("");

  const isAnonymous = Boolean((user as any)?.is_anonymous) || (user as any)?.app_metadata?.provider === "anonymous";

  const activeEntries = useMemo(() => {
    return tab === "daily" ? dailyEntries : friendsEntries;
  }, [tab, dailyEntries, friendsEntries]);

  const load = async (t: Tab) => {
    try {
      setLoading(t);
      // Prevent the "global list flashes in friends tab" effect.
      if (t === "daily") setDailyEntries(null);
      if (t === "friends") setFriendsEntries(null);
      const data = t === "daily" ? await getDailyLeaderboard() : await getFriendsLeaderboard();
      if (t === "daily") setDailyEntries(data);
      if (t === "friends") setFriendsEntries(data);
    } catch (e: any) {
      Alert.alert("Failed to load", e?.message ?? "Unknown error");
    } finally {
      setLoading(null);
    }
  };

  useEffect(() => {
    // Guests can see global leaderboard, but friends requires a real account.
    if (tab === "friends" && isAnonymous) {
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
        {!isAnonymous ? (
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
          <View style={[styles.tab, styles.tabInactive, { opacity: 0.5 }]}>
            <Text style={styles.tabText}>👥 Friends</Text>
          </View>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Add Friend Section */}
        {tab === "friends" && !isAnonymous && (
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
        {(activeEntries?.length ?? 0) === 0 && loading !== tab && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>{tab === "daily" ? "🏆" : "👥"}</Text>
            <Text style={styles.emptyTitle}>No entries yet</Text>
            <Text style={styles.emptyText}>
              {tab === "daily"
                ? "Be the first to complete today's puzzle!"
                : "Add friends using their invite code to see their scores."}
            </Text>
          </View>
        )}

        {/* Leaderboard Entries */}
        {(activeEntries ?? []).map((e, i) => (
          <View
            key={`${e.user_id}:${i}`}
            style={[
              styles.entryCard,
              i < 3 && { borderLeftWidth: 4, borderLeftColor: getRankColor(i + 1) },
              user?.id === e.user_id && styles.entryCardMe,
            ]}
          >
            <View style={[styles.rankBadge, { backgroundColor: getRankColor(i + 1) }]}>
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

const styles = StyleSheet.create({
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
