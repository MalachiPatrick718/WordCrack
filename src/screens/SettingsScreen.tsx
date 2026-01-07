import React, { useEffect, useState } from "react";
import { Alert, Pressable, Switch, Text, View } from "react-native";
import * as Notifications from "expo-notifications";
import { getJson, setJson } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { useAuth } from "../state/AuthProvider";
import { useIap } from "../purchases/IapProvider";
import { PRODUCTS } from "../purchases/products";

type Prefs = {
  pushEnabled: boolean;
};

export function SettingsScreen() {
  const { user } = useAuth();
  const iap = useIap();
  const [prefs, setPrefs] = useState<Prefs>({ pushEnabled: false });
  const [inviteCode, setInviteCode] = useState<string | null>(null);

  useEffect(() => {
    getJson<Prefs>("wordcrack:prefs").then((v) => v && setPrefs(v));
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
      // v1: schedule local reminder placeholder; push scheduling via server comes later.
    }
    const updated = { ...prefs, pushEnabled: next };
    setPrefs(updated);
    await setJson("wordcrack:prefs", updated);
  };

  return (
    <View style={{ flex: 1, padding: 16, gap: 14 }}>
      <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 16, padding: 14 }}>
        <Text style={{ fontWeight: "900", marginBottom: 10 }}>Friends</Text>
        <Text style={{ color: "#666", marginBottom: 10 }}>Share your invite code so friends can add you.</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontWeight: "800" }}>{inviteCode ?? "—"}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (!inviteCode) return;
              void (async () => {
                try {
                  const Share = require("react-native").Share;
                  await Share.share({ message: `Add me on WordCrack: ${inviteCode}` });
                } catch {
                  Alert.alert("Share failed");
                }
              })();
            }}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text style={{ fontWeight: "800" }}>Share</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 16, padding: 14 }}>
        <Text style={{ fontWeight: "900", marginBottom: 10 }}>Notifications</Text>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text>Daily reminder (push)</Text>
          <Switch value={prefs.pushEnabled} onValueChange={togglePush} />
        </View>
        <Text style={{ color: "#666", marginTop: 10, fontSize: 12 }}>
          v1 uses local scheduling; server push at your chosen local time will be enabled once OneSignal/Push server wiring is finalized.
        </Text>
      </View>

      <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 16, padding: 14 }}>
        <Text style={{ fontWeight: "900", marginBottom: 10 }}>Account</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => Alert.alert("Upgrade", "Guest → account upgrade flow will live here (email/password or OTP).")}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 12,
            padding: 12,
            opacity: pressed ? 0.9 : 1,
            alignItems: "center",
          })}
        >
          <Text style={{ fontWeight: "800" }}>Upgrade Guest Account</Text>
        </Pressable>
      </View>

      <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 16, padding: 14 }}>
        <Text style={{ fontWeight: "900", marginBottom: 10 }}>Purchases</Text>
        <Text style={{ color: "#666", marginBottom: 10, fontSize: 12 }}>
          Purchases are handled directly via Apple/Google (no RevenueCat). Your entitlement is stored in Supabase after server-side validation.
        </Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              try {
                await iap.buy(PRODUCTS.premium_monthly);
                Alert.alert("Success", "Premium unlocked (if your purchase validated).");
              } catch (e: any) {
                Alert.alert("Purchase failed", e?.message ?? "Unknown error");
              }
            }}
            style={({ pressed }) => ({
              flex: 1,
              backgroundColor: "#6C5CE7",
              borderRadius: 12,
              padding: 12,
              opacity: pressed ? 0.9 : 1,
              alignItems: "center",
            })}
          >
            <Text style={{ color: "white", fontWeight: "800" }}>Go Premium</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              try {
                await iap.restore();
                Alert.alert("Restored", "We synced your purchases and updated your entitlement.");
              } catch (e: any) {
                Alert.alert("Restore failed", e?.message ?? "Unknown error");
              }
            }}
            style={({ pressed }) => ({
              flex: 1,
              borderWidth: 1,
              borderColor: "#ddd",
              borderRadius: 12,
              padding: 12,
              opacity: pressed ? 0.9 : 1,
              alignItems: "center",
            })}
          >
            <Text style={{ fontWeight: "800" }}>Restore</Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => Alert.alert("Products", "Configure your monthly/annual/lifetime products in App Store Connect and Play Console to match the IDs in src/purchases/products.ts")}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderColor: "#ddd",
            borderRadius: 12,
            padding: 12,
            opacity: pressed ? 0.9 : 1,
            alignItems: "center",
          })}
        >
          <Text style={{ fontWeight: "800" }}>IAP Setup Info</Text>
        </Pressable>
      </View>

      <View style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 16, padding: 14 }}>
        <Text style={{ fontWeight: "900", marginBottom: 10 }}>Legal</Text>
        <Text style={{ color: "#666", fontSize: 12 }}>Privacy Policy & Terms screens will be included before release.</Text>
      </View>
    </View>
  );
}


