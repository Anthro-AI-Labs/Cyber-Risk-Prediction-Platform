"use client";

import { useCallback, useEffect } from "react";
import { useStoredChoice } from "./useStoredChoice";

const THEME_KEY = "cyber_validator_theme";
const THEMES = ["light", "dark"] as const;

/**
 * Light is the default (as in the specification and the reference prototype). The viewer's toggle
 * choice is remembered in localStorage; if storage is unavailable the choice lasts for the session.
 */
export function useTheme() {
  const [theme, setTheme] = useStoredChoice(THEME_KEY, THEMES, "light");
  const isDark = theme === "dark";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme(isDark ? "light" : "dark"), [isDark, setTheme]);

  return { isDark, toggleTheme };
}
