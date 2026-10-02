import { http, HttpResponse, type RequestHandler } from "msw"

/** Default handlers shared by all tests. Feature handlers (`features/<f>/mocks.ts`) are appended here. */
export const handlers: RequestHandler[] = [
  http.get("*/api/auth/antiforgery", () => {
    document.cookie = "XSRF-TOKEN=test-xsrf-token; path=/"
    return new HttpResponse(null, { status: 204 })
  }),
]
