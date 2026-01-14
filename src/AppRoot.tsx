import React, { useEffect, useState } from "react";
import { DarkTheme as NavDarkTheme, DefaultTheme as NavDefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "react-native";
import { AuthProvider, useAuth } from "./state/AuthProvider";
import { getJson } from "./lib/storage";
import { supabase } from "./lib/supabase";
import { IapProvider } from "./purchases/IapProvider";
import { OnboardingScreen } from "./screens/OnboardingScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PuzzleScreen } from "./screens/PuzzleScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { LeaderboardsScreen } from "./screens/LeaderboardsScreen";
import { StatsScreen } from "./screens/StatsScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { LegalScreen } from "./screens/LegalScreen";
import { ProfileSetupScreen } from "./screens/ProfileSetupScreen";
import { PaywallScreen } from "./screens/PaywallScreen";
import { HowToPlayScreen } from "./screens/HowToPlayScreen";
import { UpgradeAccountScreen } from "./screens/UpgradeAccountScreen";
import { ThemeProvider, useTheme } from "./theme/theme";
import { BootSplash } from "./components/BootSplash";

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Home: undefined;
  ProfileSetup: { initialUsername?: string; initialAvatarUrl?: string } | undefined;
  Paywall: undefined;
  UpgradeAccount: { postUpgradeTo?: "Paywall" | "Back" } | undefined;
  HowToPlay: undefined;
  Puzzle: { mode: "daily" | "practice"; variant: "cipher" | "scramble" };
  Results: {
    attemptId: string;
    mode: "daily" | "practice";
    variant: "cipher" | "scramble";
    solve_time_ms: number;
    penalty_ms: number;
    final_time_ms: number;
    hints_used_count: number;
    rank: number | null;
  };
  Leaderboards: { initialTab?: "global" | "cipher" | "scramble" | "friends" } | undefined;
  Stats: undefined;
  Settings: undefined;
  Legal: { doc: "privacy" | "terms" };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function BootRouter() {
  const { user, initializing } = useAuth();
  const theme = useTheme();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<{ username: string; avatar_url: string | null } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileTimedOut, setProfileTimedOut] = useState(false);
  const [profileChecked, setProfileChecked] = useState(false);
  const BOOT_MIN_MS = 3200; // ~3–4s branded boot splash
  const BOOT_MAX_MS = 12_000; // never mask a real hang forever
  const [minElapsed, setMinElapsed] = useState(false);
  const [maxElapsed, setMaxElapsed] = useState(false);

  useEffect(() => {
    const minT = setTimeout(() => setMinElapsed(true), BOOT_MIN_MS);
    const maxT = setTimeout(() => setMaxElapsed(true), BOOT_MAX_MS);
    return () => {
      clearTimeout(minT);
      clearTimeout(maxT);
    };
  }, []);

  useEffect(() => {
    // Keep the storage read in this file to avoid coupling boot logic to the onboarding UI.
    let mounted = true;
    const timeout = setTimeout(() => {
      if (!mounted) return;
      // Safety: never block boot forever on a storage read.
      setOnboarded(false);
    }, 3000);
    getJson<boolean>("mindshift:onboarded")
      .then((v) => {
        if (!mounted) return;
        setOnboarded(v ?? false);
      })
      .catch(() => {
        if (!mounted) return;
        setOnboarded(false);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      mounted = false;
      clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!user) {
        if (mounted) {
          setProfile(null);
          setProfileChecked(true);
          setProfileTimedOut(false);
          setProfileLoading(false);
        }
        return;
      }
      try {
        if (mounted) setProfileLoading(true);
        if (mounted) setProfileTimedOut(false);
        if (mounted) setProfileChecked(false);
        const req = supabase
          .from("profiles")
          .select("username,avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();
        // Safety: don't allow a network hang to keep the app on a spinner forever.
        const result = await Promise.race([
          req.then((r) => ({ kind: "ok" as const, data: (r as any)?.data ?? null })),
          new Promise<{ kind: "timeout" }>((resolve) => setTimeout(() => resolve({ kind: "timeout" }), 8000)),
        ]);
        if (!mounted) return;
        if (result.kind === "timeout") {
          setProfileTimedOut(true);
          setProfileChecked(true);
          return;
        }
        if (result.data) setProfile({ username: result.data.username, avatar_url: result.data.avatar_url ?? null });
        setProfileChecked(true);
      } catch {
        // ignore
        if (mounted) setProfileChecked(true);
      } finally {
        if (mounted) setProfileLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const isAnonymous = Boolean((user as any)?.is_anonymous) || (user as any)?.app_metadata?.provider === "anonymous";
  // Profile setup is optional and can be edited from Settings.
  // We do NOT force users back into ProfileSetup on relaunch (this caused confusing, racey routing).

  // Important: avoid showing Home first on fresh signups.
  // Wait for auth + onboarding; do not block the app on profile fetch.
  const isBootBusy =
    initializing ||
    onboarded === null ||
    false;

  // Keep an in-app branded splash visible for a minimum duration,
  // but never block beyond a hard cap.
  if ((isBootBusy && !maxElapsed) || (!minElapsed && !maxElapsed)) {
    return <BootSplash subtitle={!minElapsed ? "Loading…" : "Almost there…"} />;
  }

  return (
    <Stack.Navigator
      key={!onboarded ? "onboarding" : !user ? "auth" : "app"}
      initialRouteName={
        !onboarded ? "Onboarding" : !user ? "Auth" : "Home"
      }
      screenOptions={{
        headerTintColor: theme.colors.text.primary,
        headerStyle: { backgroundColor: theme.colors.background.main },
      }}
    >
      {!onboarded ? (
        <Stack.Screen
          name="Onboarding"
          options={{ headerShown: false }}
        >
          {(props) => (
            <OnboardingScreen
              {...props}
              onComplete={() => setOnboarded(true)}
            />
          )}
        </Stack.Screen>
      ) : !user ? (
        <Stack.Screen name="Auth" component={AuthScreen} options={{ headerShown: false }} />
      ) : (
        <>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{
              title: "",
              headerStyle: { backgroundColor: theme.colors.background.main },
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="ProfileSetup"
            component={ProfileSetupScreen}
            options={{ title: "Profile" }}
            initialParams={{
              initialUsername: profile?.username ?? "player",
              initialAvatarUrl: profile?.avatar_url ?? undefined,
            }}
          />
          <Stack.Screen
            name="Puzzle"
            component={PuzzleScreen}
            options={({ route }) => ({
              title: route.params?.variant === "cipher" ? "Cipher Puzzle" : "Scramble Puzzle",
              gestureEnabled: false,
            })}
          />
          <Stack.Screen name="Results" component={ResultsScreen} options={{ title: "Results" }} />
          <Stack.Screen name="Leaderboards" component={LeaderboardsScreen} options={{ title: "Leaderboards" }} />
          <Stack.Screen name="Stats" component={StatsScreen} options={{ title: "Stats" }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
          <Stack.Screen name="Legal" component={LegalScreen} options={{ title: "Legal" }} />
          <Stack.Screen
            name="Paywall"
            component={PaywallScreen}
            options={{ headerShown: false, presentation: "modal" }}
          />
          <Stack.Screen
            name="UpgradeAccount"
            component={UpgradeAccountScreen}
            options={{ headerShown: false, presentation: "modal" }}
          />
          <Stack.Screen
            name="HowToPlay"
            component={HowToPlayScreen}
            options={{ headerShown: false, presentation: "modal" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export function AppRoot() {
  return (
    <ThemeProvider>
      <ThemedApp />
    </ThemeProvider>
  );
}

function ThemedApp() {
  const { mode, colors } = useTheme();

  const navTheme = React.useMemo(() => {
    const base = mode === "dark" ? NavDarkTheme : NavDefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.primary.blue,
        background: colors.background.main,
        card: colors.background.card,
        text: colors.text.primary,
        border: colors.ui.border,
        notification: colors.primary.yellow,
      },
    };
  }, [mode, colors]);

  return (
    <AuthProvider>
      <IapProvider>
        <StatusBar barStyle={mode === "dark" ? "light-content" : "dark-content"} />
        <NavigationContainer theme={navTheme}>
          <BootRouter />
        </NavigationContainer>
      </IapProvider>
    </AuthProvider>
  );
}

// (moved to src/lib/onboarding.ts to avoid a require cycle)


