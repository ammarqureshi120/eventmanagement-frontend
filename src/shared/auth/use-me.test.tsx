import { renderHook, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import type { ReactNode } from "react"
import { Provider } from "react-redux"
import { describe, expect, it } from "vitest"

import { createStore } from "@/app/store"
import { problem, sysAdminMe } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"

import { useMe } from "./use-me"

function renderUseMe() {
  const store = createStore()
  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>
  return renderHook(() => useMe(), { wrapper })
}

describe("useMe", () => {
  it("starts loading, then is signedIn with the /api/me body", async () => {
    server.use(http.get("*/api/me", () => HttpResponse.json(sysAdminMe)))
    const { result } = renderUseMe()

    expect(result.current.status).toBe("loading")
    await waitFor(() => expect(result.current.status).toBe("signedIn"))
    expect(result.current.me).toEqual(sysAdminMe)
  })

  it("is signedOut on 401", async () => {
    server.use(http.get("*/api/me", () => problem(401, "session_expired")))
    const { result } = renderUseMe()

    await waitFor(() => expect(result.current.status).toBe("signedOut"))
    expect(result.current.me).toBeUndefined()
  })

  it.each([
    [
      "a 401 with a non-JSON body",
      () => new HttpResponse("<html>Unauthorized</html>", { status: 401, headers: { "Content-Type": "text/html" } }),
    ],
    ["account_disabled", () => problem(403, "account_disabled")],
  ])("is signedOut on %s", async (_label, respond) => {
    server.use(http.get("*/api/me", respond))
    const { result } = renderUseMe()

    await waitFor(() => expect(result.current.status).toBe("signedOut"))
  })

  it.each([
    ["a server error", () => problem(500, "server_error"), "server_error"],
    ["a network failure", () => HttpResponse.error(), "network"],
  ])("is error on %s and exposes the problem code", async (_label, respond, code) => {
    server.use(http.get("*/api/me", respond))
    const { result } = renderUseMe()

    await waitFor(() => expect(result.current.status).toBe("error"))
    expect(result.current.problemCode).toBe(code)
  })
})
