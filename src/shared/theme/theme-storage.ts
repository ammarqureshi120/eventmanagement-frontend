/**
 * Theme preference storage and application (FR34, UX-DR4/5, AD-23). Framework-free.
 *
 * Same rules as the inline no-flash script in `index.html` (keep them in sync):
 * the key is `eventhub-theme`, values `light | dark | system`, anything else (or blocked storage)
 * means `system`, and `system` follows `prefers-color-scheme`. Every browser API call is wrapped in
 * try/catch so private mode or blocked storage never breaks the page.
 */
export const THEME_STORAGE_KEY = "eventhub-theme"

export const THEME_PREFERENCES = ["light", "dark", "system"] as const

export type ThemePreference = (typeof THEME_PREFERENCES)[number]
export type ResolvedTheme = Exclude<ThemePreference, "system">

export const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)"

export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && (THEME_PREFERENCES as readonly string[]).includes(value)
}

/** The stored preference; `system` when nothing (or an unknown value) is stored or storage throws. */
export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isThemePreference(stored) ? stored : "system"
  } catch {
    return "system"
  }
}

/** Saves the preference. Returns false when storage is unavailable (the choice then lasts for the session only). */
export function writeThemePreference(preference: ThemePreference): boolean {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference)
    return true
  } catch {
    return false
  }
}

/** The OS colour-scheme media query, or null where `matchMedia` is unavailable. */
export function getDarkSchemeQuery(): MediaQueryList | null {
  try {
    return typeof window.matchMedia === "function" ? window.matchMedia(DARK_SCHEME_QUERY) : null
  } catch {
    return null
  }
}

export function systemPrefersDark(): boolean {
  return getDarkSchemeQuery()?.matches ?? false
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean = systemPrefersDark()): ResolvedTheme {
  if (preference === "light" || preference === "dark") {
    return preference
  }
  return prefersDark ? "dark" : "light"
}

/** Sets or removes the `dark` class on `<html>`. */
export function applyTheme(theme: ResolvedTheme, root: HTMLElement | null = globalThis.document?.documentElement ?? null) {
  try {
    root?.classList.toggle("dark", theme === "dark")
  } catch {
    // Nothing to do: without a document there is nothing to theme.
  }
}
