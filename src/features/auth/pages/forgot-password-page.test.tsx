import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import type { RouteObject } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { registerNetworkToast } from "@/app/network-toast"
import { problem } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderRoutes, signedInAs } from "@/test/render"
import { Toaster } from "@/shared/ui/sonner"

import { ForgotPasswordPage } from "./forgot-password-page"

const GENERIC = "Something went wrong on our side. Your data is safe. Try again in a moment."
const confirmation = (email: string) =>
  `Check your inbox. If an account exists for ${email}, we've sent a reset link. It works once and expires in 1 hour.`

const routes: RouteObject[] = [
  {
    path: "/forgot-password",
    element: (
      <>
        <ForgotPasswordPage />
        <Toaster />
      </>
    ),
  },
  { path: "/login", element: <h1>Sign in page</h1> },
]

/** Records the body of every forgot-password call. */
function recordForgot(respond: () => Response = () => new HttpResponse(null, { status: 202 })) {
  const bodies: unknown[] = []
  server.use(
    http.post("*/api/auth/forgot-password", async ({ request }) => {
      bodies.push(await request.json())
      return respond()
    }),
  )
  return bodies
}

async function submit(email: string) {
  const user = userEvent.setup()
  const field = await screen.findByRole("textbox", { name: "Email" })
  if (email) {
    await user.type(field, email)
  }
  await user.click(screen.getByRole("button", { name: "Send reset link" }))
  return user
}

describe("ForgotPasswordPage", () => {
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
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
  })

  it("renders the Auth card: one H1, the Email field, the button, a way back and the title", async () => {
    renderRoutes(routes, "/forgot-password")

    expect(await screen.findByRole("heading", { level: 1, name: "Forgot your password?" })).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(document.title).toBe("Forgot password · EventHub")
    const email = screen.getByRole("textbox", { name: "Email" })
    expect(email).toHaveAttribute("type", "email")
    expect(email).toHaveAttribute("autocomplete", "email")
    expect(screen.getByRole("button", { name: "Send reset link" })).toHaveAttribute("type", "submit")
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login")
  })

  it("keeps an empty polite live region mounted before the confirmation arrives", async () => {
    renderRoutes(routes, "/forgot-password")
    await screen.findByRole("heading", { level: 1, name: "Forgot your password?" })

    const region = document.querySelector("main [aria-live='polite']")
    expect(region).toBeInTheDocument()
    expect(region).toBeEmptyDOMElement()

    await submit("sara@example.test")
    expect(await screen.findByRole("status")).toHaveTextContent(confirmation("sara@example.test"))
    expect(document.querySelector("main [aria-live='polite']")).toBe(region)
  })

  it("posts the trimmed email and replaces the form with the fixed confirmation", async () => {
    const bodies = recordForgot()
    renderRoutes(routes, "/forgot-password")

    await submit("  nobody@example.test ")

    const status = await screen.findByRole("status")
    expect(status).toHaveTextContent(confirmation("nobody@example.test"))
    // The submit button unmounted: focus moves to the confirmation, inside a live region that was already mounted.
    await waitFor(() => expect(status).toHaveFocus())
    expect(status.parentElement).toHaveAttribute("aria-live", "polite")
    expect(bodies).toEqual([{ email: "nobody@example.test" }])
    expect(screen.queryByRole("textbox", { name: "Email" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Send reset link" })).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Back to sign in" })).toHaveAttribute("href", "/login")
  })

  it.each([
    ["empty", "", "Enter your email address."],
    ["malformed", "sara@", "Enter an email like name@company.com."],
  ])("blocks a %s email on the client with the sign-in rule and sends nothing", async (_case, email, message) => {
    const bodies = recordForgot()
    renderRoutes(routes, "/forgot-password")

    await submit(email)

    const field = screen.getByRole("textbox", { name: "Email" })
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(field).toHaveAttribute("aria-invalid", "true")
    expect(field).toHaveFocus()
    expect(bodies).toEqual([])
  })

  it("puts a server validation message on the Email field", async () => {
    recordForgot(() => problem(400, "validation", { email: ["Enter an email like name@company.com."] }))
    renderRoutes(routes, "/forgot-password")

    await submit("sara@example.test")

    expect(await screen.findByText("Enter an email like name@company.com.")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAttribute("aria-invalid", "true")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("shows the offline toast and keeps the form when the network is down", async () => {
    recordForgot(() => HttpResponse.error())
    renderRoutes(routes, "/forgot-password")

    await submit("sara@example.test")

    expect(await screen.findByText("You seem to be offline. Check your connection and try again.")).toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("sara@example.test")
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("shows the generic Alert on a server error and keeps the form", async () => {
    recordForgot(() => problem(500, "server_error"))
    renderRoutes(routes, "/forgot-password")

    await submit("sara@example.test")

    expect(await screen.findByRole("alert")).toHaveTextContent(GENERIC)
    expect(screen.getByRole("textbox", { name: "Email" })).toHaveValue("sara@example.test")
  })

  it("works for a signed-in user without redirecting or asking /api/me", async () => {
    signedInAs()
    const calls: string[] = []
    const listener = ({ request }: { request: Request }) => {
      calls.push(`${request.method} ${new URL(request.url).pathname}`)
    }
    server.events.on("request:start", listener)
    try {
      const { router } = renderRoutes(routes, "/forgot-password")

      await submit("sara@example.test")

      expect(await screen.findByRole("status")).toHaveTextContent(confirmation("sara@example.test"))
      expect(router.state.location.pathname).toBe("/forgot-password")
      expect(calls).not.toContain("GET /api/me")
    } finally {
      server.events.removeListener("request:start", listener)
    }
  })
})
