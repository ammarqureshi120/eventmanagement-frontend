import { createSlice, type PayloadAction } from "@reduxjs/toolkit"

import { readThemePreference, type ThemePreference } from "@/shared/theme/theme-storage"

/**
 * UI preference slice (AD-2): the chosen theme lives here so every toggle stays in sync.
 * The initial value is read lazily from storage, the same value the inline `index.html` script applied.
 */
export interface ThemeState {
  preference: ThemePreference
}

/** The slice of root state this feature reads (keeps the feature independent of `app/store`). */
export interface ThemeRootState {
  theme: ThemeState
}

const themeSlice = createSlice({
  name: "theme",
  initialState: (): ThemeState => ({ preference: readThemePreference() }),
  reducers: {
    themePreferenceChanged(state, action: PayloadAction<ThemePreference>) {
      state.preference = action.payload
    },
  },
})

export const { themePreferenceChanged } = themeSlice.actions
export const themeReducer = themeSlice.reducer

export const selectThemePreference = (state: ThemeRootState) => state.theme.preference
