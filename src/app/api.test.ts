import { http, HttpResponse } from "msw"
import { afterEach, describe, expect, it } from "vitest"

import { createStore } from "@/app/store"
import { generatedApi } from "@/api/generated/auth"
import { server } from "@/test/msw/server"

import { baseApi, XSRF_HEADER } from "@/shared/api/base-api"

const probeApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    probeGet: build.query<{ ok: boolean }, void>({ query: () => ({ url: "/api/probe" }) }),
    probeSend: build.mutation<{ ok: boolean }, string>({ query: (method) => ({ url: "/api/probe", method }) }),
  }),
})

describe("baseApi", () => {
  afterEach(() => {
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
  })

  function captureXsrfHeader() {
    const seen: { header?: string | null } = {}
    server.use(
      http.all("*/api/probe", ({ request }) => {
        seen.header = request.headers.get(XSRF_HEADER)
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
})
