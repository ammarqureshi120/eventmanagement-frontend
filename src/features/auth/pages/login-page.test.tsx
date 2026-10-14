import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import type { RouteObject } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { problem, sysAdminMe } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderRoutes, signedInAs } from "@/test/render"
import { Toaster } from "@/shared/ui/sonner"

import { LoginPage } from "./login-page"

const INVALID_CREDENTIALS =
  "Email or password is incorrect. Check both and try again. After 5 tries, sign-in pauses for 15 minutes."
const GENERIC = "Something went wrong on our side. Your data is safe. Try again in a moment."

const routes: RouteObject[] = [
  {
    path: "/login",
    element: (
      <>
        <LoginPage />
        <Toaster />
      </>
    ),
  },
  { path: "/platform", element: <h1>Platform overview</h1> },
  { path: "/events/:id", element: <h1>Event page</h1> },
]

function renderLogin(entry: Parameters<typeof renderRoutes>[1] = "/login") {
  return renderRoutes(routes, entry)
}

/** Listeners added by `statefulAuthApi`, removed (only these) after each test. */
const requestListeners: Array<Parameters<typeof server.events.on<"request:start">>[1]> = []

/** Stateful API: /api/me is 401 until a successful login. Records every API call in order. */
function statefulAuthApi() {
  const calls: string[] = []
  let signedIn = false
  const listener: (typeof requestListeners)[number] = ({ request }) => {
    const url = new URL(request.url)
    if (url.pathname.startsWith("/api")) {
      calls.push(`${request.method} ${url.pathname}`)
    }
  }
  server.events.on("request:start", listener)
  requestListeners.push(listener)
  server.use(
    http.get("*/api/me", () => (signedIn ? HttpResponse.json(sysAdminMe) : problem(401, "session_expired"))),
    http.post("*/api/auth/login", ({ request }) => {
      if (!request.headers.get("X-XSRF-TOKEN")) {
        return problem(400, "validation")
      }
      signedIn = true
      return new HttpResponse(null, { status: 200 })
    }),
  )
  return calls
}

async function submit(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(await screen.findByRole("textbox", { name: "Email" }), email)
  await user.type(screen.getByLabelText("Password"), password)
  await user.click(screen.getByRole("button", { name: "Sign in" }))
  return user
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    document.documentElement.classList.remove("dark")
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
    for (const listener of requestListeners.splice(0)) {
      server.events.removeListener("request:start", listener)
    }
  })

  it("restores the previous document title on unmount", async () => {
    document.title = "Before"
    const { unmount } = renderLogin()
    await screen.findByRole("heading", { level: 1, name: "Sign in" })
    expect(document.title).toBe("Sign in · EventHub")

    unmount()

    expect(document.title).toBe("Before")
  })

  it("renders the Auth card: one H1, fields, forgot link, sign-in button, skip link first, title", async () => {
    renderLogin()

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(document.title).toBe("Sign in · EventHub")
    expect(screen.getByText("EventHub")).toBeInTheDocument()

    const email = screen.getByRole("textbox", { name: "Email" })
    expect(email).toHaveAttribute("type", "email")
    expect(email).toHaveAttribute("autocomplete", "email")
    const password = screen.getByLabelText("Password")
    expect(password).toHaveAttribute("type", "password")
    expect(password).toHaveAttribute("autocomplete", "current-password")

    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password")
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveAttribute("type", "submit")
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument()

    const user = userEvent.setup()
    await user.tab()
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(screen.getByRole("main")).toHaveFocus()
  })

  it("shows inline errors for empty fields, focuses the first invalid field and calls no login", async () => {
    const calls = statefulAuthApi()
    const user = userEvent.setup()
    renderLogin()

    await user.click(await screen.findByRole("button", { name: "Sign in" }))

    const email = screen.getByRole("textbox", { name: "Email" })
    expect(email).toHaveAttribute("aria-invalid", "true")
    expect(email).toHaveAccessibleDescription("Enter your email address.")
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Enter your password.")
    expect(email).toHaveFocus()
    expect(calls.filter((call) => call.startsWith("POST"))).toEqual([])
  })

  it("rejects a malformed email", async () => {
    renderLogin()

    await submit("sara@", "secret")

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAccessibleDescription(
      "Enter an email like name@company.com.",
    )
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("aria-invalid")
  })

  it("signs in: antiforgery → login → token refresh → /api/me → lands on /platform", async () => {
    const calls = statefulAuthApi()
    const { router } = renderLogin()

    await submit("sara@example.test", "secret")

    expect(await screen.findByRole("heading", { level: 1, name: "Platform overview" })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/platform")
    const afterSubmit = calls.slice(calls.indexOf("GET /api/auth/antiforgery"))
    expect(afterSubmit).toEqual([
      "GET /api/auth/antiforgery",
      "POST /api/auth/login",
      "GET /api/auth/antiforgery",
      "GET /api/me",
    ])
  })

  it("returns to a safe returnTo after signing in", async () => {
    statefulAuthApi()
    const { router } = renderLogin("/login?returnTo=%2Fevents%2F7%3Ftab%3Da")

    await submit("sara@example.test", "secret")

    expect(await screen.findByRole("heading", { level: 1, name: "Event page" })).toBeInTheDocument()
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe("/events/7?tab=a")
  })

  it.each(["//evil.com", "https://evil.com", "/\\evil.com", "/login"])(
    "ignores the unsafe returnTo %s and lands on the role home",
    async (returnTo) => {
      statefulAuthApi()
      const { router } = renderLogin(`/login?returnTo=${encodeURIComponent(returnTo)}`)

      await submit("sara@example.test", "secret")

      await waitFor(() => expect(router.state.location.pathname).toBe("/platform"))
    },
  )

  it("on invalid_credentials keeps the email, clears and focuses the password, and shows the Alert", async () => {
    server.use(http.post("*/api/auth/login", () => problem(401, "invalid_credentials")))
    const { router } = renderLogin()

    await submit("sara@example.test", "wrong")

    expect(await screen.findByRole("alert")).toHaveTextContent(INVALID_CREDENTIALS)
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("sara@example.test")
    const password = screen.getByLabelText("Password")
    expect(password).toHaveValue("")
    expect(password).toHaveFocus()
    expect(router.state.location.pathname).toBe("/login")
  })

  it("puts server validation messages on their fields and focuses the first", async () => {
    server.use(
      http.post("*/api/auth/login", () =>
        problem(400, "validation", { email: ["Enter an email like name@company.com."], password: ["Enter your password."] }),
      ),
    )
    renderLogin()

    await submit("sara@example.test", "x")

    const email = screen.getByRole("textbox", { name: "Email" })
    await waitFor(() => expect(email).toHaveAccessibleDescription("Enter an email like name@company.com."))
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Enter your password.")
    expect(email).toHaveFocus()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("retries an antiforgery rejection once, then shows the generic Alert", async () => {
    let attempts = 0
    server.use(
      http.post("*/api/auth/login", () => {
        attempts += 1
        return problem(400, "validation")
      }),
    )
    renderLogin()

    await submit("sara@example.test", "secret")

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC)
    expect(attempts).toBe(2)
    expect(screen.getByLabelText("Password")).toHaveValue("secret")
  })

  it("shows the generic Alert on a server error and keeps the data", async () => {
    server.use(http.post("*/api/auth/login", () => problem(500, "server_error")))
    renderLogin()

    await submit("sara@example.test", "secret")

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC)
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("sara@example.test")
  })

  it("shows the offline toast when the network is down and keeps the data", async () => {
    server.use(http.post("*/api/auth/login", () => HttpResponse.error()))
    renderLogin()

    await submit("sara@example.test", "secret")

    expect(await screen.findByText("You seem to be offline. Check your connection and try again.")).toBeInTheDocument()
    expect(screen.getByLabelText("Password")).toHaveValue("secret")
  })

  it("shows the signed-out notice from router state once, then clears it from history state", async () => {
    const { router } = renderLogin({ pathname: "/login", search: "?returnTo=%2Fplatform", state: { notice: "signedOut" } })

    expect(await screen.findByRole("status")).toHaveTextContent("You're signed out. See you soon.")
    await waitFor(() => expect(router.state.location.state).toBeNull())
    expect(`${router.state.location.pathname}${router.state.location.search}`).toBe("/login?returnTo=%2Fplatform")
    // Still shown on this visit; a reload (no state) would not show it again.
    expect(screen.getByRole("status")).toHaveTextContent("You're signed out. See you soon.")
  })

  it("shows the disabled-account message on account_disabled", async () => {
    server.use(http.post("*/api/auth/login", () => problem(401, "account_disabled")))
    renderLogin()

    await submit("sara@example.test", "secret")

    expect(await screen.findByRole("alert")).toHaveTextContent("This account is disabled.")
    expect(screen.getByRole("button", { name: "Sign in" })).not.toHaveAttribute("aria-busy")
  })

  it("stays on /login with the generic Alert when /api/me fails after a successful login", async () => {
    server.use(http.get("*/api/me", () => problem(500, "server_error")))
    const { router } = renderLogin()

    await submit("sara@example.test", "secret")

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC)
    expect(router.state.location.pathname).toBe("/login")
    // pending was reset: the button is usable again.
    expect(screen.getByRole("button", { name: "Sign in" })).not.toHaveAttribute("aria-busy")
  })

  it("sends a signed-in user home", async () => {
    signedInAs()
    const { router } = renderLogin()

    expect(await screen.findByRole("heading", { level: 1, name: "Platform overview" })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/platform")
  })
})
