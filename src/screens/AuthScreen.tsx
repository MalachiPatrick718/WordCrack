import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, StyleSheet, Animated, ScrollView, type NativeSyntheticEvent, type TextInputKeyPressEventData } from "react-native";
import { useAuth } from "../state/AuthProvider";
import { useTheme } from "../theme/theme";

// Fun OTP digit input component with individual tappable boxes
function OTPDigitInput({
  value,
  onChangeText,
  colors,
  shadows,
  borderRadius: br,
  autoFocus,
}: {
  value: string;
  onChangeText: (text: string) => void;
  colors: any;
  shadows: any;
  borderRadius: any;
  autoFocus?: boolean;
}) {
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const digits = value.padEnd(6, " ").slice(0, 6).split("");
  const scaleAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(1))).current;
  const tileColors = colors.tiles;

  // Auto-focus first input when component mounts
  useEffect(() => {
    if (autoFocus) {
      const timer = setTimeout(() => inputRefs.current[0]?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [autoFocus]);

  const animateDigit = (idx: number) => {
    Animated.sequence([
      Animated.timing(scaleAnims[idx], { toValue: 1.15, duration: 80, useNativeDriver: true }),
      Animated.timing(scaleAnims[idx], { toValue: 1, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleDigitChange = (text: string, idx: number) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1); // Take only last digit entered
    if (digit) {
      // Update the value at this index
      const newDigits = digits.map((d, i) => (i === idx ? digit : d === " " ? "" : d));
      onChangeText(newDigits.join("").replace(/ /g, ""));
      animateDigit(idx);
      // Move to next input
      if (idx < 5) {
        inputRefs.current[idx + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>, idx: number) => {
    if (e.nativeEvent.key === "Backspace") {
      const currentDigit = digits[idx];
      if (currentDigit === " " || currentDigit === "") {
        // Current box is empty, move to previous and clear it
        if (idx > 0) {
          const newDigits = digits.map((d, i) => (i === idx - 1 ? "" : d === " " ? "" : d));
          onChangeText(newDigits.join(""));
          inputRefs.current[idx - 1]?.focus();
        }
      } else {
        // Clear current box
        const newDigits = digits.map((d, i) => (i === idx ? "" : d === " " ? "" : d));
        onChangeText(newDigits.join(""));
      }
    }
  };

  const handleBoxPress = (idx: number) => {
    inputRefs.current[idx]?.focus();
  };

  return (
    <View style={otpStyles.wrapper}>
      <View style={otpStyles.container}>
        {digits.map((digit, idx) => {
          const hasValue = digit !== " " && digit !== "";
          const isFocused = focusedIndex === idx;
          const bgColor = hasValue ? tileColors[idx % tileColors.length] : colors.background.card;
          return (
            <Pressable key={idx} onPress={() => handleBoxPress(idx)}>
              <Animated.View
                style={[
                  otpStyles.digitBox,
                  {
                    backgroundColor: bgColor,
                    borderColor: isFocused ? colors.primary.blue : hasValue ? bgColor : colors.ui.border,
                    borderWidth: isFocused ? 3 : 2,
                    borderRadius: br.medium,
                    transform: [{ scale: scaleAnims[idx] }],
                  },
                  shadows.small,
                ]}
              >
                <TextInput
                  ref={(ref) => (inputRefs.current[idx] = ref)}
                  value={hasValue ? digit : ""}
                  onChangeText={(text) => handleDigitChange(text, idx)}
                  onKeyPress={(e) => handleKeyPress(e, idx)}
                  onFocus={() => setFocusedIndex(idx)}
                  onBlur={() => setFocusedIndex(null)}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[
                    otpStyles.digitInput,
                    { color: hasValue ? colors.text.light : colors.text.muted },
                  ]}
                  caretHidden
                  contextMenuHidden
                  selectTextOnFocus
                />
              </Animated.View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const otpStyles = StyleSheet.create({
  wrapper: {
    width: "100%",
    paddingHorizontal: 4,
  },
  container: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  digitBox: {
    width: 46,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  digitInput: {
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    width: "100%",
    height: "100%",
    padding: 0,
  },
});

const RESEND_COOLDOWN_MS = 30_000;

// Test account credentials for development
const TEST_EMAIL = "test@wordcrack.dev";
const TEST_OTP = "123456";
const TEST_PASSWORD = "WordCrackMaster2026!";

export function AuthScreen() {
  const { signInGuest, signInWithEmailOtp, verifyEmailOtp, signInWithPassword } = useAuth();
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
      // Skip actual OTP for test account
      if (email.trim().toLowerCase() === TEST_EMAIL) {
        setOtpSent(true);
        // Test account uses code 123456
      } else {
        await signInWithEmailOtp(email.trim());
        setOtpSent(true);
        setResendReadyAt(Date.now() + RESEND_COOLDOWN_MS);
        // Go straight to the fun OTP entry screen - no popup needed
      }
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
      // Check for test account credentials
      if (email.trim().toLowerCase() === TEST_EMAIL && token.trim() === TEST_OTP) {
        await signInWithPassword(TEST_EMAIL, TEST_PASSWORD);
      } else {
        await verifyEmailOtp(email.trim(), token.trim());
      }
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
      behavior={Platform.select({ ios: "padding", android: "height" })}
      style={styles.container}
      keyboardVerticalOffset={Platform.select({ ios: 0, android: 20 })}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo - hide when OTP is shown to save space */}
        {!otpSent && (
          <View style={styles.logoCard}>
            <Image
              source={require("../../assets/icon.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
        )}

        {/* Welcome Card */}
        <View style={styles.card}>
          {!otpSent ? (
            <>
              <Text style={styles.title}>Welcome!</Text>
              <Text style={styles.subtitle}>
                Sign in to compete on leaderboards and sync your progress across devices.
              </Text>
            </>
          ) : null}

          <View style={styles.form}>
            {!otpSent && (
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
            )}

            {otpSent && (
              <View style={styles.otpSection}>
                <Text style={styles.otpEmoji}>🔐</Text>
                <Text style={styles.otpTitle}>Enter your secret code!</Text>
                <Text style={styles.otpSubtitle}>We sent a 6-digit code to {email}</Text>
                <OTPDigitInput
                  value={token}
                  onChangeText={setToken}
                  colors={colors}
                  shadows={shadows}
                  borderRadius={borderRadius}
                  autoFocus
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

        {/* Divider - only show when not in OTP mode */}
        {!otpSent && (
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
        )}

        {/* Guest Button - only show when not in OTP mode */}
        {!otpSent && (
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
        )}

        {/* Back button when in OTP mode */}
        {otpSent && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setOtpSent(false);
              setToken("");
            }}
            style={({ pressed }) => [
              styles.backButton,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.backButtonText}>← Use a different email</Text>
          </Pressable>
        )}
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  logo: {
    width: 220,
    height: 140,
    alignSelf: "center",
  },
  logoCard: {
    alignSelf: "center",
    backgroundColor: "transparent",
    borderRadius: 0,
    padding: 0,
    marginBottom: 20,
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
  otpSection: {
    alignItems: "center",
    paddingVertical: 8,
    gap: 8,
  },
  otpEmoji: {
    fontSize: 40,
    marginBottom: 4,
  },
  otpTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: colors.primary.darkBlue,
    textAlign: "center",
  },
  otpSubtitle: {
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: "center",
    marginBottom: 12,
  },
  resendButton: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: borderRadius.medium,
    marginTop: 12,
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
  backButton: {
    alignSelf: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  backButtonText: {
    color: colors.primary.blue,
    fontSize: 15,
    fontWeight: "600",
  },
  });
}
