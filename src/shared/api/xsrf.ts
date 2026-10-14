import { readCookie } from "@/shared/lib/cookies"

/** Cookie issued by `GET /api/auth/antiforgery` (AD-16). */
export const XSRF_COOKIE = "XSRF-TOKEN"

/** Header the API validates on unsafe verbs (AD-16). */
export const XSRF_HEADER = "X-XSRF-TOKEN"

export const ANTIFORGERY_URL = "/api/auth/antiforgery"

function apiOrigin() {
  // Same-origin: Vite proxies /api in dev, the reverse proxy does in prod (no CORS).
  return typeof window === "undefined" ? "" : window.location.origin
}

/** The token endpoint answered with a non-2xx status (a server fault, not a network failure). */
export class XsrfTokenError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`Antiforgery token request failed (${status}).`)
    this.name = "XsrfTokenError"
    this.status = status
  }
}

let inflight: Promise<void> | null = null

/** One shared request for every caller that needs a token right now (single-flight). */
function fetchToken(): Promise<void> {
  inflight ??= fetch(`${apiOrigin()}${ANTIFORGERY_URL}`, { credentials: "include" })
    .then((response) => {
      if (!response.ok) {
        throw new XsrfTokenError(response.status)
      }
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/** The current XSRF token from its cookie, or `null`. */
export function readXsrfToken(): string | null {
  return readCookie(XSRF_COOKIE)
}

/**
 * Makes sure an XSRF cookie exists before an unsafe call: resolves at once when it does, otherwise
 * fetches one. Parallel callers share the same request. Rejects when the token request fails.
 */
export function ensureXsrfToken(): Promise<void> {
  if (readXsrfToken()) {
    return Promise.resolve()
  }
  return fetchToken()
}

/**
 * Fetches a fresh token even when a cookie exists: after sign-in and sign-out (the token is bound to the
 * user) and before retrying a call the antiforgery filter rejected. A request already in flight may have
 * started before the user changed, so it is awaited (and its outcome ignored) and a new one is made.
 */
export async function refreshXsrfToken(): Promise<void> {
  if (inflight) {
    await inflight.catch(() => undefined)
  }
  return fetchToken()
}
