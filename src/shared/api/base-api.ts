import {
  createApi,
  fetchBaseQuery,
  type BaseQueryApi,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react"

import { toProblem } from "@/shared/lib/problem"

import { notifyUnauthorized } from "./unauthorized"
import { ensureXsrfToken, readXsrfToken, refreshXsrfToken, XSRF_COOKIE, XSRF_HEADER, XsrfTokenError } from "./xsrf"

export { XSRF_COOKIE, XSRF_HEADER }

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

/**
 * Endpoints whose 401 the global handler ignores: login (wrong credentials) and logout (already gone)
 * answer their callers, and `getMe` is handled by the route guards (`RequireAuth`, `/`), which must
 * not race a second redirect.
 */
const OWN_401_ENDPOINTS = new Set(["login", "logout", "getMe"])

const rawBaseQuery = fetchBaseQuery({
  // Same-origin: Vite proxies /api in dev, the reverse proxy does in prod (no CORS).
  // An absolute origin keeps fetch happy outside the browser too (Vitest/jsdom).
  baseUrl: typeof window === "undefined" ? "" : window.location.origin,
  credentials: "include",
})

function withXsrfHeader(request: FetchArgs): FetchArgs {
  const token = readXsrfToken()
  if (!token) {
    return request
  }
  const headers = new Headers(request.headers as HeadersInit | undefined)
  headers.set(XSRF_HEADER, token)
  return { ...request, headers }
}

/**
 * The 1.4a antiforgery filter rejects a missing or stale token with 400 `validation` and no field
 * `errors`; real validation always names fields (spec 1.4a Decisions).
 */
function isAntiforgeryRejection(error: FetchBaseQueryError | undefined): boolean {
  if (!error || error.status !== 400) {
    return false
  }
  const problem = toProblem(error)
  return problem.code === "validation" && Object.keys(problem.errors ?? {}).length === 0
}

/** A failed token request: its HTTP status when the server answered (→ `server_error`), else `network`. */
function tokenError(cause: unknown): { error: FetchBaseQueryError } {
  if (cause instanceof XsrfTokenError) {
    return { error: { status: cause.status, data: null } }
  }
  return { error: { status: "FETCH_ERROR", error: cause instanceof Error ? cause.message : String(cause) } }
}

/**
 * AD-16 / AD-17 base query:
 * - sends cookies on every call;
 * - on POST/PUT/PATCH/DELETE, fetches an XSRF token first when there is no cookie, echoes it in
 *   `X-XSRF-TOKEN`, and when the antiforgery filter rejects it, refreshes the token and retries once;
 * - on 401 `session_expired` (outside login, logout and `getMe`) tells the registered unauthorized handler.
 * Errors stay `FetchBaseQueryError`; callers map them with `toProblem` (by `code` only).
 */
export const appBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api: BaseQueryApi,
  extraOptions,
) => {
  const request: FetchArgs = typeof args === "string" ? { url: args } : { ...args }
  const method = (request.method ?? "GET").toUpperCase()
  const unsafe = UNSAFE_METHODS.has(method)

  if (unsafe) {
    try {
      await ensureXsrfToken()
    } catch (cause) {
      return tokenError(cause)
    }
  }

  let result = await rawBaseQuery(unsafe ? withXsrfHeader(request) : request, api, extraOptions)

  if (unsafe && isAntiforgeryRejection(result.error)) {
    try {
      await refreshXsrfToken()
    } catch (cause) {
      return tokenError(cause)
    }
    result = await rawBaseQuery(withXsrfHeader(request), api, extraOptions)
  }

  if (
    result.error?.status === 401 &&
    !OWN_401_ENDPOINTS.has(api.endpoint) &&
    toProblem(result.error).code === "session_expired"
  ) {
    notifyUnauthorized()
  }

  return result
}

/**
 * The single RTK Query API. Generated endpoints (`src/api/generated/*`) are injected into it;
 * cache tags follow AD-29 and are enhanced per feature in `features/<f>/api.enhance.ts`.
 */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: appBaseQuery,
  tagTypes: [],
  endpoints: () => ({}),
})
