import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { addFriendByInviteCode, getDailyLeaderboard, getFriendsLeaderboard, type LeaderboardEntry } from "../lib/api";

type Tab = "daily" | "friends";

function fmtMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const ms2 = String(Math.floor((ms % 1000) / 10)).padStart(2, "0");
  return `${mm}:${ss}.${ms2}`;
}

export function LeaderboardsScreen() {
  const [tab, setTab] = useState<Tab>("daily");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  const load = async (t: Tab) => {
    try {
      setLoading(true);
      const data = t === "daily" ? await getDailyLeaderboard() : await getFriendsLeaderboard();
      setEntries(data);
    } catch (e: any) {
      Alert.alert("Failed to load", e?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(tab);
  }, [tab]);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => setTab("daily")}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: tab === "daily" ? "#0B1020" : "#eee",
            borderRadius: 12,
            padding: 12,
            opacity: pressed ? 0.9 : 1,
            alignItems: "center",
          })}
        >
          <Text style={{ color: tab === "daily" ? "white" : "#111", fontWeight: "800" }}>Daily</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => setTab("friends")}
          style={({ pressed }) => ({
            flex: 1,
            backgroundColor: tab === "friends" ? "#0B1020" : "#eee",
            borderRadius: 12,
            padding: 12,
            opacity: pressed ? 0.9 : 1,
            alignItems: "center",
          })}
        >
          <Text style={{ color: tab === "friends" ? "white" : "#111", fontWeight: "800" }}>Friends</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        {tab === "friends" ? (
          <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 14, padding: 12, marginBottom: 10 }}>
            <Text style={{ fontWeight: "800", marginBottom: 8 }}>Add a friend</Text>
            <TextInput
              autoCapitalize="none"
              placeholder="Invite code"
              value={inviteCode}
              onChangeText={setInviteCode}
              style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12 }}
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
                } catch (e: any) {
                  Alert.alert("Add friend failed", e?.message ?? "Unknown error");
                }
              }}
              style={({ pressed }) => ({
                marginTop: 10,
                backgroundColor: "#2ECC71",
                borderRadius: 12,
                padding: 12,
                opacity: pressed ? 0.9 : 1,
                alignItems: "center",
              })}
            >
              <Text style={{ color: "white", fontWeight: "800" }}>Add Friend</Text>
            </Pressable>
            <Text style={{ color: "#666", marginTop: 8, fontSize: 12 }}>
              Invite-code based friends are immediately accepted in v1.
            </Text>
          </View>
        ) : null}

        {loading ? <Text style={{ color: "#666" }}>Loading…</Text> : null}
        {entries.length === 0 && !loading ? (
          <View style={{ paddingVertical: 24 }}>
            <Text style={{ fontWeight: "800", marginBottom: 6 }}>No entries yet</Text>
            <Text style={{ color: "#666" }}>
              {tab === "daily" ? "Be the first to complete today’s puzzle." : "Add friends (invite-code flow) to see this leaderboard."}
            </Text>
          </View>
        ) : null}

        {entries.map((e, i) => (
          <View
            key={`${e.user_id}:${i}`}
            style={{
              borderWidth: 1,
              borderColor: "#eee",
              borderRadius: 14,
              padding: 12,
              marginTop: 10,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontWeight: "800" }}>
                #{i + 1} {e.username}
              </Text>
              <Text style={{ color: "#666", marginTop: 4 }}>
                Hints: {e.hints_used_count} • Penalties: +{Math.floor(e.penalty_ms / 1000)}s
              </Text>
            </View>
            <Text style={{ fontWeight: "900" }}>{fmtMs(e.final_time_ms)}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}


