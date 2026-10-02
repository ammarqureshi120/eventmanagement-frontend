import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react"

import { readCookie } from "@/shared/lib/cookies"

/** Cookie issued by `GET /api/auth/antiforgery` (AD-16). */
export const XSRF_COOKIE = "XSRF-TOKEN"

/** Header the API validates on unsafe verbs (AD-16). */
export const XSRF_HEADER = "X-XSRF-TOKEN"

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])

const rawBaseQuery = fetchBaseQuery({
  // Same-origin: Vite proxies /api in dev, the reverse proxy does in prod (no CORS).
  // An absolute origin keeps fetch happy outside the browser too (Vitest/jsdom).
  baseUrl: typeof window === "undefined" ? "" : window.location.origin,
  credentials: "include",
})

/**
 * Sends cookies on every call and echoes the XSRF-TOKEN cookie in X-XSRF-TOKEN on POST/PUT/PATCH/DELETE.
 * ProblemDetails mapping and the 401 redirect join in later stories (AD-17).
 */
export const xsrfBaseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = (
  args,
  api,
  extraOptions,
) => {
  const request: FetchArgs = typeof args === "string" ? { url: args } : { ...args }
  const method = (request.method ?? "GET").toUpperCase()

  if (UNSAFE_METHODS.has(method)) {
    const token = readCookie(XSRF_COOKIE)
    if (token) {
      const headers = new Headers(request.headers as HeadersInit | undefined)
      headers.set(XSRF_HEADER, token)
      request.headers = headers
    }
  }

  return rawBaseQuery(request, api, extraOptions)
}

/**
 * The single RTK Query API. Generated endpoints (`src/api/generated/*`) are injected into it;
 * cache tags follow AD-29 and are enhanced per feature in `features/<f>/api.enhance.ts`.
 */
export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: xsrfBaseQuery,
  tagTypes: [],
  endpoints: () => ({}),
})
