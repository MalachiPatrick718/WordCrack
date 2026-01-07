import React from "react";
import { Alert, Pressable, Share, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../AppRoot";

type Props = NativeStackScreenProps<RootStackParamList, "Results">;

function fmtMs(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  const ms2 = String(Math.floor((ms % 1000) / 10)).padStart(2, "0");
  return `${mm}:${ss}.${ms2}`;
}

export function ResultsScreen({ navigation, route }: Props) {
  const { solve_time_ms, penalty_ms, final_time_ms, hints_used_count, rank } = route.params;

  const share = async () => {
    try {
      const msg =
        `WordCrack — Daily Puzzle\n` +
        `Raw: ${fmtMs(solve_time_ms)}\n` +
        `Penalties: +${Math.floor(penalty_ms / 1000)}s (${hints_used_count} hints)\n` +
        `Final: ${fmtMs(final_time_ms)}\n` +
        (rank ? `Rank: #${rank}\n` : "");
      await Share.share({ message: msg });
    } catch {
      Alert.alert("Share failed");
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      <View style={{ backgroundColor: "#0B1020", borderRadius: 16, padding: 16 }}>
        <Text style={{ color: "rgba(255,255,255,0.75)" }}>Final Time</Text>
        <Text style={{ color: "white", fontSize: 32, fontWeight: "900", marginTop: 6 }}>{fmtMs(final_time_ms)}</Text>
        {rank ? <Text style={{ color: "rgba(255,255,255,0.9)", marginTop: 8 }}>Global Rank: #{rank}</Text> : null}
      </View>

      <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 16, padding: 14, gap: 6 }}>
        <Text>Raw time: {fmtMs(solve_time_ms)}</Text>
        <Text>Penalties: +{Math.floor(penalty_ms / 1000)}s</Text>
        <Text>Hints used: {hints_used_count}/3</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={share}
        style={({ pressed }) => ({
          backgroundColor: "#6C5CE7",
          borderRadius: 14,
          padding: 14,
          opacity: pressed ? 0.9 : 1,
          alignItems: "center",
        })}
      >
        <Text style={{ color: "white", fontWeight: "800" }}>Share</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        onPress={() => Alert.alert("Reminder", "Daily reminders will be available in Settings (push opt-in).")}
        style={({ pressed }) => ({
          borderWidth: 1,
          borderColor: "#ddd",
          borderRadius: 14,
          padding: 14,
          opacity: pressed ? 0.9 : 1,
          alignItems: "center",
        })}
      >
        <Text style={{ fontWeight: "800" }}>Enable daily reminder</Text>
      </Pressable>

      <View style={{ flex: 1 }} />

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.replace("Home")}
        style={({ pressed }) => ({
          backgroundColor: "#2ECC71",
          borderRadius: 14,
          padding: 14,
          opacity: pressed ? 0.9 : 1,
          alignItems: "center",
        })}
      >
        <Text style={{ color: "white", fontWeight: "800" }}>Back to Home</Text>
      </Pressable>
    </View>
  );
}


