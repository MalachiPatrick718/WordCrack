import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, findNodeHandle, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from "react-native";
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

const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

function canonicalizeState(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const up = raw.toUpperCase();
  const byCode = US_STATES.find((s) => s.code === up);
  if (byCode) return byCode.code;
  const low = raw.toLowerCase();
  const byName = US_STATES.find((s) => s.name.toLowerCase() === low);
  if (byName) return byName.code;
  return null;
}

export function ProfileSetupScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  const scrollRef = useRef<ScrollView>(null);
  const stateInputRef = useRef<TextInput>(null);
  const [username, setUsername] = useState(route.params?.initialUsername ?? "");
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState<string>(route.params?.initialAvatarUrl ?? avatarUrlForSeed(AVATAR_SEEDS[0]!));
  const [stateCode, setStateCode] = useState("");
  const [stateQuery, setStateQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const avatarChoices = useMemo(() => AVATAR_SEEDS.map((s) => avatarUrlForSeed(s)), []);
  const stateSuggestions = useMemo(() => {
    const q = stateQuery.trim().toLowerCase();
    if (!q) return [];
    const starts = US_STATES.filter((s) => s.code.toLowerCase().startsWith(q) || s.name.toLowerCase().startsWith(q));
    const contains = US_STATES.filter(
      (s) => !starts.includes(s) && (s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)),
    );
    return [...starts, ...contains].slice(0, 6);
  }, [stateQuery]);
  const stateIsValid = useMemo(() => {
    if (!stateCode.trim() && !stateQuery.trim()) return true; // optional
    if (stateCode.trim()) return true;
    return canonicalizeState(stateQuery) != null;
  }, [stateCode, stateQuery]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) return;
      try {
        const { data } = await supabase
          .from("profiles")
          .select("username,avatar_url,location")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!mounted) return;
        if (data?.username && (!route.params?.initialUsername || route.params.initialUsername === "player" || route.params.initialUsername.startsWith("player_"))) {
          setUsername(data.username);
        }
        if (data?.avatar_url) setSelectedAvatarUrl(data.avatar_url);
        if (data?.location) {
          const canon = canonicalizeState(String(data.location));
          if (canon) {
            setStateCode(canon);
            setStateQuery("");
          } else {
            // fallback: show whatever was stored previously
            setStateCode("");
            setStateQuery(String(data.location));
          }
        }
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
    const picked = stateCode.trim() ? stateCode.trim().toUpperCase() : canonicalizeState(stateQuery) ?? null;
    if (picked == null && stateQuery.trim()) {
      return Alert.alert("Pick a real state", "Select a state from the suggestions (or leave it blank).");
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update({ username: u, avatar_url: selectedAvatarUrl, location: picked })
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets
      >
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
            returnKeyType="next"
          />

          <Text style={styles.label}>State (optional)</Text>
          <TextInput
            ref={stateInputRef}
            autoCapitalize="characters"
            placeholder="Start typing (e.g., CA or California)"
            placeholderTextColor={colors.text.muted}
            value={stateCode || stateQuery}
            onChangeText={(t) => {
              setStateCode("");
              setStateQuery(t);
            }}
            style={[styles.input, !stateIsValid && { borderColor: colors.primary.red }]}
            onFocus={() => {
              // Force-scroll this input above the keyboard (KeyboardAvoidingView isn't always enough on smaller screens).
              const node = findNodeHandle(stateInputRef.current);
              const responder = (scrollRef.current as any)?.getScrollResponder?.();
              if (!node || !responder?.scrollResponderScrollNativeHandleToKeyboard) return;
              setTimeout(() => {
                try {
                  responder.scrollResponderScrollNativeHandleToKeyboard(node, 120, true);
                } catch {
                  // ignore
                }
              }, 50);
            }}
          />
          {Boolean(stateQuery.trim()) && stateSuggestions.length > 0 ? (
            <View style={styles.suggestions}>
              {stateSuggestions.map((s) => (
                <Pressable
                  key={s.code}
                  accessibilityRole="button"
                  onPress={() => {
                    setStateCode(s.code);
                    setStateQuery("");
                  }}
                  style={({ pressed }) => [styles.suggestionRow, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.suggestionText}>{s.name}</Text>
                  <Text style={styles.suggestionCode}>{s.code}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.hintText}>Choose from the suggestions to avoid typos.</Text>
          )}

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: any, shadows: any, borderRadius: any) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.main,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
    justifyContent: "center",
    flexGrow: 1,
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
  hintText: {
    color: colors.text.muted,
    fontSize: 12,
    marginTop: -6,
    marginBottom: 14,
  },
  suggestions: {
    backgroundColor: colors.background.main,
    borderRadius: borderRadius.medium,
    borderWidth: 1,
    borderColor: colors.ui.border,
    marginTop: -6,
    marginBottom: 14,
    overflow: "hidden",
  },
  suggestionRow: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.ui.border,
  },
  suggestionText: {
    color: colors.text.primary,
    fontWeight: "700",
  },
  suggestionCode: {
    color: colors.text.secondary,
    fontWeight: "800",
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

