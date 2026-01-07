import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { useAuth } from "../state/AuthProvider";

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
      Alert.alert("Sign-in failed", e?.message ?? "Unknown error");
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
      style={{ flex: 1, padding: 20, justifyContent: "center" }}
    >
      <Text style={{ fontSize: 28, fontWeight: "800", marginBottom: 8 }}>WordCrack</Text>
      <Text style={{ color: "#444", marginBottom: 16 }}>Sign in to compete on leaderboards and sync across devices.</Text>

      <View style={{ gap: 12 }}>
        <View>
          <Text style={{ fontWeight: "600", marginBottom: 6 }}>Email</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            value={email}
            onChangeText={setEmail}
            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12 }}
          />
        </View>

        {otpSent ? (
          <View>
            <Text style={{ fontWeight: "600", marginBottom: 6 }}>OTP Code</Text>
            <TextInput
              keyboardType="number-pad"
              placeholder="123456"
              value={token}
              onChangeText={setToken}
              style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 12, padding: 12 }}
            />
          </View>
        ) : null}

        {!otpSent ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy || email.trim().length < 3}
            onPress={sendOtp}
            style={({ pressed }) => ({
              backgroundColor: busy ? "#bbb" : "#6C5CE7",
              opacity: pressed ? 0.85 : 1,
              padding: 14,
              borderRadius: 12,
              alignItems: "center",
            })}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Send OTP</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={busy || token.trim().length < 4}
            onPress={verify}
            style={({ pressed }) => ({
              backgroundColor: busy ? "#bbb" : "#2ECC71",
              opacity: pressed ? 0.85 : 1,
              padding: 14,
              borderRadius: 12,
              alignItems: "center",
            })}
          >
            <Text style={{ color: "white", fontWeight: "700" }}>Verify & Sign In</Text>
          </Pressable>
        )}

        <View style={{ height: 12 }} />

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={guest}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderColor: "#ddd",
            opacity: pressed ? 0.85 : 1,
            padding: 14,
            borderRadius: 12,
            alignItems: "center",
          })}
        >
          <Text style={{ fontWeight: "700" }}>Continue as Guest</Text>
          <Text style={{ color: "#666", marginTop: 4, fontSize: 12 }}>You can upgrade to an account later.</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}


