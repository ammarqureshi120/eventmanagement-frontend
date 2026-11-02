import { Navigate } from "react-router"

import { roleHome, useMe } from "@/shared/auth"

import { AppShell } from "../shell/app-shell"
import { AppLoading } from "./app-loading"
import { NoAccessPage } from "./no-access-page"
import { SignedOutRedirect } from "./require-auth"
import { SessionErrorPage } from "./session-error-page"

/**
 * `/`: the role home when signed in (UX-DR8), `/login` (no returnTo) when signed out, with the
 * session-ended or disabled notice when that is why (Story 1.5). A role without a
 * home route yet (until Epic 2) sees No access inside the shell instead of a dead link.
 */
export function RoleHomeRedirect() {
  const { me, status, problemCode, refetch } = useMe()

  if (status === "signedIn" && me) {
    const home = roleHome(me.role)
    if (home) {
      return <Navigate to={home} replace />
    }
    return (
      <AppShell>
        <NoAccessPage role={me.role} />
      </AppShell>
    )
  }
  if (status === "signedOut") {
    return <SignedOutRedirect problemCode={problemCode} />
  }
  if (status === "error") {
    return <SessionErrorPage problemCode={problemCode} onRetry={refetch} />
  }
  return <AppLoading />
}
