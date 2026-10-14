import { Navigate, Outlet, useLocation, useNavigation } from "react-router"

import { loginPathFor, useMe } from "@/shared/auth"

import { AppLoading } from "./app-loading"
import { SessionErrorPage } from "./session-error-page"

/** Route `handle` marking protected routes; the 401 handler redirects only from these. */
export const REQUIRES_AUTH_HANDLE = { requiresAuth: true } as const

/**
 * UX-DR11 guard: renders the protected routes for a signed-in user, sends a signed-out one to
 * `/login?returnTo=<path+search>`. While another navigation is already under way (sign-out to
 * `/login`), it waits instead of redirecting on its own.
 */
export function RequireAuth() {
  const { status, problemCode, refetch } = useMe()
  const location = useLocation()
  const navigation = useNavigation()

  if (status === "signedIn") {
    return <Outlet />
  }
  if (status === "signedOut" && navigation.state === "idle") {
    return <Navigate to={loginPathFor(location)} replace />
  }
  if (status === "error") {
    return <SessionErrorPage problemCode={problemCode} onRetry={refetch} />
  }
  return <AppLoading />
}
