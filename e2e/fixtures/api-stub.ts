import type { Page } from "@playwright/test"

import { passwordProblems } from "../../src/shared/lib/password-policy.ts"

/**
 * Stateful `page.route` stub of the auth API for e2e runs against `vite preview` (no backend):
 * antiforgery, login, logout and me (1.4a), forgot and reset password (1.6). Unsafe calls must carry the
 * current XSRF token, like the real `/api` antiforgery filter (400 `validation` without `errors` otherwise).
 * Every other `/api` call → 404.
 */

/** Test-only credentials accepted by the stub (never a real account). */
export const STUB_EMAIL = "sara@example.test"
export const STUB_PASSWORD = "stub-password-1"

/** The one reset token the stub accepts (single use, like the real one); any other token → `token_invalid`. */
export const STUB_RESET_TOKEN = "stub-reset-token-Abc_123"

export const STUB_ME = {
  id: "0195f0a0-0000-7000-8000-000000000001",
  email: STUB_EMAIL,
  firstName: "Sara",
  lastName: "Admin",
  phone: null,
  role: "systemAdministrator",
  organization: null,
  version: 1,
  navAreas: ["platform", "account"],
  // 12-hour limit far ahead unless a test sets its own (`stubApi(page, { sessionExpiresAt })`).
  sessionExpiresAt: "2099-01-01T00:00:00Z",
} as const

export interface ApiStub {
  /** `METHOD /path` of every API call, in order. */
  calls: string[]
  signedIn: boolean
  /** Next logout answers with this status instead of 204 (e.g. 500). */
  failNextLogout?: number
  /** `sessionExpiresAt` returned by `/api/me`. */
  sessionExpiresAt: string
  /** When set, `/api/me` answers 401 with this code (e.g. `account_disabled`) whatever `signedIn` says. */
  meProblem?: string
  /** The password login accepts; a successful reset changes it. */
  password: string
  /** JSON bodies of every `POST /api/auth/forgot-password` and `POST /api/auth/reset-password`, in order. */
  forgotBodies: unknown[]
  resetBodies: unknown[]
  /** True once `STUB_RESET_TOKEN` has been used (a second use → `token_invalid` `used`). */
  resetTokenUsed: boolean
  /** Next reset answers with this problem instead (e.g. `{ status: 400, code: "token_invalid" }`). */
  nextResetProblem?: { status: number; code: string; errors?: Record<string, string[]>; reason?: string }
}

function problemBody(status: number, code: string, errors?: Record<string, string[]>, reason?: string) {
  return {
    status,
    contentType: "application/problem+json",
    body: JSON.stringify({
      type: "about:blank",
      title: code,
      status,
      code,
      traceId: "00-e2e-stub-00",
      ...(errors ? { errors } : {}),
      ...(reason ? { reason } : {}),
    }),
  }
}



export async function stubApi(
  page: Page,
  options: { signedIn?: boolean; sessionExpiresAt?: string; meProblem?: string } = {},
): Promise<ApiStub> {
  const stub: ApiStub = {
    calls: [],
    signedIn: options.signedIn ?? false,
    sessionExpiresAt: options.sessionExpiresAt ?? STUB_ME.sessionExpiresAt,
    meProblem: options.meProblem,
    password: STUB_PASSWORD,
    forgotBodies: [],
    resetBodies: [],
    resetTokenUsed: false,
  }
  let tokenCount = 0
  let currentToken: string | null = null

  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const method = request.method()
    stub.calls.push(`${method} ${url.pathname}`)

    const unsafe = ["POST", "PUT", "PATCH", "DELETE"].includes(method)
    if (unsafe && (!currentToken || request.headers()["x-xsrf-token"] !== currentToken)) {
      await route.fulfill(problemBody(400, "validation"))
      return
    }

    switch (`${method} ${url.pathname}`) {
      case "GET /api/auth/antiforgery": {
        tokenCount += 1
        currentToken = `stub-xsrf-${tokenCount}`
        await page.context().addCookies([{ name: "XSRF-TOKEN", value: currentToken, url: url.origin }])
        await route.fulfill({ status: 204 })
        return
      }
      case "POST /api/auth/login": {
        const body = (request.postDataJSON() ?? {}) as { email?: string; password?: string }
        if (body.email?.trim().toLowerCase() === STUB_EMAIL && body.password === stub.password) {
          stub.signedIn = true
          await route.fulfill({ status: 200 })
        } else {
          await route.fulfill(problemBody(401, "invalid_credentials"))
        }
        return
      }
      case "POST /api/auth/logout": {
        if (stub.failNextLogout) {
          const status = stub.failNextLogout
          stub.failNextLogout = undefined
          await route.fulfill(problemBody(status, "server_error"))
          return
        }
        const wasSignedIn = stub.signedIn
        stub.signedIn = false
        await route.fulfill(wasSignedIn ? { status: 204 } : problemBody(401, "session_expired"))
        return
      }
      case "POST /api/auth/forgot-password": {
        // Always the same 202 with no body, whatever the email (FR4).
        stub.forgotBodies.push(request.postDataJSON())
        await route.fulfill({ status: 202 })
        return
      }
      case "POST /api/auth/reset-password": {
        const body = (request.postDataJSON() ?? {}) as { token?: string; newPassword?: string }
        stub.resetBodies.push(body)
        if (stub.nextResetProblem) {
          const { status, code, errors, reason } = stub.nextResetProblem
          stub.nextResetProblem = undefined
          await route.fulfill(problemBody(status, code, errors, reason))
          return
        }
        // Token first (AD-17), then the policy, like the real handler.
        if (body.token !== STUB_RESET_TOKEN) {
          await route.fulfill(problemBody(400, "token_invalid"))
          return
        }
        if (stub.resetTokenUsed) {
          await route.fulfill(problemBody(400, "token_invalid", undefined, "used"))
          return
        }
        // The SPA's mirror of the server policy (same rules and messages).
        const problems = passwordProblems(body.newPassword ?? "")
        if (problems.length > 0) {
          await route.fulfill(problemBody(400, "validation", { newPassword: problems }))
          return
        }
        stub.resetTokenUsed = true
        stub.password = body.newPassword ?? ""
        // The stamp rotates: every session of the account ends.
        stub.signedIn = false
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ email: STUB_EMAIL }) })
        return
      }
      case "GET /api/me":
        if (stub.meProblem) {
          await route.fulfill(problemBody(401, stub.meProblem))
          return
        }
        await route.fulfill(
          stub.signedIn
            ? {
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ ...STUB_ME, sessionExpiresAt: stub.sessionExpiresAt }),
              }
            : problemBody(401, "session_expired"),
        )
        return
      default:
        await route.fulfill(problemBody(404, "not_found"))
    }
  })

  return stub
}
