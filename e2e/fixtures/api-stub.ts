import type { Page } from "@playwright/test"

/**
 * Stateful `page.route` stub of the 1.4a auth API for e2e runs against `vite preview` (no backend):
 * antiforgery, login, logout and me. Unsafe calls must carry the current XSRF token, like the real
 * `/api` antiforgery filter (400 `validation` without `errors` otherwise). Every other `/api` call → 404.
 */

/** Test-only credentials accepted by the stub (never a real account). */
export const STUB_EMAIL = "sara@example.test"
export const STUB_PASSWORD = "stub-password-1"

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
} as const

export interface ApiStub {
  /** `METHOD /path` of every API call, in order. */
  calls: string[]
  signedIn: boolean
  /** Next logout answers with this status instead of 204 (e.g. 500). */
  failNextLogout?: number
}

function problemBody(status: number, code: string, errors?: Record<string, string[]>) {
  return {
    status,
    contentType: "application/problem+json",
    body: JSON.stringify({ type: "about:blank", title: code, status, code, traceId: "00-e2e-stub-00", ...(errors ? { errors } : {}) }),
  }
}

export async function stubApi(page: Page, options: { signedIn?: boolean } = {}): Promise<ApiStub> {
  const stub: ApiStub = { calls: [], signedIn: options.signedIn ?? false }
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
        if (body.email?.trim().toLowerCase() === STUB_EMAIL && body.password === STUB_PASSWORD) {
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
      case "GET /api/me":
        await route.fulfill(
          stub.signedIn
            ? { status: 200, contentType: "application/json", body: JSON.stringify(STUB_ME) }
            : problemBody(401, "session_expired"),
        )
        return
      default:
        await route.fulfill(problemBody(404, "not_found"))
    }
  })

  return stub
}
