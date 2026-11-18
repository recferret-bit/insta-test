/**
 * Theme preference (frontend/03-design-system.md): `light` / `dark` / `system` in `localStorage["insta.theme"]`;
 * sets or removes `data-theme` on `<html>`. `public/theme-init.js` applies the same rule before first paint.
 */
import { useSyncExternalStore } from "react";

export const THEME_STORAGE_KEY = "insta.theme";
export type ThemePreference = "light" | "dark" | "system";
export const THEME_PREFERENCES: readonly ThemePreference[] = ["light", "dark", "system"];

function readPreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

let preference: ThemePreference = typeof window === "undefined" ? "system" : readPreference();
const listeners = new Set<() => void>();

export function applyThemePreference(
  pref: ThemePreference,
  root: HTMLElement = document.documentElement,
): void {
  if (pref === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", pref);
}

export function getThemePreference(): ThemePreference {
  return preference;
}

export function setThemePreference(next: ThemePreference): void {
  preference = next;
  try {
    if (next === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, next);
  } catch {
    /* storage unavailable: preference lasts for this page view */
  }
  applyThemePreference(next);
  for (const listener of listeners) listener();
}

/** The theme actually shown (resolves `system` with `prefers-color-scheme`). */
export function resolveTheme(pref: ThemePreference = preference): "light" | "dark" {
  if (pref !== "system") return pref;
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/** Cycles light → dark → system → light. */
export function nextThemePreference(pref: ThemePreference): ThemePreference {
  return pref === "light" ? "dark" : pref === "dark" ? "system" : "light";
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== THEME_STORAGE_KEY) return;
    preference = readPreference();
    applyThemePreference(preference);
    listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getThemePreference, getThemePreference);
}
