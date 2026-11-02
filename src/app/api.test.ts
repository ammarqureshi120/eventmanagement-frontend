import { http, HttpResponse } from "msw"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createStore } from "@/app/store"
import { generatedApi } from "@/api/generated/auth"
import { generatedApi as meApi } from "@/api/generated/me"
import { problem, sysAdminMe } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"

import { baseApi, XSRF_HEADER } from "@/shared/api/base-api"
import { onSessionActivity } from "@/shared/api/activity"
import { setNetworkErrorHandler } from "@/shared/api/network"
import { setUnauthorizedHandler } from "@/shared/api/unauthorized"
import { wasSessionActive } from "@/shared/auth/session-timer"
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
        expect(onUnauthorized).toHaveBeenCalledWith("session_expired")
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

    it("passes account_disabled to the unauthorized handler; other 401 codes are left to the caller", async () => {
      const onUnauthorized = vi.fn()
      const restore = setUnauthorizedHandler(onUnauthorized)
      try {
        server.use(http.get("*/api/probe", () => problem(401, "account_disabled")))
        await createStore().dispatch(probeApi.endpoints.probeGet.initiate())
        expect(onUnauthorized).toHaveBeenCalledWith("account_disabled")

        onUnauthorized.mockClear()
        server.use(http.get("*/api/probe", () => problem(401, "something_else")))
        await createStore().dispatch(probeApi.endpoints.probeGet.initiate())
        expect(onUnauthorized).not.toHaveBeenCalled()
      } finally {
        restore()
      }
    })

    it("reports a network failure to the network handler once per call (also for a failed token request)", async () => {
      const onNetwork = vi.fn()
      const restore = setNetworkErrorHandler(onNetwork)
      try {
        server.use(http.get("*/api/probe", () => HttpResponse.error()))
        await createStore().dispatch(probeApi.endpoints.probeGet.initiate())
        expect(onNetwork).toHaveBeenCalledTimes(1)

        server.use(http.get("*/api/auth/antiforgery", () => HttpResponse.error()))
        await createStore().dispatch(probeApi.endpoints.probeSend.initiate("POST"))
        expect(onNetwork).toHaveBeenCalledTimes(2)

        server.use(http.get("*/api/probe", () => problem(500, "server_error")))
        await createStore().dispatch(probeApi.endpoints.probeGet.initiate())
        expect(onNetwork).toHaveBeenCalledTimes(2)
      } finally {
        restore()
      }
    })
  })

  describe("session activity", () => {
    afterEach(() => {
      localStorage.clear()
    })

    it.each([
      ["200", () => HttpResponse.json({ ok: true })],
      ["403", () => problem(403, "forbidden")],
      ["404", () => problem(404, "not_found")],
      ["500", () => problem(500, "server_error")],
      ["non-JSON 502", () => new HttpResponse("bad gateway", { status: 502 })],
    ])("counts a %s response as activity", async (_label, respond) => {
      const onActivity = vi.fn()
      const unsubscribe = onSessionActivity(onActivity)
      try {
        server.use(http.get("*/api/probe", respond))
        await createStore().dispatch(probeApi.endpoints.probeGet.initiate())
        expect(onActivity).toHaveBeenCalledTimes(1)
      } finally {
        unsubscribe()
      }
    })

    it.each([
      ["a 401", () => problem(401, "session_expired")],
      ["a non-JSON 401", () => new HttpResponse("nope", { status: 401 })],
      ["a network failure", () => HttpResponse.error()],
    ])("does not count %s as activity", async (_label, respond) => {
      const onActivity = vi.fn()
      const unsubscribe = onSessionActivity(onActivity)
      try {
        server.use(http.get("*/api/probe", respond))
        await createStore().dispatch(probeApi.endpoints.probeGet.initiate())
        expect(onActivity).not.toHaveBeenCalled()
      } finally {
        unsubscribe()
      }
    })

    it("does not count the logout response as activity (it ends the session)", async () => {
      const onActivity = vi.fn()
      const unsubscribe = onSessionActivity(onActivity)
      try {
        document.cookie = "XSRF-TOKEN=abc; path=/"
        await createStore().dispatch(generatedApi.endpoints.logout.initiate())
        expect(onActivity).not.toHaveBeenCalled()
      } finally {
        unsubscribe()
      }
    })

    it("sets the 'was signed in here' flag on a successful getMe only", async () => {
      server.use(http.get("*/api/me", () => problem(401, "session_expired")))
      await createStore().dispatch(meApi.endpoints.getMe.initiate())
      expect(wasSessionActive()).toBe(false)

      server.use(http.get("*/api/me", () => HttpResponse.json(sysAdminMe)))
      await createStore().dispatch(meApi.endpoints.getMe.initiate())
      expect(wasSessionActive()).toBe(true)
    })
  })
})
