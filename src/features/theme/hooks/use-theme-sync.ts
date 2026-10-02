import { useEffect } from "react"
import { useSelector } from "react-redux"

import { applyTheme, getDarkSchemeQuery, resolveTheme } from "@/shared/theme/theme-storage"

import { selectThemePreference } from "../theme-slice"

/**
 * Mounted once at the app root. Keeps `<html class="dark">` in line with the stored preference and,
 * while the preference is `system`, follows OS theme changes live without a reload (UX-DR5).
 */
export function useThemeSync() {
  const preference = useSelector(selectThemePreference)

  useEffect(() => {
    applyTheme(resolveTheme(preference))
    if (preference !== "system") {
      return
    }

    const query = getDarkSchemeQuery()
    if (!query) {
      return
    }
    const onChange = (event: MediaQueryListEvent) => applyTheme(resolveTheme("system", event.matches))
    query.addEventListener("change", onChange)
    return () => query.removeEventListener("change", onChange)
  }, [preference])
}
