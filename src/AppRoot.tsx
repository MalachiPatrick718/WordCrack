import React, { useEffect, useState } from "react";
import { DarkTheme as NavDarkTheme, DefaultTheme as NavDefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, StatusBar, View } from "react-native";
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
        if (mounted) setProfile(null);
        return;
      }
      try {
        if (mounted) setProfileLoading(true);
        const req = supabase
          .from("profiles")
          .select("username,avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();
        // Safety: don't allow a network hang to keep the app on a spinner forever.
        const { data } = await Promise.race([
          req,
          new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 6000)),
        ]);
        if (!mounted) return;
        if (data) setProfile({ username: data.username, avatar_url: data.avatar_url ?? null });
      } catch {
        // ignore
      } finally {
        if (mounted) setProfileLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  if (initializing || onboarded === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  const isAnonymous = Boolean((user as any)?.is_anonymous) || (user as any)?.app_metadata?.provider === "anonymous";
  const needsProfileSetup =
    !!user &&
    !isAnonymous &&
    (!profile || profile.username === "player" || profile.username.startsWith("player_") || !profile.avatar_url);

  // Important: avoid showing Home first on fresh signups.
  // Wait for profile to load for signed-in non-guest users, then choose the initial route.
  if (user && !isAnonymous && profileLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack.Navigator
      key={!onboarded ? "onboarding" : !user ? "auth" : needsProfileSetup ? "profile-setup" : "home"}
      initialRouteName={
        !onboarded ? "Onboarding" : !user ? "Auth" : needsProfileSetup ? "ProfileSetup" : "Home"
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
            name="ProfileSetup"
            component={ProfileSetupScreen}
            options={{ title: "Profile" }}
            initialParams={{
              initialUsername: profile?.username ?? "player",
              initialAvatarUrl: profile?.avatar_url ?? undefined,
            }}
          />
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


