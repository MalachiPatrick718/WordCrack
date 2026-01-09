import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "./state/AuthProvider";
import { getJson, setJson } from "./lib/storage";
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

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Home: undefined;
  ProfileSetup: { initialUsername?: string; initialAvatarUrl?: string } | undefined;
  Paywall: undefined;
  Puzzle: { mode: "daily" | "practice" };
  Results: {
    attemptId: string;
    solve_time_ms: number;
    penalty_ms: number;
    final_time_ms: number;
    hints_used_count: number;
    rank: number | null;
  };
  Leaderboards: undefined;
  Stats: undefined;
  Settings: undefined;
  Legal: { doc: "privacy" | "terms" };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function BootRouter() {
  const { user, initializing } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [profile, setProfile] = useState<{ username: string; avatar_url: string | null } | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    getJson<boolean>("wordcrack:onboarded").then((v) => setOnboarded(v ?? false));
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
        const { data } = await supabase
          .from("profiles")
          .select("username,avatar_url")
          .eq("user_id", user.id)
          .maybeSingle();
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
    !!profile &&
    (profile.username === "player" || profile.username.startsWith("player_") || !profile.avatar_url);

  // Important: avoid showing Home first on fresh signups.
  // Wait for profile to load for signed-in non-guest users, then choose the initial route.
  if (user && !isAnonymous && (profileLoading || !profile)) {
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
        <Stack.Screen name="Auth" component={AuthScreen} options={{ title: "WordCrack" }} />
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
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "WordCrack" }} />
          <Stack.Screen name="Puzzle" component={PuzzleScreen} options={{ title: "Today's Puzzle" }} />
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
        </>
      )}
    </Stack.Navigator>
  );
}

export function AppRoot() {
  return (
    <AuthProvider>
      <IapProvider>
        <NavigationContainer>
          <BootRouter />
        </NavigationContainer>
      </IapProvider>
    </AuthProvider>
  );
}

export async function markOnboarded() {
  await setJson("wordcrack:onboarded", true);
}


