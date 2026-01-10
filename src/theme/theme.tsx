import React, { createContext, useCallback, useEffect, useMemo, useState } from "react";
import { Appearance, type ColorSchemeName } from "react-native";
import { getJson, setJson } from "../lib/storage";
import { borderRadius, getColors, makeShadows, type ThemeMode } from "./colors";

export type ThemePreference = "system" | ThemeMode;

type ThemeContextValue = {
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (pref: ThemePreference) => void;
  colors: ReturnType<typeof getColors>;
  shadows: ReturnType<typeof makeShadows>;
  borderRadius: typeof borderRadius;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "wordcrack:themePreference";

function schemeToMode(s: ColorSchemeName): ThemeMode {
  return s === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  useEffect(() => {
    let mounted = true;
    getJson<ThemePreference>(STORAGE_KEY).then((pref) => {
      if (!mounted) return;
      if (pref === "light" || pref === "dark" || pref === "system") setPreferenceState(pref);
    });
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystemScheme(colorScheme));
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    void setJson(STORAGE_KEY, pref);
  }, []);

  const mode: ThemeMode = preference === "system" ? schemeToMode(systemScheme) : preference;
  const colors = useMemo(() => getColors(mode), [mode]);
  const shadows = useMemo(() => makeShadows(colors), [colors]);

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, preference, setPreference, colors, shadows, borderRadius }),
    [mode, preference, setPreference, colors, shadows],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

