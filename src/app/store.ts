import { configureStore } from "@reduxjs/toolkit"
import { setupListeners } from "@reduxjs/toolkit/query"

import { baseApi } from "@/shared/api/base-api"

import "./api-enhance"

/**
 * AD-2: server state lives only in RTK Query; Redux slices hold UI/session preferences only
 * (theme, sidebar, dismissed banners) and are added here as features need them.
 */
export function createStore() {
  const store = configureStore({
    reducer: {
      [baseApi.reducerPath]: baseApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
  })
  setupListeners(store.dispatch)
  return store
}

export type AppStore = ReturnType<typeof createStore>
export type RootState = ReturnType<AppStore["getState"]>
export type AppDispatch = AppStore["dispatch"]
