import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { AuthProvider, useAuth } from "./state/AuthProvider";
import { getJson, setJson } from "./lib/storage";
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

export type RootStackParamList = {
  Onboarding: undefined;
  Auth: undefined;
  Home: undefined;
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

  useEffect(() => {
    getJson<boolean>("wordcrack:onboarded").then((v) => setOnboarded(v ?? false));
  }, []);

  if (initializing || onboarded === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <Stack.Navigator>
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
          <Stack.Screen name="Home" component={HomeScreen} options={{ title: "WordCrack" }} />
          <Stack.Screen name="Puzzle" component={PuzzleScreen} options={{ title: "Today's Puzzle" }} />
          <Stack.Screen name="Results" component={ResultsScreen} options={{ title: "Results" }} />
          <Stack.Screen name="Leaderboards" component={LeaderboardsScreen} options={{ title: "Leaderboards" }} />
          <Stack.Screen name="Stats" component={StatsScreen} options={{ title: "Stats" }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: "Settings" }} />
          <Stack.Screen name="Legal" component={LegalScreen} options={{ title: "Legal" }} />
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


