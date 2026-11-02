import { useEffect, useState } from "react"
import { Navigate, Outlet, useLocation, useNavigation } from "react-router"

import { useMe } from "@/shared/auth"
import { clearSessionActive, postSessionMessage } from "@/shared/auth/session-timer"

import { signedOutTarget } from "../session/end-session"
import { AppLoading } from "./app-loading"
import { SessionErrorPage } from "./session-error-page"

/** Route `handle` marking protected routes; the 401 handler redirects only from these. */
export const REQUIRES_AUTH_HANDLE = { requiresAuth: true } as const

/**
 * Sends a signed-out visitor to sign in. The target is worked out once (the flag is cleared right after),
 * and a session that ended or an account that was disabled is announced to the other tabs.
 */
export function SignedOutRedirect({ problemCode }: { problemCode: string | null }) {
  const location = useLocation()
  const [target] = useState(() => signedOutTarget(problemCode, location))

  useEffect(() => {
    if (target.state) {
      clearSessionActive()
      postSessionMessage({
        type: "ended",
        reason: target.state.notice === "accountDisabled" ? "accountDisabled" : "sessionEnded",
      })
    }
  }, [target])

  return <Navigate to={target.to} state={target.state} replace />
}

/**
 * UX-DR11 guard: renders the protected routes for a signed-in user, sends a signed-out one to sign in:
 * `/login?returnTo=<path+search>` (with the session-ended notice when a session existed in this browser),
 * or `/login` with the disabled notice on `account_disabled`. While another navigation is already under
 * way (sign-out to `/login`), it waits instead of redirecting on its own.
 */
export function RequireAuth() {
  const { status, problemCode, refetch } = useMe()
  const navigation = useNavigation()

  if (status === "signedIn") {
    return <Outlet />
  }
  if (status === "signedOut" && navigation.state === "idle") {
    return <SignedOutRedirect problemCode={problemCode} />
  }
  if (status === "error") {
    return <SessionErrorPage problemCode={problemCode} onRetry={refetch} />
  }
  return <AppLoading />
}
