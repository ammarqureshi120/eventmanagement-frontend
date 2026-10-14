import type { createBrowserRouter } from "react-router"

import { baseApi } from "@/shared/api/base-api"
import { setUnauthorizedHandler } from "@/shared/api/unauthorized"
import { loginPathFor } from "@/shared/auth"

import type { AppStore } from "./store"

type AppRouter = Pick<ReturnType<typeof createBrowserRouter>, "state" | "navigate">

function isProtected(handle: unknown): boolean {
  return typeof handle === "object" && handle !== null && (handle as { requiresAuth?: unknown }).requiresAuth === true
}

/**
 * UX-DR11: when any API call says the session is gone (401 `session_expired`) while a protected route
 * is shown, drop the cached server state and go to `/login?returnTo=<path+search>`. Public routes
 * (`/login`, Not found when signed out) stay put. During a navigation the cache is still reset, and
 * the destination's `RequireAuth` redirects.
 * Returns the unregister function.
 */
export function registerUnauthorizedRedirect(router: AppRouter, store: Pick<AppStore, "dispatch">): () => void {
  return setUnauthorizedHandler(() => {
    const { location, matches, navigation } = router.state
    if (navigation.state !== "idle") {
      // A navigation is under way: drop the stale session (old /api/me included) and let the
      // destination's guard (RequireAuth) send the user to sign in.
      store.dispatch(baseApi.util.resetApiState())
      return
    }
    if (!matches.some((match) => isProtected(match.route.handle))) {
      return
    }
    store.dispatch(baseApi.util.resetApiState())
    void router.navigate(loginPathFor(location), { replace: true })
  })
}
