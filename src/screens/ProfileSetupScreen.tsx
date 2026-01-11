import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, findNodeHandle, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View, StyleSheet } from "react-native";
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
  // Use a style that naturally varies skin tone + expression while still being deterministic per seed.
  return `https://api.dicebear.com/9.x/adventurer/png?seed=${encodeURIComponent(seed)}`;
}

function randomInviteCode(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
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
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const avatarChoices = useMemo(() => {
    // Add variety by mixing base seeds with a deterministic "-alt" variant and trimming to a friendly grid size.
    const seeds = AVATAR_SEEDS.flatMap((s) => [s, `${s}-alt`]).slice(0, 36);
    return seeds.map((s) => avatarUrlForSeed(s));
  }, []);
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
      // Try update first (normal path).
      // NOTE: Supabase returns `data: null` for update() unless you chain .select().
      // We need the row count to know whether the profile already exists.
      const { data: updated, error: updErr } = await supabase
        .from("profiles")
        .update({ username: u, avatar_url: selectedAvatarUrl, location: picked })
        .select("user_id")
        .eq("user_id", user.id);
      if (updErr) throw updErr;

      // If the profile row doesn't exist (older accounts / trigger issues), create it.
      // Supabase doesn't always surface "0 rows updated" as an error, so we explicitly check.
      const updatedCount = Array.isArray(updated) ? updated.length : updated ? 1 : 0;
      if (updatedCount === 0) {
        // Insert with a generated invite_code. Retry a few times for rare collisions.
        let lastErr: any = null;
        for (let i = 0; i < 10; i++) {
          // Only change the username if we *actually* collide on username.
          const candidateUsername = i === 0 ? u : `${u}_${i}`;
          const code = randomInviteCode();
          const { error: insErr } = await supabase.from("profiles").insert({
            user_id: user.id,
            username: candidateUsername,
            avatar_url: selectedAvatarUrl,
            invite_code: code,
            location: picked,
          });
          if (!insErr) break;
          lastErr = insErr;
          const msg = String(insErr?.message ?? "").toLowerCase();
          const details = String((insErr as any)?.details ?? "").toLowerCase();
          const combined = `${msg} ${details}`;

          // Retry on uniqueness collisions (username/invite_code). Otherwise throw.
          if (combined.includes("duplicate") || combined.includes("unique")) {
            // If it's an invite_code collision, retry with same username but new code.
            if (combined.includes("invite") || combined.includes("invite_code")) {
              continue;
            }
            // If it's username collision, we'll retry with u_1, u_2, etc via candidateUsername.
            continue;
          }
          throw insErr;
        }
        if (lastErr) {
          // If we got here, we exhausted retries.
          throw lastErr;
        }
      }

      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (e: any) {
      const msg = String(e?.message ?? "Unknown error");
      const msgL = msg.toLowerCase();
      const details = String((e as any)?.details ?? "").toLowerCase();
      const combined = `${msgL} ${details}`;

      // Be precise: only show "Username taken" when it's actually the username constraint.
      if (combined.includes("profiles_username") || combined.includes("username") && (combined.includes("duplicate") || combined.includes("unique"))) {
        Alert.alert("Username taken", "Try a different username.");
      } else if (combined.includes("invite") && (combined.includes("duplicate") || combined.includes("unique"))) {
        Alert.alert("Try again", "We hit a rare invite code collision. Please press Save again.");
      } else if (
        combined.includes("violates foreign key constraint") ||
        combined.includes("profiles_user_id")
      ) {
        Alert.alert(
          "Session expired",
          "Your account session is no longer valid. Please sign in again.",
          [
            {
              text: "OK",
              onPress: () => {
                void supabase.auth.signOut();
                // BootRouter will switch to the Auth flow automatically once the session is cleared.
              },
            },
          ],
        );
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

          <Pressable
            accessibilityRole="button"
            onPress={() => setShowAvatarPicker(true)}
            style={({ pressed }) => [styles.chooseAvatarRow, pressed && { opacity: 0.9 }]}
          >
            <View style={styles.chooseAvatarCircle}>
              <Image source={{ uri: selectedAvatarUrl }} style={styles.chooseAvatarImage} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.chooseAvatarTitle}>Choose your avatar</Text>
              <Text style={styles.chooseAvatarSub}>Tap to pick a new look</Text>
            </View>
            <Text style={styles.chooseAvatarChevron}>›</Text>
          </Pressable>

          <Modal transparent visible={showAvatarPicker} animationType="fade" onRequestClose={() => setShowAvatarPicker(false)}>
            <View style={styles.modalOverlay}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Choose your avatar</Text>
                <View style={styles.avatarGrid}>
                  {avatarChoices.map((url) => {
                    const selected = url === selectedAvatarUrl;
                    return (
                      <Pressable
                        key={url}
                        accessibilityRole="button"
                        onPress={() => {
                          setSelectedAvatarUrl(url);
                          setShowAvatarPicker(false);
                        }}
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
                <Pressable accessibilityRole="button" onPress={() => setShowAvatarPicker(false)} style={({ pressed }) => [styles.modalClose, pressed && { opacity: 0.9 }]}>
                  <Text style={styles.modalCloseText}>Close</Text>
                </Pressable>
              </View>
            </View>
          </Modal>

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
  chooseAvatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: borderRadius.large,
    borderWidth: 1,
    borderColor: colors.ui.border,
    backgroundColor: colors.background.main,
    marginBottom: 16,
    ...shadows.small,
  },
  chooseAvatarCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    overflow: "hidden",
    backgroundColor: colors.background.card,
    borderWidth: 2,
    borderColor: colors.primary.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  chooseAvatarImage: {
    width: 54,
    height: 54,
  },
  chooseAvatarTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.text.primary,
  },
  chooseAvatarSub: {
    marginTop: 2,
    fontSize: 12,
    color: colors.text.secondary,
  },
  chooseAvatarChevron: {
    fontSize: 28,
    color: colors.text.muted,
    marginTop: -2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 16,
    ...shadows.large,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: colors.text.primary,
    textAlign: "center",
    marginBottom: 12,
  },
  modalClose: {
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: borderRadius.large,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.ui.border,
  },
  modalCloseText: { fontWeight: "900", color: colors.text.primary },
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

