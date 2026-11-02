import type { createBrowserRouter } from "react-router"

import { baseApi } from "@/shared/api/base-api"
import { setUnauthorizedHandler } from "@/shared/api/unauthorized"
import { clearSessionActive, postSessionMessage, type SessionEndReason } from "@/shared/auth/session-timer"

import { sessionEndTarget } from "./session/end-session"
import type { AppStore } from "./store"

type AppRouter = Pick<ReturnType<typeof createBrowserRouter>, "state" | "navigate">

function isProtected(handle: unknown): boolean {
  return typeof handle === "object" && handle !== null && (handle as { requiresAuth?: unknown }).requiresAuth === true
}

/**
 * UX-DR11 / Story 1.5: when an API call (outside login, logout and `getMe`) answers 401 while a protected
 * route is shown, every tab leaves for `/login`:
 * - `session_expired` → `/login?returnTo=<path+search>` with the session-ended notice;
 * - `account_disabled` → `/login` (no `returnTo`) with the disabled notice.
 * The other tabs hear `ended` on the session channel. `/login` drops the cached server state once it has
 * replaced the protected screens (their guards must not redirect a second time). Public routes stay put.
 * During a navigation a `session_expired` only resets the cache and lets the destination's `RequireAuth`
 * redirect (it shows the notice from the "was signed in here" flag, so the flag is kept for it).
 * Returns the unregister function.
 */
export function registerUnauthorizedRedirect(router: AppRouter, store: Pick<AppStore, "dispatch">): () => void {
  return setUnauthorizedHandler((code) => {
    const { location, matches, navigation } = router.state
    const reason: SessionEndReason = code === "account_disabled" ? "accountDisabled" : "sessionEnded"

    if (navigation.state !== "idle" && reason === "sessionEnded") {
      store.dispatch(baseApi.util.resetApiState())
      return
    }
    if (!matches.some((match) => isProtected(match.route.handle))) {
      return
    }

    clearSessionActive()
    postSessionMessage({ type: "ended", reason })
    const target = sessionEndTarget(reason, location)
    void router.navigate(target.to, { replace: true, state: target.state })
  })
}
