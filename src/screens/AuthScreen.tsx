import React, { useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, StyleSheet } from "react-native";
import { useAuth } from "../state/AuthProvider";
import { colors, shadows, borderRadius } from "../theme/colors";

export function AuthScreen() {
  const { signInGuest, signInWithEmailOtp, verifyEmailOtp } = useAuth();
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);

  const sendOtp = async () => {
    try {
      setBusy(true);
      await signInWithEmailOtp(email.trim());
      setOtpSent(true);
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
      <Image
        source={require("../../assets/icon.png")}
        style={styles.logo}
        resizeMode="contain"
      />

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

const styles = StyleSheet.create({
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
