"use client";

import { useCallback, useSyncExternalStore } from "react";

const CHANGE_EVENT = "cyber-validator-stored-choice";
const memory: Record<string, string> = {}; // used when localStorage is unavailable

function read(key: string): string | null {
  try {
    const v = localStorage.getItem(key);
    if (v !== null) return v;
  } catch {}
  return memory[key] ?? null;
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * A viewer choice remembered in localStorage. Hydration-safe: the server render and the first
 * client render use `fallback`; React then switches to the stored value without a mismatch.
 */
export function useStoredChoice<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T
): [T, (next: T) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      const v = read(key);
      return v !== null && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
    },
    () => fallback
  );

  const set = useCallback(
    (next: T) => {
      memory[key] = next;
      try {
        localStorage.setItem(key, next);
      } catch {}
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key]
  );

  return [value, set];
}
