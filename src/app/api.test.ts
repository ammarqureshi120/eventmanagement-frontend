import { http, HttpResponse } from "msw"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createStore } from "@/app/store"
import { generatedApi } from "@/api/generated/auth"
import { generatedApi as meApi } from "@/api/generated/me"
import { problem } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"

import { baseApi, XSRF_HEADER } from "@/shared/api/base-api"
import { setUnauthorizedHandler } from "@/shared/api/unauthorized"
import { ensureXsrfToken, refreshXsrfToken } from "@/shared/api/xsrf"
import { toProblem } from "@/shared/lib/problem"

const probeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    probeGet: build.query<{ ok: boolean }, void>({ query: () => ({ url: "/api/probe" }) }),
    probeSend: build.mutation<{ ok: boolean }, string>({ query: (method) => ({ url: "/api/probe", method }) }),
  }),
})

function clearXsrfCookie() {
  document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
}

/** Antiforgery endpoint that hands out token-1, token-2, … and counts calls. */
function countingAntiforgery() {
  const calls = { count: 0 }
  server.use(
    http.get("*/api/auth/antiforgery", () => {
      calls.count += 1
      document.cookie = `XSRF-TOKEN=token-${calls.count}; path=/`
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return calls
}

describe("baseApi", () => {
  afterEach(() => {
    clearXsrfCookie()
  })

  function captureXsrfHeader() {
    const seen: { header?: string | null; headers: Array<string | null> } = { headers: [] }
    server.use(
      http.all("*/api/probe", ({ request }) => {
        seen.header = request.headers.get(XSRF_HEADER)
        seen.headers.push(seen.header)
        return HttpResponse.json({ ok: true })
      }),
    )
    return seen
  }

  it("does not send X-XSRF-TOKEN on GET", async () => {
    const seen = captureXsrfHeader()
    document.cookie = "XSRF-TOKEN=abc%20123; path=/"

    await createStore().dispatch(probeApi.endpoints.probeGet.initiate())

    expect(seen.header).toBeNull()
  })

  it.each(["POST", "PUT", "PATCH", "DELETE", "delete"])(
    "echoes the XSRF-TOKEN cookie in X-XSRF-TOKEN on %s",
    async (method) => {
      const seen = captureXsrfHeader()
      document.cookie = "XSRF-TOKEN=abc%20123; path=/"

      const result = await createStore().dispatch(probeApi.endpoints.probeSend.initiate(method))

      expect("error" in result ? result.error : undefined).toBeUndefined()
      expect(seen.header).toBe("abc 123")
    },
  )

  it("dispatches the generated antiforgery endpoint through the store", async () => {
    const store = createStore()

    const result = await store.dispatch(generatedApi.endpoints.getAntiforgeryToken.initiate())

    expect(result.isSuccess).toBe(true)
    expect(document.cookie).toContain("XSRF-TOKEN=test-xsrf-token")
  })

  describe("antiforgery token", () => {
    it("fetches a token before the first unsafe call when there is no cookie, then sends it", async () => {
      const calls = countingAntiforgery()
      const seen = captureXsrfHeader()

      const result = await createStore().dispatch(probeApi.endpoints.probeSend.initiate("POST"))

      expect("error" in result).toBe(false)
      expect(calls.count).toBe(1)
      expect(seen.header).toBe("token-1")
    })

    it("does not fetch a token for GET", async () => {
      const calls = countingAntiforgery()
      captureXsrfHeader()

      await createStore().dispatch(probeApi.endpoints.probeGet.initiate())

      expect(calls.count).toBe(0)
    })

    it("shares one token request between parallel unsafe calls (single-flight)", async () => {
      const calls = countingAntiforgery()
      const seen = captureXsrfHeader()
      const store = createStore()

      await Promise.all([
        store.dispatch(probeApi.endpoints.probeSend.initiate("POST")),
        store.dispatch(probeApi.endpoints.probeSend.initiate("PUT")),
        store.dispatch(probeApi.endpoints.probeSend.initiate("DELETE")),
        ensureXsrfToken(),
      ])

      expect(calls.count).toBe(1)
      expect(seen.headers).toEqual(["token-1", "token-1", "token-1"])
    })

    it("refreshes even when a cookie exists", async () => {
      const calls = countingAntiforgery()
      document.cookie = "XSRF-TOKEN=old; path=/"

      await refreshXsrfToken()
      await ensureXsrfToken()

      expect(calls.count).toBe(1)
      expect(document.cookie).toContain("XSRF-TOKEN=token-1")
    })

    it("never reuses a token request that was already in flight: it waits for it, then fetches fresh", async () => {
      const calls = countingAntiforgery()

      const early = ensureXsrfToken() // e.g. started before sign-in
      const fresh = refreshXsrfToken() // after sign-in
      await Promise.all([early, fresh])

      expect(calls.count).toBe(2)
      expect(document.cookie).toContain("XSRF-TOKEN=token-2")
    })

    it("on an antiforgery rejection (400 validation, no errors) refreshes the token and retries once", async () => {
      const calls = countingAntiforgery()
      document.cookie = "XSRF-TOKEN=stale; path=/"
      const headers: Array<string | null> = []
      server.use(
        http.post("*/api/probe", ({ request }) => {
          headers.push(request.headers.get(XSRF_HEADER))
          return headers.length === 1 ? problem(400, "validation") : HttpResponse.json({ ok: true })
        }),
      )

      const result = await createStore().dispatch(probeApi.endpoints.probeSend.initiate("POST"))

      expect("data" in result && result.data).toEqual({ ok: true })
      expect(headers).toEqual(["stale", "token-1"])
      expect(calls.count).toBe(1)
    })

    it("retries only once: a second rejection comes back as the validation problem", async () => {
      const calls = countingAntiforgery()
      document.cookie = "XSRF-TOKEN=stale; path=/"
      let attempts = 0
      server.use(
        http.post("*/api/probe", () => {
          attempts += 1
          return problem(400, "validation")
        }),
      )

      const result = await createStore().dispatch(probeApi.endpoints.probeSend.initiate("POST"))

      expect(attempts).toBe(2)
      expect(calls.count).toBe(1)
      expect(toProblem("error" in result ? result.error : undefined).code).toBe("validation")
    })

    it("does not retry real validation errors (they name fields) or safe verbs", async () => {
      const calls = countingAntiforgery()
      document.cookie = "XSRF-TOKEN=ok; path=/"
      let attempts = 0
      server.use(
        http.all("*/api/probe", () => {
          attempts += 1
          return problem(400, "validation", { email: ["Enter your email address."] })
        }),
      )
      const store = createStore()

      await store.dispatch(probeApi.endpoints.probeSend.initiate("POST"))
      await store.dispatch(probeApi.endpoints.probeGet.initiate())

      expect(attempts).toBe(2)
      expect(calls.count).toBe(0)
    })

    it("reports a 500 from the token endpoint as server_error (not offline) without calling the endpoint", async () => {
      server.use(http.get("*/api/auth/antiforgery", () => new HttpResponse(null, { status: 500 })))
      const seen = captureXsrfHeader()

      const result = await createStore().dispatch(probeApi.endpoints.probeSend.initiate("POST"))

      expect(toProblem("error" in result ? result.error : undefined)).toEqual({ code: "server_error", status: 500, traceId: null })
      expect(seen.headers).toEqual([])
    })

    it("reports a failed token request as a network problem without calling the endpoint", async () => {
      server.use(http.get("*/api/auth/antiforgery", () => HttpResponse.error()))
      const seen = captureXsrfHeader()

      const result = await createStore().dispatch(probeApi.endpoints.probeSend.initiate("POST"))

      expect(toProblem("error" in result ? result.error : undefined).code).toBe("network")
      expect(seen.headers).toEqual([])
    })
  })

  describe("401 and network", () => {
    it("calls the unauthorized handler on 401 session_expired", async () => {
      const onUnauthorized = vi.fn()
      const restore = setUnauthorizedHandler(onUnauthorized)
      try {
        server.use(http.get("*/api/probe", () => problem(401, "session_expired")))

        const result = await createStore().dispatch(probeApi.endpoints.probeGet.initiate())

        expect(onUnauthorized).toHaveBeenCalledTimes(1)
        expect(toProblem("error" in result ? result.error : undefined)).toMatchObject({ code: "session_expired", status: 401 })
      } finally {
        restore()
      }
    })

    it("leaves login, logout and /api/me 401s to their callers and the route guards", async () => {
      const onUnauthorized = vi.fn()
      const restore = setUnauthorizedHandler(onUnauthorized)
      try {
        server.use(
          http.post("*/api/auth/login", () => problem(401, "invalid_credentials")),
          http.post("*/api/auth/logout", () => problem(401, "session_expired")),
          http.get("*/api/me", () => problem(401, "session_expired")),
        )
        const store = createStore()

        await store.dispatch(generatedApi.endpoints.login.initiate({ loginRequest: { email: "a@b.test", password: "x" } }))
        await store.dispatch(generatedApi.endpoints.logout.initiate())
        await store.dispatch(meApi.endpoints.getMe.initiate())

        expect(onUnauthorized).not.toHaveBeenCalled()
      } finally {
        restore()
      }
    })

    it("maps a failed fetch to the network code", async () => {
      server.use(http.get("*/api/probe", () => HttpResponse.error()))

      const result = await createStore().dispatch(probeApi.endpoints.probeGet.initiate())

      expect(toProblem("error" in result ? result.error : undefined)).toEqual({ code: "network", status: null, traceId: null })
    })
  })
})
