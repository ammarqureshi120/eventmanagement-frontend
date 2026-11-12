import type { Page } from "@playwright/test"

import { passwordProblems } from "../../src/shared/lib/password-policy.ts"

/**
 * Stateful `page.route` stub of the auth API for e2e runs against `vite preview` (no backend):
 * antiforgery, login, logout and me (1.4a), forgot and reset password (1.6), and the My account writes (1.7):
 * the profile save (version check → 409 `concurrency_conflict`, server rules) and the password change (current
 * password check, policy; both bump the version). Unsafe calls must carry the
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

/** The editable part of `/api/me` (Story 1.7); tests may change it to simulate another tab's save. */
export interface StubProfile {
  firstName: string
  lastName: string
  phone: string | null
  version: number
}

/** The 1.7a server messages the stub answers with. */
export const STUB_MESSAGES = {
  firstNameRequired: "Enter your first name.",
  lastNameRequired: "Enter your last name.",
  nameTooLong: "Use 100 characters or fewer.",
  phoneTooLong: "Use 32 characters or fewer.",
  phoneInvalid: "Enter a phone number with digits, spaces and + ( ) - . only.",
  currentRequired: "Enter your current password.",
  currentWrong: "That's not your current password. Check it and try again.",
} as const

type StubProblem = { status: number; code: string; errors?: Record<string, string[]>; reason?: string }

/** The 1.7a profile validator (trimmed names required ≤100; phone optional, ≤32, ASCII digits/space/+()-. with a digit). */
function profileErrors(body: { firstName?: string; lastName?: string; phone?: string | null }) {
  const errors: Record<string, string[]> = {}
  const firstName = (body.firstName ?? "").trim()
  const lastName = (body.lastName ?? "").trim()
  const phone = (body.phone ?? "").trim()
  if (!firstName) errors.firstName = [STUB_MESSAGES.firstNameRequired]
  else if (firstName.length > 100) errors.firstName = [STUB_MESSAGES.nameTooLong]
  if (!lastName) errors.lastName = [STUB_MESSAGES.lastNameRequired]
  else if (lastName.length > 100) errors.lastName = [STUB_MESSAGES.nameTooLong]
  if (phone.length > 32) errors.phone = [STUB_MESSAGES.phoneTooLong]
  else if (phone && (!/^[0-9 +().-]+$/.test(phone) || !/[0-9]/.test(phone))) errors.phone = [STUB_MESSAGES.phoneInvalid]
  return { errors, firstName, lastName, phone: phone || null }
}

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
  nextResetProblem?: StubProblem
  /** The signed-in user's editable details; `/api/me` returns them. */
  me: StubProfile
  /** JSON bodies of every `PUT /api/me/profile` and `POST /api/me/change-password`, in order. */
  profileBodies: unknown[]
  passwordBodies: unknown[]
  /** Next profile save answers with this problem instead (e.g. `{ status: 500, code: "server_error" }`). */
  nextProfileProblem?: StubProblem
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
  options: { signedIn?: boolean; sessionExpiresAt?: string; meProblem?: string; me?: Partial<StubProfile> } = {},
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
    me: { firstName: STUB_ME.firstName, lastName: STUB_ME.lastName, phone: STUB_ME.phone, version: STUB_ME.version, ...options.me },
    profileBodies: [],
    passwordBodies: [],
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
      case "PUT /api/me/profile": {
        const body = (request.postDataJSON() ?? {}) as { firstName?: string; lastName?: string; phone?: string | null; version?: number }
        stub.profileBodies.push(body)
        if (!stub.signedIn) {
          await route.fulfill(problemBody(401, "session_expired"))
          return
        }
        if (stub.nextProfileProblem) {
          const { status, code, errors, reason } = stub.nextProfileProblem
          stub.nextProfileProblem = undefined
          await route.fulfill(problemBody(status, code, errors, reason))
          return
        }
        // Validation first, then the version (like the real pipeline: validator → handler).
        const { errors, firstName, lastName, phone } = profileErrors(body)
        if (Object.keys(errors).length > 0) {
          await route.fulfill(problemBody(400, "validation", errors))
          return
        }
        if (body.version !== stub.me.version) {
          await route.fulfill(problemBody(409, "concurrency_conflict"))
          return
        }
        const changed = firstName !== stub.me.firstName || lastName !== stub.me.lastName || phone !== stub.me.phone
        if (changed) {
          stub.me = { firstName, lastName, phone, version: stub.me.version + 1 }
        }
        await route.fulfill({ status: 204 })
        return
      }
      case "POST /api/me/change-password": {
        const body = (request.postDataJSON() ?? {}) as { currentPassword?: string; newPassword?: string }
        stub.passwordBodies.push(body)
        if (!stub.signedIn) {
          await route.fulfill(problemBody(401, "session_expired"))
          return
        }
        if (!body.currentPassword?.trim()) {
          await route.fulfill(problemBody(400, "validation", { currentPassword: [STUB_MESSAGES.currentRequired] }))
          return
        }
        const problems = passwordProblems(body.newPassword ?? "")
        if (problems.length > 0) {
          await route.fulfill(problemBody(400, "validation", { newPassword: problems }))
          return
        }
        if (body.currentPassword !== stub.password) {
          await route.fulfill(problemBody(400, "validation", { currentPassword: [STUB_MESSAGES.currentWrong] }))
          return
        }
        // The stamp rotates and this session's cookie is re-issued: it stays signed in; the version bumps.
        stub.password = body.newPassword ?? ""
        stub.me = { ...stub.me, version: stub.me.version + 1 }
        await route.fulfill({ status: 204 })
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
                body: JSON.stringify({ ...STUB_ME, ...stub.me, sessionExpiresAt: stub.sessionExpiresAt }),
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
