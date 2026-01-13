import React, { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../AppRoot";
import { supabase } from "../lib/supabase";
import { useTheme } from "../theme/theme";

type Props = NativeStackScreenProps<RootStackParamList, "UpgradeAccount">;

export function UpgradeAccountScreen({ navigation, route }: Props) {
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  const postUpgradeTo = route.params?.postUpgradeTo ?? "Paywall";

  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const e = email.trim();
    if (!e) return;
    try {
      setBusy(true);
      // Link the anonymous user to an email address, then send OTP.
      const upd = await supabase.auth.updateUser({ email: e });
      if (upd.error) throw upd.error;
      const { error } = await supabase.auth.signInWithOtp({ email: e });
      if (error) throw error;
      setStep("code");
      Alert.alert("Check your email", "Enter the 6‑digit code to finish creating your account.");
    } catch (err: any) {
      Alert.alert("Couldn't send code", err?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    const e = email.trim();
    const t = token.trim();
    if (!e || !t) return;
    try {
      setBusy(true);
      const { error } = await supabase.auth.verifyOtp({ email: e, token: t, type: "email" });
      if (error) throw error;

      // Immediately take the user to Premium.
      if (postUpgradeTo === "Paywall") {
        navigation.replace("Paywall");
      } else {
        navigation.goBack();
      }
    } catch (err: any) {
      Alert.alert("Verification failed", err?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={styles.container}
    >
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>Create an account</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.subtitle}>
          You’re currently playing as a guest. Create an account to unlock MindShiftz Premium and keep your progress.
        </Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={colors.text.muted}
          style={styles.input}
          editable={!busy}
        />

        {step === "code" ? (
          <>
            <Text style={[styles.label, { marginTop: 12 }]}>6‑digit code</Text>
            <TextInput
              value={token}
              onChangeText={setToken}
              keyboardType="number-pad"
              placeholder="123456"
              placeholderTextColor={colors.text.muted}
              style={styles.input}
              editable={!busy}
            />
          </>
        ) : null}

        <Pressable
          accessibilityRole="button"
          disabled={busy || !email.trim() || (step === "code" && !token.trim())}
          onPress={step === "email" ? send : verify}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && { opacity: 0.92 },
            (busy || !email.trim() || (step === "code" && !token.trim())) && styles.primaryButtonDisabled,
          ]}
        >
          <Text style={styles.primaryButtonText}>
            {step === "email" ? "Send code" : "Verify & continue to Premium"}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: any, shadows: any, borderRadius: any) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background.main, padding: 16, justifyContent: "center" },
    topBar: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
    back: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background.card,
      ...shadows.small,
    },
    backText: { fontSize: 22, fontWeight: "900", color: colors.text.primary, marginTop: -2 },
    title: { flex: 1, textAlign: "center", fontWeight: "900", fontSize: 16, color: colors.text.primary },
    card: {
      backgroundColor: colors.background.card,
      borderRadius: borderRadius.xl,
      padding: 18,
      ...shadows.medium,
    },
    subtitle: { color: colors.text.secondary, lineHeight: 20, marginBottom: 12 },
    label: { color: colors.text.primary, fontWeight: "700", marginBottom: 6 },
    input: {
      borderWidth: 2,
      borderColor: colors.ui.border,
      borderRadius: borderRadius.medium,
      padding: 14,
      fontSize: 16,
      color: colors.text.primary,
      backgroundColor: colors.background.card,
    },
    primaryButton: {
      marginTop: 14,
      backgroundColor: colors.primary.blue,
      borderRadius: borderRadius.large,
      padding: 16,
      alignItems: "center",
      ...shadows.small,
    },
    primaryButtonDisabled: { backgroundColor: colors.text.muted },
    primaryButtonText: { color: colors.text.light, fontWeight: "800" },
  });
}

