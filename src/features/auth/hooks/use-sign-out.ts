import { useEffect } from "react"
import { useDispatch } from "react-redux"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { useLogoutMutation } from "@/api/generated/auth"
import { baseApi } from "@/shared/api/base-api"
import { refreshXsrfToken } from "@/shared/api/xsrf"
import { OFFLINE_MESSAGE } from "@/shared/lib/messages"
import { toProblem } from "@/shared/lib/problem"

/** Router `state.notice` value that makes `/login` show "You're signed out. See you soon." */
export const SIGNED_OUT_NOTICE = "signedOut"

const SIGN_OUT_FAILED = "We couldn't sign you out. Try again."

/** Shares the logout mutation's state between every Sign out control (user menu, sidebar, drawer). */
const LOGOUT_CACHE_KEY = "sign-out"

/** The sign-out in flight, shared by every caller so quick repeated clicks send one logout. */
let inflight: Promise<void> | null = null

/**
 * FR-1 sign-out: `POST /api/auth/logout` (204, or 401 when the session was already gone) → `/login` with
 * the signed-out notice, where `useSignedOutCleanup` clears the RTK Query cache and refreshes the XSRF
 * token. A network or server failure keeps the user where they are with an error toast. Calls while a
 * sign-out is in flight (from any control) join it instead of sending another logout.
 */
export function useSignOut() {
  const [logout, { isLoading }] = useLogoutMutation({ fixedCacheKey: LOGOUT_CACHE_KEY })
  const navigate = useNavigate()

  const run = async () => {
    const result = await logout()
    if ("error" in result) {
      const problem = toProblem(result.error)
      if (problem.status !== 401) {
        toast.error(problem.code === "network" ? OFFLINE_MESSAGE : SIGN_OUT_FAILED)
        return
      }
    }

    // The cache is cleared by `/login` once it has replaced the protected screens (see below), so their
    // guards never see the ended session and redirect on their own with a returnTo.
    await navigate("/login", { replace: true, state: { notice: SIGNED_OUT_NOTICE } })
  }

  const signOut = () => {
    inflight ??= run().finally(() => {
      inflight = null
    })
    return inflight
  }

  return { signOut, pending: isLoading }
}

/**
 * Second half of sign-out, run by `/login` while it shows the signed-out notice: clear the RTK Query
 * cache (the old `/api/me` included) and fetch a fresh XSRF token (the old one was bound to the user).
 * Running it here, after the protected screens are gone, keeps their guards from reacting to it.
 */
export function useSignedOutCleanup(active: boolean) {
  const dispatch = useDispatch()

  useEffect(() => {
    if (!active) {
      return
    }
    dispatch(baseApi.util.resetApiState())
    void refreshXsrfToken().catch(() => undefined)
  }, [active, dispatch])
}
