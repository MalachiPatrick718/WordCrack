import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../AppRoot";
import { useAuth } from "../state/AuthProvider";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

function msUntilNextUtcDay(now = new Date()): number {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0));
  return next.getTime() - now.getTime();
}

function formatHms(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function HomeScreen({ navigation }: Props) {
  const { signOut } = useAuth();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const today = useMemo(() => new Date().toDateString(), [tick]);
  const countdown = useMemo(() => formatHms(msUntilNextUtcDay()), [tick]);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ backgroundColor: "#0B1020", borderRadius: 16, padding: 16 }}>
        <Text style={{ color: "rgba(255,255,255,0.8)" }}>Today</Text>
        <Text style={{ color: "white", fontSize: 20, fontWeight: "800", marginTop: 6 }}>{today}</Text>
        <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 10 }}>Next puzzle in</Text>
        <Text style={{ color: "white", fontSize: 20, fontWeight: "700", marginTop: 4 }}>{countdown}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate("Puzzle", { mode: "daily" })}
        style={({ pressed }) => ({
          backgroundColor: "#6C5CE7",
          borderRadius: 14,
          padding: 16,
          opacity: pressed ? 0.9 : 1,
          alignItems: "center",
        })}
      >
        <Text style={{ color: "white", fontWeight: "800" }}>Play Today</Text>
      </Pressable>

      <View style={{ flexDirection: "row", gap: 12 }}>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Leaderboards")}
          style={({ pressed }) => ({
            flex: 1,
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 14,
            padding: 14,
            opacity: pressed ? 0.9 : 1,
            alignItems: "center",
          })}
        >
          <Text style={{ fontWeight: "800" }}>Leaderboard</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => navigation.navigate("Stats")}
          style={({ pressed }) => ({
            flex: 1,
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 14,
            padding: 14,
            opacity: pressed ? 0.9 : 1,
            alignItems: "center",
          })}
        >
          <Text style={{ fontWeight: "800" }}>Stats</Text>
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate("Settings")}
        style={({ pressed }) => ({
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 14,
          padding: 14,
          opacity: pressed ? 0.9 : 1,
          alignItems: "center",
        })}
      >
        <Text style={{ fontWeight: "800" }}>Settings</Text>
      </Pressable>

      <View style={{ flex: 1 }} />

      <Pressable
        accessibilityRole="button"
        onPress={() => signOut()}
        style={({ pressed }) => ({
          borderWidth: 1,
          borderColor: "#eee",
          borderRadius: 14,
          padding: 14,
          opacity: pressed ? 0.9 : 1,
          alignItems: "center",
        })}
      >
        <Text style={{ fontWeight: "700" }}>Sign Out</Text>
      </Pressable>
    </View>
  );
}


