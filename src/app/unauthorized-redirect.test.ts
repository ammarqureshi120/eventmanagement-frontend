import { afterEach, describe, expect, it, vi } from "vitest"

import { baseApi } from "@/shared/api/base-api"
import { notifyUnauthorized } from "@/shared/api/unauthorized"
import {
  closeSessionChannelForTests,
  markSessionActive,
  SESSION_CHANNEL_NAME,
  wasSessionActive,
  type SessionMessage,
} from "@/shared/auth/session-timer"
import type { SessionEndCode } from "@/shared/lib/problem"

import { registerUnauthorizedRedirect } from "./unauthorized-redirect"

type FakeState = {
  location: { pathname: string; search: string }
  matches: Array<{ route: { handle?: unknown } }>
  navigation: { state: "idle" | "loading" | "submitting" }
}

function setup(state: FakeState, code: SessionEndCode = "session_expired") {
  const navigate = vi.fn()
  const router = { state, navigate } as unknown as Parameters<typeof registerUnauthorizedRedirect>[0]
  const store = { dispatch: vi.fn() }
  const unregister = registerUnauthorizedRedirect(router, store)
  try {
    notifyUnauthorized(code)
  } finally {
    unregister()
  }
  return { navigate, dispatch: store.dispatch }
}

/** Another tab listening on the session channel. */
function otherTab() {
  const messages: SessionMessage[] = []
  const channel = new BroadcastChannel(SESSION_CHANNEL_NAME)
  channel.onmessage = (event: MessageEvent<SessionMessage>) => messages.push(event.data)
  return { messages, close: () => channel.close() }
}

const protectedMatches = [{ route: {} }, { route: { handle: { requiresAuth: true } } }]

describe("registerUnauthorizedRedirect", () => {
  afterEach(() => {
    closeSessionChannelForTests()
    localStorage.clear()
  })

  it("session_expired on a protected route: session-ended notice with returnTo, tells the other tabs", async () => {
    markSessionActive()
    const tab = otherTab()
    try {
      const { navigate, dispatch } = setup({
        location: { pathname: "/platform", search: "?a=1" },
        matches: protectedMatches,
        navigation: { state: "idle" },
      })

      expect(navigate).toHaveBeenCalledWith(`/login?returnTo=${encodeURIComponent("/platform?a=1")}`, {
        replace: true,
        state: { notice: "sessionEnded" },
      })
      // `/login` resets the cache once it has replaced the protected screens.
      expect(dispatch).not.toHaveBeenCalled()
      expect(wasSessionActive()).toBe(false)
      await vi.waitFor(() => expect(tab.messages).toEqual([{ type: "ended", reason: "sessionEnded" }]))
    } finally {
      tab.close()
    }
  })

  it("account_disabled: /login without returnTo and the disabled notice, in every tab", async () => {
    const tab = otherTab()
    try {
      const { navigate } = setup(
        { location: { pathname: "/platform", search: "" }, matches: protectedMatches, navigation: { state: "idle" } },
        "account_disabled",
      )

      expect(navigate).toHaveBeenCalledWith("/login", { replace: true, state: { notice: "accountDisabled" } })
      await vi.waitFor(() => expect(tab.messages).toEqual([{ type: "ended", reason: "accountDisabled" }]))
    } finally {
      tab.close()
    }
  })

  it("account_disabled during a navigation still goes straight to /login (the next request has no cookie)", () => {
    const { navigate } = setup(
      { location: { pathname: "/platform", search: "" }, matches: protectedMatches, navigation: { state: "loading" } },
      "account_disabled",
    )

    expect(navigate).toHaveBeenCalledWith("/login", { replace: true, state: { notice: "accountDisabled" } })
  })

  it("session_expired during a navigation: resets the API state, keeps the flag and leaves the redirect to the guard", () => {
    markSessionActive()
    const { navigate, dispatch } = setup({
      location: { pathname: "/platform", search: "" },
      matches: protectedMatches,
      navigation: { state: "loading" },
    })

    expect(dispatch).toHaveBeenCalledWith(baseApi.util.resetApiState())
    expect(navigate).not.toHaveBeenCalled()
    expect(wasSessionActive()).toBe(true)
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
