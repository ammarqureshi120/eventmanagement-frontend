import { loginPathFor } from "@/shared/auth"
import { wasSessionActive, type SessionEndReason } from "@/shared/auth/session-timer"
import type { LoginNotice } from "@/shared/lib/messages"

export interface LoginTarget {
  to: string
  /** Router state for `/login` (`state.notice`), never a URL flag. */
  state: { notice: LoginNotice } | null
}

/**
 * Where a tab goes when its session is over (Story 1.5):
 * - `sessionEnded` → `/login?returnTo=<path+search>` with "Your session ended…";
 * - `accountDisabled` → `/login` with "This account is disabled." and no `returnTo` (signing in again
 *   cannot succeed, so there is nothing to return to).
 */
export function sessionEndTarget(
  reason: SessionEndReason,
  location: { pathname: string; search?: string },
): LoginTarget {
  if (reason === "accountDisabled") {
    return { to: "/login", state: { notice: "accountDisabled" } }
  }
  return { to: loginPathFor(location), state: { notice: "sessionEnded" } }
}

/**
 * Where a signed-out `GET /api/me` (page load, guard) sends the user: `account_disabled` → the disabled
 * notice; any other 401 → the session-ended notice when a session existed in this browser, otherwise
 * (a first visit) plain `/login` with no notice.
 */
export function signedOutTarget(
  problemCode: string | null,
  location: { pathname: string; search?: string },
): LoginTarget {
  if (problemCode === "account_disabled") {
    return sessionEndTarget("accountDisabled", location)
  }
  if (wasSessionActive()) {
    return sessionEndTarget("sessionEnded", location)
  }
  return { to: loginPathFor(location), state: null }
}
