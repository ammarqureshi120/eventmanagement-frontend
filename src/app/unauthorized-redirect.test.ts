import { describe, expect, it, vi } from "vitest"

import { baseApi } from "@/shared/api/base-api"
import { notifyUnauthorized } from "@/shared/api/unauthorized"

import { registerUnauthorizedRedirect } from "./unauthorized-redirect"

type FakeState = {
  location: { pathname: string; search: string }
  matches: Array<{ route: { handle?: unknown } }>
  navigation: { state: "idle" | "loading" | "submitting" }
}

function setup(state: FakeState) {
  const navigate = vi.fn()
  const router = { state, navigate } as unknown as Parameters<typeof registerUnauthorizedRedirect>[0]
  const store = { dispatch: vi.fn() }
  const unregister = registerUnauthorizedRedirect(router, store)
  try {
    notifyUnauthorized()
  } finally {
    unregister()
  }
  return { navigate, dispatch: store.dispatch }
}

const protectedMatches = [{ route: {} }, { route: { handle: { requiresAuth: true } } }]

describe("registerUnauthorizedRedirect", () => {
  it("on a protected route: resets the API state and redirects with returnTo", () => {
    const { navigate, dispatch } = setup({
      location: { pathname: "/platform", search: "?a=1" },
      matches: protectedMatches,
      navigation: { state: "idle" },
    })

    expect(dispatch).toHaveBeenCalledWith(baseApi.util.resetApiState())
    expect(navigate).toHaveBeenCalledWith(`/login?returnTo=${encodeURIComponent("/platform?a=1")}`, { replace: true })
  })

  it("during a navigation: still resets the API state but leaves the redirect to the destination guard", () => {
    const { navigate, dispatch } = setup({
      location: { pathname: "/platform", search: "" },
      matches: protectedMatches,
      navigation: { state: "loading" },
    })

    expect(dispatch).toHaveBeenCalledWith(baseApi.util.resetApiState())
    expect(navigate).not.toHaveBeenCalled()
  })

  it("on a public route: does nothing", () => {
    const { navigate, dispatch } = setup({
      location: { pathname: "/login", search: "" },
      matches: [{ route: {} }],
      navigation: { state: "idle" },
    })

    expect(dispatch).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })
})
