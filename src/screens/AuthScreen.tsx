import React, { useEffect, useMemo, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, StyleSheet } from "react-native";
import { useAuth } from "../state/AuthProvider";
import { useTheme } from "../theme/theme";

const RESEND_COOLDOWN_MS = 30_000;

export function AuthScreen() {
  const { signInGuest, signInWithEmailOtp, verifyEmailOtp } = useAuth();
  const { colors, shadows, borderRadius } = useTheme();
  const styles = useMemo(() => makeStyles(colors, shadows, borderRadius), [colors, shadows, borderRadius]);
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendReadyAt, setResendReadyAt] = useState<number>(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!otpSent) return;
    const id = setInterval(() => setTick((t) => t + 1), 250);
    return () => clearInterval(id);
  }, [otpSent]);

  const resendRemainingMs = useMemo(() => Math.max(0, resendReadyAt - Date.now()), [resendReadyAt, tick]);
  const canResend = otpSent && !busy && resendRemainingMs <= 0 && email.trim().length >= 3;
  const resendLabel = useMemo(() => {
    if (resendRemainingMs <= 0) return "Resend code";
    const s = Math.ceil(resendRemainingMs / 1000);
    return `Resend code (${s}s)`;
  }, [resendRemainingMs]);

  const sendOtp = async () => {
    try {
      setBusy(true);
      await signInWithEmailOtp(email.trim());
      setOtpSent(true);
      setResendReadyAt(Date.now() + RESEND_COOLDOWN_MS);
      Alert.alert("Check your email", "Enter the 6-digit code to sign in.");
    } catch (e: any) {
      const details = [e?.message, e?.status ? `status: ${e.status}` : null, e?.code ? `code: ${e.code}` : null]
        .filter(Boolean)
        .join("\n");
      Alert.alert("Sign-in failed", details || "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    try {
      setBusy(true);
      await verifyEmailOtp(email.trim(), token.trim());
    } catch (e: any) {
      Alert.alert("Verification failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  const guest = async () => {
    try {
      setBusy(true);
      await signInGuest();
    } catch (e: any) {
      Alert.alert("Guest sign-in failed", e?.message ?? "Unknown error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding", android: undefined })}
      style={styles.container}
    >
      {/* Logo */}
      <View style={styles.logoCard}>
        <Image
          source={require("../../assets/icon.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Welcome Card */}
      <View style={styles.card}>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.subtitle}>
          Sign in to compete on leaderboards and sync your progress across devices.
        </Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.text.muted}
              value={email}
              onChangeText={setEmail}
              style={styles.input}
            />
          </View>

          {otpSent && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>OTP Code</Text>
              <TextInput
                keyboardType="number-pad"
                placeholder="123456"
                placeholderTextColor={colors.text.muted}
                value={token}
                onChangeText={setToken}
                style={styles.input}
              />
              <Pressable
                accessibilityRole="button"
                disabled={!canResend}
                onPress={async () => {
                  try {
                    setBusy(true);
                    await signInWithEmailOtp(email.trim());
                    setResendReadyAt(Date.now() + RESEND_COOLDOWN_MS);
                    Alert.alert("Code resent", "Check your email for a new 6-digit code.");
                  } catch (e: any) {
                    Alert.alert("Resend failed", e?.message ?? "Unknown error");
                  } finally {
                    setBusy(false);
                  }
                }}
                style={({ pressed }) => [
                  styles.resendButton,
                  !canResend && styles.resendButtonDisabled,
                  pressed && canResend && { opacity: 0.9 },
                ]}
              >
                <Text style={[styles.resendText, !canResend && styles.resendTextDisabled]}>{resendLabel}</Text>
              </Pressable>
            </View>
          )}

          {!otpSent ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy || email.trim().length < 3}
              onPress={sendOtp}
              style={({ pressed }) => [
                styles.primaryButton,
                (busy || email.trim().length < 3) && styles.buttonDisabled,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.primaryButtonText}>Send OTP</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={busy || token.trim().length < 4}
              onPress={verify}
              style={({ pressed }) => [
                styles.verifyButton,
                (busy || token.trim().length < 4) && styles.buttonDisabled,
                pressed && { opacity: 0.9 },
              ]}
            >
              <Text style={styles.primaryButtonText}>Verify & Sign In</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Divider */}
      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>or</Text>
        <View style={styles.dividerLine} />
      </View>

      {/* Guest Button */}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={guest}
        style={({ pressed }) => [
          styles.guestButton,
          pressed && { opacity: 0.9 },
        ]}
      >
        <Text style={styles.guestButtonText}>Continue as Guest</Text>
        <Text style={styles.guestSubtext}>You can create an account later</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: any, shadows: any, borderRadius: any) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.main,
    padding: 20,
    justifyContent: "center",
  },
  logo: {
    width: 180,
    height: 110,
    alignSelf: "center",
    marginBottom: 24,
  },
  logoCard: {
    alignSelf: "center",
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    marginBottom: 14,
  },
  card: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: 24,
    ...shadows.medium,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: colors.primary.darkBlue,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: colors.text.secondary,
    lineHeight: 22,
    marginBottom: 20,
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  resendButton: {
    alignSelf: "flex-start",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: borderRadius.medium,
    marginTop: 6,
  },
  resendButtonDisabled: {
    opacity: 1,
  },
  resendText: {
    color: colors.primary.blue,
    fontSize: 13,
    fontWeight: "700",
  },
  resendTextDisabled: {
    color: colors.text.muted,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text.primary,
  },
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
    backgroundColor: colors.primary.blue,
    borderRadius: borderRadius.large,
    padding: 16,
    alignItems: "center",
    ...shadows.small,
  },
  verifyButton: {
    backgroundColor: colors.button.submit,
    borderRadius: borderRadius.large,
    padding: 16,
    alignItems: "center",
    ...shadows.small,
  },
  buttonDisabled: {
    backgroundColor: colors.text.muted,
  },
  primaryButtonText: {
    color: colors.text.light,
    fontSize: 16,
    fontWeight: "700",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.ui.border,
  },
  dividerText: {
    paddingHorizontal: 16,
    fontSize: 14,
    color: colors.text.muted,
  },
  guestButton: {
    backgroundColor: colors.background.card,
    borderWidth: 2,
    borderColor: colors.primary.blue,
    borderRadius: borderRadius.large,
    padding: 16,
    alignItems: "center",
    ...shadows.small,
  },
  guestButtonText: {
    color: colors.primary.blue,
    fontSize: 16,
    fontWeight: "700",
  },
  guestSubtext: {
    color: colors.text.secondary,
    fontSize: 12,
    marginTop: 4,
  },
  });
}
