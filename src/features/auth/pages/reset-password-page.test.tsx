import { screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import type { RouteObject } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { registerNetworkToast } from "@/app/network-toast"
import { problem } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderRoutes, signedInAs } from "@/test/render"
import { Toaster } from "@/shared/ui/sonner"

import { ResetPasswordPage } from "./reset-password-page"

const TOKEN = "tok-Abc_123-secret"
const MISMATCH = "This doesn't match the password above. Type it again."
const GENERIC = "Something went wrong on our side. Your data is safe. Try again in a moment."

const routes: RouteObject[] = [
  {
    path: "/reset-password",
    element: (
      <>
        <ResetPasswordPage />
        <Toaster />
      </>
    ),
  },
  { path: "/login", element: <h1>Sign in page</h1> },
  { path: "/forgot-password", element: <h1>Forgot page</h1> },
]

function renderReset(search = `?token=${TOKEN}`) {
  return renderRoutes(routes, { pathname: "/reset-password", search })
}

/** Records the body of every reset-password call; answers with `respond` (default 200 with the email). */
function recordReset(respond: () => Response = () => HttpResponse.json({ email: "sara@example.test" })) {
  const bodies: unknown[] = []
  server.use(
    http.post("*/api/auth/reset-password", async ({ request }) => {
      bodies.push(await request.json())
      return respond()
    }),
  )
  return bodies
}

const newPasswordField = () => screen.getByLabelText("New password")
const confirmField = () => screen.getByLabelText("Confirm new password")

function ruleTexts() {
  return within(screen.getByRole("list", { name: "Password rules" }))
    .getAllByRole("listitem")
    .map((row) => row.textContent)
}

async function fillAndSave(password: string, confirm = password) {
  const user = userEvent.setup()
  await screen.findByRole("heading", { level: 1, name: "Set a new password" })
  await user.type(newPasswordField(), password)
  await user.type(confirmField(), confirm)
  await user.click(screen.getByRole("button", { name: "Save new password" }))
  return user
}

describe("ResetPasswordPage", () => {
  let unregisterNetworkToast: () => void = () => undefined
  beforeEach(() => {
    unregisterNetworkToast = registerNetworkToast()
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )
  })
  afterEach(() => {
    unregisterNetworkToast()
    vi.unstubAllGlobals()
    localStorage.clear()
    sessionStorage.clear()
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
  })

  it("strips the token from the URL on load and shows the form with the lead and the checklist", async () => {
    const { router } = renderReset()

    expect(await screen.findByRole("heading", { level: 1, name: "Set a new password" })).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByText("Other devices will be signed out.")).toBeInTheDocument()
    expect(document.title).toBe("Set a new password · EventHub")
    await waitFor(() => expect(router.state.location.search).toBe(""))
    expect(router.state.location.pathname).toBe("/reset-password")

    expect(newPasswordField()).toHaveAttribute("autocomplete", "new-password")
    expect(confirmField()).toHaveAttribute("autocomplete", "new-password")
    const rules = screen.getByRole("list", { name: "Password rules" })
    // The checklist describes the New password field.
    const describedBy = newPasswordField().getAttribute("aria-describedby")?.split(" ") ?? []
    expect(describedBy.some((id) => document.getElementById(id)?.contains(rules))).toBe(true)
    expect(ruleTexts()).toEqual(["8+ characters: not yet", "A letter: not yet", "A number: not yet"])
  })

  it("shows the expired-link card without any request when there is no token", async () => {
    const bodies = recordReset()
    renderReset("")

    expect(await screen.findByRole("heading", { level: 1, name: "This reset link has expired" })).toBeInTheDocument()
    expect(screen.getByText("Reset links work once and expire after 1 hour.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Get a new link" })).toHaveAttribute("href", "/forgot-password")
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument()
    expect(bodies).toEqual([])
  })

  it("ticks the rules live as the user types", async () => {
    renderReset()
    const user = userEvent.setup()
    await screen.findByRole("heading", { level: 1, name: "Set a new password" })

    await user.type(newPasswordField(), "abc1")

    expect(ruleTexts()).toEqual(["8+ characters: not yet", "A letter: done", "A number: done"])
    // No field error while typing before the first submit; the checklist is the feedback.
    expect(newPasswordField()).not.toHaveAttribute("aria-invalid")
  })

  it("validates Confirm only once its length reaches the first field's, then live", async () => {
    renderReset()
    const user = userEvent.setup()
    await screen.findByRole("heading", { level: 1, name: "Set a new password" })

    await user.type(newPasswordField(), "abcdefg1")
    await user.type(confirmField(), "abcdefg")
    await user.tab()
    expect(screen.queryByText(MISMATCH)).not.toBeInTheDocument()

    await user.type(confirmField(), "2")
    expect(await screen.findByText(MISMATCH)).toBeInTheDocument()
    expect(confirmField()).toHaveAttribute("aria-invalid", "true")

    // Live from now on: shorter again still shows it; a match clears it.
    await user.type(confirmField(), "{Backspace}")
    expect(screen.getByText(MISMATCH)).toBeInTheDocument()
    await user.type(confirmField(), "1")
    await waitFor(() => expect(screen.queryByText(MISMATCH)).not.toBeInTheDocument())

    // Changing the first field re-checks Confirm.
    await user.type(newPasswordField(), "x")
    expect(await screen.findByText(MISMATCH)).toBeInTheDocument()
  })

  it("counts Confirm's length in code points, like the policy", async () => {
    renderReset()
    const user = userEvent.setup()
    await screen.findByRole("heading", { level: 1, name: "Set a new password" })

    // New "ab😀1" is 4 code points (5 UTF-16 units): a 4-character Confirm is already long enough.
    await user.type(newPasswordField(), "ab\u{1F600}1")
    await user.type(confirmField(), "abcd")
    expect(await screen.findByText(MISMATCH)).toBeInTheDocument()
  })

  it("blocks the submit on a mismatch or a weak password, with no request", async () => {
    const bodies = recordReset()
    renderReset()

    await fillAndSave("abc", "abd")

    expect(await screen.findByText("Use at least 8 characters.")).toBeInTheDocument()
    expect(screen.getByText(MISMATCH)).toBeInTheDocument()
    expect(newPasswordField()).toHaveFocus()
    expect(bodies).toEqual([])
  })

  it("on 200 goes to /login with the passwordUpdated notice and the returned email; the token was sent only in the body", async () => {
    const bodies = recordReset(() => HttpResponse.json({ email: "Sara@Example.test" }))
    const urls: string[] = []
    const listener = ({ request }: { request: Request }) => {
      urls.push(request.url)
    }
    server.events.on("request:start", listener)
    try {
      const { router } = renderReset()

      await fillAndSave("Passw0rd!")

      expect(await screen.findByRole("heading", { level: 1, name: "Sign in page" })).toBeInTheDocument()
      expect(router.state.location.pathname).toBe("/login")
      expect(router.state.location.state).toEqual({ notice: "passwordUpdated", email: "Sara@Example.test" })
      expect(bodies).toEqual([{ token: TOKEN, newPassword: "Passw0rd!" }])
      expect(urls.some((url) => url.includes(TOKEN))).toBe(false)
    } finally {
      server.events.removeListener("request:start", listener)
    }
  })

  it("puts a server policy error under New password, keeps the token and lets the user retry", async () => {
    let first = true
    const bodies = recordReset(() => {
      if (first) {
        first = false
        return problem(400, "validation", { newPassword: ["Include at least one number."] })
      }
      return HttpResponse.json({ email: "sara@example.test" })
    })
    const { router } = renderReset()

    const user = await fillAndSave("Password1")

    expect(await screen.findByText("Include at least one number.")).toBeInTheDocument()
    expect(newPasswordField()).toHaveAttribute("aria-invalid", "true")
    expect(newPasswordField()).toHaveFocus()
    expect(router.state.location.pathname).toBe("/reset-password")

    await user.click(screen.getByRole("button", { name: "Save new password" }))
    await waitFor(() => expect(router.state.location.pathname).toBe("/login"))
    expect(bodies).toEqual([
      { token: TOKEN, newPassword: "Password1" },
      { token: TOKEN, newPassword: "Password1" },
    ])
  })

  it.each([undefined, "expired", "used"])("shows the expired-link card on token_invalid (reason %s)", async (reason) => {
    recordReset(() =>
      HttpResponse.json(
        { type: "about:blank", title: "x", status: 400, code: "token_invalid", traceId: "t", ...(reason ? { reason } : {}) },
        { status: 400, headers: { "Content-Type": "application/problem+json" } },
      ),
    )
    renderReset()

    await fillAndSave("Passw0rd!")

    const heading = await screen.findByRole("heading", { level: 1, name: "This reset link has expired" })
    expect(heading).toHaveFocus()
    expect(screen.getByRole("link", { name: "Get a new link" })).toHaveAttribute("href", "/forgot-password")
    expect(screen.queryByLabelText("New password")).not.toBeInTheDocument()
  })

  it("shows the offline toast and keeps the form when the network is down", async () => {
    recordReset(() => HttpResponse.error())
    renderReset()

    await fillAndSave("Passw0rd!")

    expect(await screen.findByText("You seem to be offline. Check your connection and try again.")).toBeInTheDocument()
    expect(newPasswordField()).toHaveValue("Passw0rd!")
    expect(confirmField()).toHaveValue("Passw0rd!")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows the generic Alert on a server error and keeps the form", async () => {
    recordReset(() => problem(500, "server_error"))
    renderReset()

    await fillAndSave("Passw0rd!")

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC)
    expect(newPasswordField()).toHaveValue("Passw0rd!")
  })

  it("never puts the token in storage or the console, and works signed in without asking /api/me", async () => {
    signedInAs()
    const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    )
    const calls: string[] = []
    const listener = ({ request }: { request: Request }) => {
      calls.push(`${request.method} ${new URL(request.url).pathname}`)
    }
    server.events.on("request:start", listener)
    try {
      recordReset()
      const { router } = renderReset()

      await fillAndSave("Passw0rd!")
      await waitFor(() => expect(router.state.location.pathname).toBe("/login"))

      const stored = [localStorage, sessionStorage].flatMap((storage) =>
        Object.keys(storage).map((key) => `${key}=${storage.getItem(key)}`),
      )
      expect(stored.join("\n")).not.toContain(TOKEN)
      for (const spy of consoleSpies) {
        expect(JSON.stringify(spy.mock.calls)).not.toContain(TOKEN)
      }
      expect(calls).not.toContain("GET /api/me")
    } finally {
      server.events.removeListener("request:start", listener)
    }
  })
})
