import { useCallback } from "react"
import { useDispatch, useSelector } from "react-redux"

import {
  applyTheme,
  resolveTheme,
  writeThemePreference,
  type ThemePreference,
} from "@/shared/theme/theme-storage"

import { selectThemePreference, themePreferenceChanged } from "../theme-slice"

/** Current theme preference plus a setter that applies it instantly and saves it (UX-DR5). */
export function useTheme() {
  const preference = useSelector(selectThemePreference)
  const dispatch = useDispatch()

  const setPreference = useCallback(
    (next: ThemePreference) => {
      applyTheme(resolveTheme(next))
      // When storage is blocked the choice still applies for this session (state + class).
      writeThemePreference(next)
      dispatch(themePreferenceChanged(next))
    },
    [dispatch],
  )

  return { preference, setPreference }
}
