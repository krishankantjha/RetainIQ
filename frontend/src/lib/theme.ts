import { useSyncExternalStore } from "react";

const THEME_KEY = "retainiq_theme";

export type ThemeMode = "dark" | "light";

export function getStoredTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "light" ? "light" : "dark";
}

export function applyTheme(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
  localStorage.setItem(THEME_KEY, mode);
}

export function toggleTheme(): ThemeMode {
  const next = getStoredTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}

export function initTheme(): void {
  applyTheme(getStoredTheme());
}

function subscribeTheme(onStoreChange: () => void): () => void {
  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => observer.disconnect();
}

export function useTheme(): ThemeMode {
  return useSyncExternalStore(subscribeTheme, getStoredTheme, () => "dark");
}
