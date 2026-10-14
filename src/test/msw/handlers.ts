import { http, HttpResponse, type RequestHandler } from "msw"

import type { MeResponse } from "@/api/generated/me"

/** A seeded System Administrator as `GET /api/me` returns it (Story 1.4a). */
export const sysAdminMe: MeResponse = {
  id: "0195f0a0-0000-7000-8000-000000000001",
  email: "sara@example.test",
  firstName: "Sara",
  lastName: "Admin",
  phone: null,
  role: "systemAdministrator",
  organization: null,
  version: 1,
  navAreas: ["platform", "account"],
}

/** An `EventHubProblem` body (AD-17). */
export function problem(status: number, code: string, errors?: Record<string, string[]>) {
  return HttpResponse.json(
    { type: "about:blank", title: code, status, code, traceId: "00-test-trace-00", ...(errors ? { errors } : {}) },
    { status, headers: { "Content-Type": "application/problem+json" } },
  )
}

/**
 * Default handlers shared by all tests: signed out (`/api/me` → 401), antiforgery issues a token,
 * login and logout succeed. Tests override per case with `server.use(...)`.
 * Feature handlers (`features/<f>/mocks.ts`) are appended here.
 */
export const handlers: RequestHandler[] = [
  http.get("*/api/auth/antiforgery", () => {
    document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/"
    return new HttpResponse(null, { status: 204 })
  }),
  http.get("*/api/me", () => problem(401, "session_expired")),
  http.post("*/api/auth/login", () => new HttpResponse(null, { status: 200 })),
  http.post("*/api/auth/logout", () => new HttpResponse(null, { status: 204 })),
]
