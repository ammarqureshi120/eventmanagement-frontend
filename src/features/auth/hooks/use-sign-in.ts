import type { ThunkDispatch, UnknownAction } from "@reduxjs/toolkit"
import { useState } from "react"
import { useDispatch } from "react-redux"
import { useNavigate, useSearchParams } from "react-router"

import { useLoginMutation, type LoginRequest } from "@/api/generated/auth"
import { generatedApi as meApi } from "@/api/generated/me"
import { baseApi } from "@/shared/api/base-api"
import { refreshXsrfToken } from "@/shared/api/xsrf"
import { roleHome, safeReturnTo } from "@/shared/auth"
import { toProblem, type Problem } from "@/shared/lib/problem"

export type SignInResult = { ok: true } | { ok: false; problem: Problem }

/**
 * FR-1 sign-in flow: `POST /api/auth/login` → refresh the XSRF token (it is bound to the user) →
 * reset the RTK Query cache → load `GET /api/me` → go to a safe `returnTo` or the role home.
 * `pending` is true from submit until the flow ends; it stays true only when the flow navigated away,
 * so the page never redirects on its own while this flow owns the navigation.
 * If `/api/me` fails after a successful login the user stays on `/login` with a `server_error`.
 */
export function useSignIn() {
  const [login] = useLoginMutation()
  const dispatch = useDispatch<ThunkDispatch<unknown, unknown, UnknownAction>>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [pending, setPending] = useState(false)

  const signIn = async (credentials: LoginRequest): Promise<SignInResult> => {
    setPending(true)
    let navigated = false
    try {
      const result = await login({ loginRequest: credentials })
      if ("error" in result) {
        return { ok: false, problem: toProblem(result.error) }
      }

      // Best effort: a missing token is fetched again before the next unsafe call anyway.
      await refreshXsrfToken().catch(() => undefined)
      dispatch(baseApi.util.resetApiState())

      // Not subscribed: the next screen's `useMe` subscribes to this cached result.
      const meResult = await dispatch(meApi.endpoints.getMe.initiate(undefined, { subscribe: false }))
      if (!meResult.data) {
        return { ok: false, problem: { ...toProblem(meResult.error), code: "server_error" } }
      }

      navigated = true
      await navigate(safeReturnTo(searchParams.get("returnTo")) ?? roleHome(meResult.data.role) ?? "/", {
        replace: true,
      })
      return { ok: true }
    } finally {
      if (!navigated) {
        setPending(false)
      }
    }
  }

  return { signIn, pending }
}
