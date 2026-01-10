import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, Pressable, Text, TextInput, View, StyleSheet } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../AppRoot";
import { supabase } from "../lib/supabase";
import { useAuth } from "../state/AuthProvider";
import { useTheme } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "ProfileSetup">;

const AVATAR_SEEDS = [
  "atlas",
  "nova",
  "ember",
  "orbit",
  "pixel",
  "cipher",
  "lumen",
  "quartz",
  "tango",
  "zen",
  "mosaic",
  "ripple",
  "comet",
  "fjord",
  "koda",
  "mint",
  "prism",
  "rocket",
  "saffron",
  "vortex",
  "wisp",
  "yonder",
  "zebra",
  "pebble",
];

function avatarUrlForSeed(seed: string) {
  return `https://api.dicebear.com/9.x/thumbs/png?seed=${encodeURIComponent(seed)}`;
}

export function ProfileSetupScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  const [username, setUsername] = useState(route.params?.initialUsername ?? "");
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>(route.params?.initialAvatarUrl ?? avatarUrlForSeed(AVATAR_SEEDS[0]!));
  const [saving, setSaving] = useState(false);

  const avatarChoices = useMemo(() => AVATAR_SEEDS.map((s) => avatarUrlForSeed(s)), []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("username,avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!mounted) return;
        if (data?.username && (!route.params?.initialUsername || route.params.initialUsername === "player" || route.params.initialUsername.startsWith("player_"))) {
          setUsername(data.username);
        }
        if (data?.avatar_url) setSelectedAvatarUrl(data.avatar_url);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const save = async () => {
    if (!user) return;
    const u = username.trim().toLowerCase();
    if (u.length < 3) return Alert.alert("Username too short", "Use at least 3 characters.");
    if (!/^[a-z0-9_]+$/.test(u)) return Alert.alert("Invalid username", "Use only letters, numbers, and underscores.");

    try {
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update({ username: u, avatar_url: selectedAvatarUrl })
        .eq("user_id", user.id);
      if (error) throw error;

      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (e: any) {
      const msg = String(e?.message ?? "Unknown error");
      if (msg.toLowerCase().includes("duplicate key value") || msg.toLowerCase().includes("unique")) {
        Alert.alert("Username taken", "Try a different username.");
      } else {
        Alert.alert("Save failed", msg);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Create your profile</Text>
        <Text style={styles.subtitle}>Choose a username and profile picture for leaderboards.</Text>

        <Text style={styles.label}>Choose an avatar</Text>
        <View style={styles.avatarGrid}>
          {avatarChoices.map((url) => {
            const selected = url === selectedAvatarUrl;
            return (
              <Pressable
                key={url}
                accessibilityRole="button"
                onPress={() => setSelectedAvatarUrl(url)}
                style={({ pressed }) => [
                  styles.avatarChoice,
                  selected && styles.avatarChoiceSelected,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <Image source={{ uri: url }} style={styles.avatarChoiceImage} />
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Username</Text>
        <TextInput
          autoCapitalize="none"
          placeholder="username"
          placeholderTextColor={colors.text.muted}
          value={username}
          onChangeText={setUsername}
          style={styles.input}
        />

        <Pressable
          accessibilityRole="button"
          disabled={saving || !user}
          onPress={save}
          style={({ pressed }) => [
            styles.saveButton,
            (saving || !user) && { backgroundColor: colors.text.muted },
            pressed && !saving && { opacity: 0.9 },
          ]}
        >
          <Text style={styles.saveText}>{saving ? "Saving..." : "Continue"}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(colors: any, shadows: any, borderRadius: any) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.main,
    padding: 16,
    justifyContent: "center",
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 20,
    ...shadows.medium,
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: colors.primary.darkBlue,
    marginBottom: 6,
  },
  subtitle: {
    color: colors.text.secondary,
    marginBottom: 16,
    lineHeight: 20,
  },
  avatarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  avatarChoice: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: colors.background.main,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  avatarChoiceSelected: {
    borderColor: colors.primary.blue,
  },
  avatarChoiceImage: {
    width: 46,
    height: 46,
    borderRadius: 12,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.ui.border,
    borderRadius: borderRadius.medium,
    padding: 14,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.background.card,
    marginBottom: 14,
  },
  saveButton: {
    backgroundColor: colors.button.submit,
    borderRadius: borderRadius.large,
    padding: 16,
    alignItems: "center",
    ...shadows.small,
  },
  saveText: {
    color: colors.text.light,
    fontWeight: "900",
    fontSize: 16,
  },
  });
}

