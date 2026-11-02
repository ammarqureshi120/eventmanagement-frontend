import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import type { MeResponse } from "@/api/generated/me"
import { notifySessionActivity } from "@/shared/api/activity"
import {
  closeSessionChannelForTests,
  SESSION_CHANNEL_NAME,
  wasSessionActive,
  type SessionMessage,
} from "@/shared/auth/session-timer"
import { Toaster } from "@/shared/ui/sonner"
import { problem, sysAdminMe } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderRoutes } from "@/test/render"

import { registerNetworkToast } from "../network-toast"
import { routes } from "../router"
import { resetRouteFocusForTests } from "../shell/route-focus"
import { resetIdleWarningForTests } from "./idle-warning"

const MIN = 60_000
const IDLE_COPY = "You'll be signed out in 2 minutes to keep your account safe."
const ABSOLUTE_COPY = "Your session reaches its 12-hour limit in 2 minutes. Save your work, then sign in again."
const SESSION_ENDED = "Your session ended. Sign in again to continue."

/** Every API call in order, plus a switchable signed-in state for `/api/me` and logout. */
function api(me: MeResponse = sysAdminMe) {
  const state = { calls: [] as string[], signedIn: true, meStatus: null as null | (() => Response) }
  const listener = ({ request }: { request: Request }) => {
    const url = new URL(request.url)
    if (url.pathname.startsWith("/api")) {
      state.calls.push(`${request.method} ${url.pathname}`)
    }
  }
  server.events.on("request:start", listener)
  listeners.push(listener)
  server.use(
    http.get("*/api/me", () => {
      if (state.meStatus) {
        return state.meStatus()
      }
      return state.signedIn ? HttpResponse.json(me) : problem(401, "session_expired")
    }),
    http.post("*/api/auth/logout", () => {
      state.signedIn = false
      return new HttpResponse(null, { status: 204 })
    }),
  )
  return state
}

const listeners: Array<(event: { request: Request }) => void> = []

/** A second tab on the session channel. */
function otherTab() {
  const received: SessionMessage[] = []
  const channel = new BroadcastChannel(SESSION_CHANNEL_NAME)
  channel.onmessage = (event: MessageEvent<SessionMessage>) => received.push(event.data)
  tabs.push(channel)
  return { received, post: (message: SessionMessage) => channel.postMessage(message) }
}

const tabs: BroadcastChannel[] = []

async function renderShell() {
  const view = renderRoutes(routes, "/platform")
  render(<Toaster />)
  await screen.findByRole("heading", { level: 1, name: "Platform overview" })
  return view
}

const pathOf = (router: { state: { location: { pathname: string; search: string } } }) =>
  `${router.state.location.pathname}${router.state.location.search}`

/**
 * Moves the fake clock in steps of at most 1s: each countdown tick schedules the next one after React
 * renders, so a single big jump would only fire the first tick.
 */
async function advance(ms: number) {
  let left = ms
  // The quiet stretch before the warning is one timer; jump it in one go.
  const quiet = Math.max(0, left - 2 * MIN - 1000)
  if (quiet > 0) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(quiet)
    })
    left -= quiet
  }
  while (left > 0) {
    const step = Math.min(1000, left)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step)
    })
    left -= step
  }
}

describe("IdleWarning", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] })
    vi.setSystemTime(Date.parse("2026-11-02T08:00:00Z"))
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )
    resetRouteFocusForTests()
    resetIdleWarningForTests()
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    closeSessionChannelForTests()
    for (const channel of tabs.splice(0)) {
      channel.close()
    }
    for (const listener of listeners.splice(0)) {
      server.events.removeListener("request:start", listener)
    }
    localStorage.clear()
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
  })

  it("shows nothing before 28 idle minutes, then the calm alertdialog with a countdown and Stay focused", async () => {
    api()
    await renderShell()

    await advance(28 * MIN - 1000)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()

    await advance(1000)
    const dialog = await screen.findByRole("alertdialog", { name: "Still there?" })
    // The description covers the message and the countdown.
    expect(dialog).toHaveAccessibleDescription(`${IDLE_COPY} Time left2:00`)
    expect(within(dialog).getByRole("timer")).toHaveTextContent("2:00")
    expect(within(dialog).getByRole("button", { name: "Sign out" })).toBeInTheDocument()
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Stay signed in" })).toHaveFocus())

    await advance(1000)
    expect(within(dialog).getByRole("timer")).toHaveTextContent("1:59")
    await advance(64_000)
    expect(within(dialog).getByRole("timer")).toHaveTextContent("0:55")
  })

  it("Stay signed in sends one GET /api/me; its response closes the warning in every tab and returns focus", async () => {
    const state = api()
    const tab = otherTab()
    await renderShell()
    const userButton = screen.getByRole("button", { name: /Sara Admin/ })
    userButton.focus()

    await advance(28 * MIN)
    const dialog = await screen.findByRole("alertdialog")
    state.calls.length = 0
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(within(dialog).getByRole("button", { name: "Stay signed in" }))

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    await waitFor(() => expect(state.calls).toEqual(["GET /api/me"]))
    // The response is activity, shared with the other tabs (which close their warning on it).
    await waitFor(() => expect(tab.received).toContainEqual(expect.objectContaining({ type: "activity" })))
    await waitFor(() => expect(userButton).toHaveFocus())

    // The window starts again from the renewal.
    await advance(27 * MIN)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    await advance(1 * MIN + 1000)
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
  })

  it("Esc means Stay signed in", async () => {
    const state = api()
    await renderShell()

    await advance(28 * MIN)
    await screen.findByRole("alertdialog")
    state.calls.length = 0
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).keyboard("{Escape}")

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    await waitFor(() => expect(state.calls).toEqual(["GET /api/me"]))
  })

  it("a network failure on Stay signed in keeps the warning open, renews nothing and shows the offline toast", async () => {
    const state = api()
    const tab = otherTab()
    const unregister = registerNetworkToast()
    try {
      await renderShell()
      await advance(28 * MIN)
      const dialog = await screen.findByRole("alertdialog")
      state.meStatus = () => HttpResponse.error()
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
        within(dialog).getByRole("button", { name: "Stay signed in" }),
      )

      expect(await screen.findByText("You seem to be offline. Check your connection and try again.")).toBeInTheDocument()
      expect(screen.getByRole("alertdialog")).toBeInTheDocument()
      expect(tab.received.filter((message) => message.type === "activity")).toEqual([])
      // The window was not renewed: it still ends at 30 minutes.
      await advance(2 * MIN)
      expect(await screen.findByText(SESSION_ENDED)).toBeInTheDocument()
    } finally {
      unregister()
    }
  })

  it("Stay signed in does nothing while signing out", async () => {
    const state = api()
    let releaseLogout: () => void = () => undefined
    server.use(
      http.post("*/api/auth/logout", async () => {
        await new Promise<void>((resolve) => {
          releaseLogout = resolve
        })
        state.signedIn = false
        return new HttpResponse(null, { status: 204 })
      }),
    )
    await renderShell()
    await advance(28 * MIN)
    const dialog = await screen.findByRole("alertdialog")
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    await user.click(within(dialog).getByRole("button", { name: "Sign out" }))
    await waitFor(() => expect(state.calls).toContain("POST /api/auth/logout"))
    state.calls.length = 0

    await user.click(within(dialog).getByRole("button", { name: "Stay signed in" }))
    await user.keyboard("{Escape}")
    expect(state.calls).toEqual([])

    releaseLogout()
    expect(await screen.findByText("You're signed out. See you soon.")).toBeInTheDocument()
  })

  it("keeps the idle window across a shell remount (Not found and back)", async () => {
    api()
    const { router } = await renderShell()

    await advance(20 * MIN)
    await act(async () => {
      await router.navigate("/does-not-exist")
    })
    expect(await screen.findByText("We couldn't find that")).toBeInTheDocument()
    await act(async () => {
      await router.navigate("/platform")
    })
    await screen.findByRole("heading", { level: 1, name: "Platform overview" })

    // 28 minutes of total idle, not 28 minutes after the remount.
    await advance(7 * MIN)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    await advance(1 * MIN + 1000)
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
  })

  it("a 401 on Stay signed in takes the normal path: session-ended notice with returnTo", async () => {
    const state = api()
    const { router } = await renderShell()

    await advance(28 * MIN)
    const dialog = await screen.findByRole("alertdialog")
    state.signedIn = false
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
      within(dialog).getByRole("button", { name: "Stay signed in" }),
    )

    expect(await screen.findByText(SESSION_ENDED)).toBeInTheDocument()
    expect(pathOf(router)).toBe("/login?returnTo=%2Fplatform")
  })

  it("when the 12-hour limit comes first: its own copy, only OK, and OK sends nothing", async () => {
    const expiresAt = new Date(Date.now() + 10 * MIN).toISOString()
    const state = api({ ...sysAdminMe, sessionExpiresAt: expiresAt })
    const { router } = await renderShell()

    await advance(8 * MIN)
    const dialog = await screen.findByRole("alertdialog", { name: "Still there?" })
    expect(dialog).toHaveAccessibleDescription(`${ABSOLUTE_COPY} Time left2:00`)
    const buttons = within(dialog).getAllByRole("button")
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toHaveAccessibleName("OK")
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "OK" })).toHaveFocus())

    state.calls.length = 0
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(within(dialog).getByRole("button", { name: "OK" }))
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    expect(state.calls).toEqual([])

    // It stays closed until the limit, then the session ends locally.
    await advance(2 * MIN)
    expect(await screen.findByText(SESSION_ENDED)).toBeInTheDocument()
    expect(pathOf(router)).toBe("/login?returnTo=%2Fplatform")
  })

  it("when the window ends: /login with returnTo and the notice, the other tabs told, and no API call", async () => {
    const state = api()
    const tab = otherTab()
    const { router } = await renderShell()
    expect(wasSessionActive()).toBe(true)
    state.calls.length = 0

    await advance(30 * MIN)

    expect(await screen.findByText(SESSION_ENDED)).toBeInTheDocument()
    expect(pathOf(router)).toBe("/login?returnTo=%2Fplatform")
    await waitFor(() => expect(tab.received).toContainEqual({ type: "ended", reason: "sessionEnded" }))
    expect(wasSessionActive()).toBe(false)
    expect(state.calls).toEqual([])
  })

  it("another tab's activity resets the timers and closes an open warning", async () => {
    api()
    const tab = otherTab()
    await renderShell()

    await advance(28 * MIN)
    await screen.findByRole("alertdialog")
    tab.post({ type: "activity", at: Date.now() })

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument())
    await advance(27 * MIN)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    await advance(1 * MIN + 1000)
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
  })

  it("this tab's API responses renew the window and are shared with the other tabs", async () => {
    api()
    const tab = otherTab()
    await renderShell()

    await advance(20 * MIN)
    act(() => notifySessionActivity(Date.now()))
    await waitFor(() => expect(tab.received).toContainEqual(expect.objectContaining({ type: "activity" })))

    await advance(27 * MIN)
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
    await advance(1 * MIN)
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
  })

  it("another tab's end sends this tab to /login with the matching notice", async () => {
    api()
    const tab = otherTab()
    const { router } = await renderShell()

    tab.post({ type: "ended", reason: "accountDisabled" })

    expect(await screen.findByRole("alert")).toHaveTextContent("This account is disabled.")
    expect(pathOf(router)).toBe("/login")
  })

  it("another tab's sign-out sends this tab to /login with the signed-out notice", async () => {
    api()
    const tab = otherTab()
    const { router } = await renderShell()

    tab.post({ type: "signedOut" })

    expect(await screen.findByText("You're signed out. See you soon.")).toBeInTheDocument()
    expect(pathOf(router)).toBe("/login")
  })

  it("Sign out in the warning signs out and tells the other tabs", async () => {
    const state = api()
    const tab = otherTab()
    const { router } = await renderShell()

    await advance(28 * MIN)
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(
      within(dialog).getByRole("button", { name: "Sign out" }),
    )

    expect(await screen.findByText("You're signed out. See you soon.")).toBeInTheDocument()
    expect(pathOf(router)).toBe("/login")
    expect(state.calls).toContain("POST /api/auth/logout")
    await waitFor(() => expect(tab.received).toContainEqual({ type: "signedOut" }))
    expect(wasSessionActive()).toBe(false)
  })
})
