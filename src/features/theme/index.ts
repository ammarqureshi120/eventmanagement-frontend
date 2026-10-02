/** Public API of the theme feature (AD-2). Other features and `app/` import only from here. */
export { ThemeToggle, type ThemeToggleProps } from "./components/theme-toggle"
export { useTheme } from "./hooks/use-theme"
export { useThemeSync } from "./hooks/use-theme-sync"
export {
  selectThemePreference,
  themePreferenceChanged,
  themeReducer,
  type ThemeRootState,
  type ThemeState,
} from "./theme-slice"
