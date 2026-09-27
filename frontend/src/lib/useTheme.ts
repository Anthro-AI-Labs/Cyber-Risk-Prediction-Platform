"use client";

import { useCallback, useEffect, useState } from "react";

const THEME_KEY = "cyber_validator_theme";

/**
 * Light is the default (as in the specification and the reference prototype). The viewer's toggle
 * choice is remembered in localStorage; if storage is unavailable the page simply stays light.
 */
export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(THEME_KEY) === "dark";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }, [isDark]);

  const toggleTheme = useCallback(() => {
    setIsDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(THEME_KEY, next ? "dark" : "light");
      } catch {}
      return next;
    });
  }, []);

  return { isDark, toggleTheme };
}
