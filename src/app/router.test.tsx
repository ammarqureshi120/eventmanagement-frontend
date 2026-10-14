import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { http, HttpResponse } from "msw"
import { createMemoryRouter, type RouteObject } from "react-router"
import { RouterProvider } from "react-router/dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { notifyUnauthorized } from "@/shared/api/unauthorized"
import { Toaster } from "@/shared/ui/sonner"
import { problem, sysAdminMe } from "@/test/msw/handlers"
import { server } from "@/test/msw/server"
import { renderRoutes, signedInAs } from "@/test/render"

import { routes } from "./router"
import { resetRouteFocusForTests } from "./shell/route-focus"
import { registerUnauthorizedRedirect } from "./unauthorized-redirect"

function renderAt(entry: Parameters<typeof renderRoutes>[1]) {
  const view = renderRoutes(routes, entry)
  render(<Toaster />)
  return view
}

const pathOf = (router: { state: { location: { pathname: string; search: string } } }) =>
  `${router.state.location.pathname}${router.state.location.search}`

describe("router", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )
    resetRouteFocusForTests()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    document.cookie = "XSRF-TOKEN=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/"
  })

  describe("/ (role home)", () => {
    it("sends a signed-in System Administrator to /platform", async () => {
      signedInAs()
      const { router } = renderAt("/")

      expect(await screen.findByRole("heading", { level: 1, name: "Platform overview" })).toBeInTheDocument()
      expect(pathOf(router)).toBe("/platform")
      expect(document.title).toBe("Platform overview · EventHub")
    })

    it("sends a signed-out visitor to /login without returnTo", async () => {
      const { router } = renderAt("/")

      expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument()
      expect(pathOf(router)).toBe("/login")
    })

    it("shows a calm error with Try again when /api/me fails", async () => {
      let calls = 0
      server.use(
        http.get("*/api/me", () => {
          calls += 1
          return calls === 1 ? problem(500, "server_error") : HttpResponse.json(sysAdminMe)
        }),
      )
      const { router } = renderAt("/")

      await userEvent.setup().click(await screen.findByRole("button", { name: "Try again" }))

      await waitFor(() => expect(pathOf(router)).toBe("/platform"))
    })
  })

  describe("session check failures", () => {
    it("RequireAuth shows the server-fault copy with Try again, which recovers", async () => {
      let calls = 0
      server.use(
        http.get("*/api/me", () => {
          calls += 1
          return calls === 1 ? problem(500, "server_error") : HttpResponse.json(sysAdminMe)
        }),
      )
      renderAt("/platform")

      expect(
        await screen.findByText(
          "Something went wrong on our side while loading this page. Your data is safe. Try again in a moment.",
        ),
      ).toBeInTheDocument()
      await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }))

      expect(await screen.findByRole("heading", { level: 1, name: "Platform overview" })).toBeInTheDocument()
    })

    it("says offline (not a server fault) when the network is down", async () => {
      server.use(http.get("*/api/me", () => HttpResponse.error()))
      renderAt("/platform")

      expect(await screen.findByText("You seem to be offline. Check your connection and try again.")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument()
    })

    it("Not found shows the session error with Try again when /api/me fails", async () => {
      server.use(http.get("*/api/me", () => problem(500, "server_error")))
      renderAt("/does-not-exist")

      expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument()
      expect(screen.queryByText("We couldn't find that")).not.toBeInTheDocument()
    })
  })

  describe("RequireAuth", () => {
    it("redirects a signed-out visitor to /login?returnTo=<path+search>", async () => {
      const { router } = renderAt("/platform?view=all")

      expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument()
      expect(pathOf(router)).toBe(`/login?returnTo=${encodeURIComponent("/platform?view=all")}`)
    })

    it("renders the app shell with the platform page for a signed-in System Administrator", async () => {
      signedInAs()
      renderAt("/platform")

      expect(await screen.findByRole("heading", { level: 1, name: "Platform overview" })).toBeInTheDocument()
      expect(screen.getByRole("heading", { level: 2, name: "Nothing to show yet" })).toBeInTheDocument()
      expect(screen.getByText("Organizations you create will show up here.")).toBeInTheDocument()
      expect(screen.getByRole("main")).toHaveAttribute("id", "main")

      const nav = screen.getAllByRole("navigation", { name: "Main navigation" })[0]
      expect(within(nav).getByRole("link", { name: "Platform overview" })).toHaveAttribute("aria-current", "page")
      expect(within(nav).getAllByRole("link")).toHaveLength(1)
      expect(screen.queryByRole("link", { name: /My account|Organizations/ })).not.toBeInTheDocument()
      expect(screen.getAllByRole("group", { name: "Account" })[0]).toHaveTextContent("Sign out")
      expect(screen.getAllByText("EventHub platform").length).toBeGreaterThan(0)
      expect(screen.getAllByRole("radiogroup", { name: "Theme" }).length).toBeGreaterThanOrEqual(2)
      expect(screen.getByRole("button", { name: /Sara Admin System Administrator/ })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument()
    })
  })

  describe("roles without a home yet", () => {
    it.each(["orgAdministrator", "eventManager"] as const)("shows No access at / for %s instead of a dead link", async (role) => {
      signedInAs({ ...sysAdminMe, role, navAreas: ["account"] })
      const { router } = renderAt("/")

      expect(await screen.findByRole("heading", { level: 1, name: "No access" })).toBeInTheDocument()
      expect(pathOf(router)).toBe("/")
    })
  })

  describe("RequireArea", () => {
    it("shows No access, naming the role, for an area outside the user's nav areas", async () => {
      signedInAs({ ...sysAdminMe, navAreas: ["account"] })
      renderAt("/platform")

      expect(await screen.findByRole("heading", { level: 1, name: "No access" })).toBeInTheDocument()
      expect(screen.getByRole("heading", { level: 2, name: "This area isn't available for your role" })).toBeInTheDocument()
      expect(
        screen.getByText("You're signed in as System Administrator. If you need access, ask an Org Administrator."),
      ).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "Go to home" })).toHaveAttribute("href", "/")
      expect(document.title).toBe("No access · EventHub")
    })
  })

  describe("Not found", () => {
    it("renders inside the shell when signed in", async () => {
      signedInAs()
      renderAt("/does-not-exist")

      expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument()
      expect(screen.getByRole("heading", { level: 2, name: "We couldn't find that" })).toBeInTheDocument()
      expect(screen.getByText("It may have been moved, or you may not have access to it.")).toBeInTheDocument()
      expect(screen.getByRole("link", { name: "Go to home" })).toHaveAttribute("href", "/")
      expect(screen.getAllByRole("navigation", { name: "Main navigation" }).length).toBeGreaterThan(0)
      expect(document.title).toBe("Not found · EventHub")
    })

    it("renders standalone when signed out, without redirecting", async () => {
      const { router } = renderAt("/does-not-exist")

      expect(await screen.findByRole("heading", { level: 1, name: "Page not found" })).toBeInTheDocument()
      expect(screen.queryByRole("navigation", { name: "Main navigation" })).not.toBeInTheDocument()
      expect(pathOf(router)).toBe("/does-not-exist")
    })
  })

  describe("sign in and sign out", () => {
    it("moves focus to the page H1 after signing in", async () => {
      let signedIn = false
      server.use(
        http.get("*/api/me", () => (signedIn ? HttpResponse.json(sysAdminMe) : problem(401, "session_expired"))),
        http.post("*/api/auth/login", () => {
          signedIn = true
          return new HttpResponse(null, { status: 200 })
        }),
      )
      const user = userEvent.setup()
      renderAt("/platform")

      await user.type(await screen.findByRole("textbox", { name: "Email" }), "sara@example.test")
      await user.type(screen.getByLabelText("Password"), "secret")
      await user.click(screen.getByRole("button", { name: "Sign in" }))

      const heading = await screen.findByRole("heading", { level: 1, name: "Platform overview" })
      await waitFor(() => expect(heading).toHaveFocus())
    })

    it("signs out from the user menu: logout → /login with the signed-out notice", async () => {
      let signedIn = true
      const calls: string[] = []
      server.use(
        http.get("*/api/me", () => (signedIn ? HttpResponse.json(sysAdminMe) : problem(401, "session_expired"))),
        http.post("*/api/auth/logout", ({ request }) => {
          calls.push(`logout ${request.headers.get("X-XSRF-TOKEN")}`)
          signedIn = false
          return new HttpResponse(null, { status: 204 })
        }),
      )
      const user = userEvent.setup()
      const { router } = renderAt("/platform")

      await user.click(await screen.findByRole("button", { name: /Sara Admin/ }))
      const menu = await screen.findByRole("menu")
      expect(within(menu).getByText("System Administrator")).toBeInTheDocument()
      expect(within(menu).queryByText("My account")).not.toBeInTheDocument()
      await user.click(within(menu).getByRole("menuitem", { name: "Sign out" }))

      expect(await screen.findByText("You're signed out. See you soon.")).toBeInTheDocument()
      expect(pathOf(router)).toBe("/login")
      expect(calls).toEqual(["logout test-xsrf-token"])
    })

    it("clears the cached session: after sign-out, going back to /platform asks for sign-in", async () => {
      let signedIn = true
      server.use(
        http.get("*/api/me", () => (signedIn ? HttpResponse.json(sysAdminMe) : problem(401, "session_expired"))),
        http.post("*/api/auth/logout", () => {
          signedIn = false
          return new HttpResponse(null, { status: 204 })
        }),
      )
      const user = userEvent.setup()
      const { router } = renderAt("/platform")

      const accountGroup = (await screen.findAllByRole("group", { name: "Account" }))[0]
      await user.click(within(accountGroup).getByRole("button", { name: "Sign out" }))
      expect(await screen.findByText("You're signed out. See you soon.")).toBeInTheDocument()

      await act(() => router.navigate("/platform"))

      await waitFor(() => expect(pathOf(router)).toBe(`/login?returnTo=${encodeURIComponent("/platform")}`))
    })

    it("sends one logout for two quick Sign out clicks", async () => {
      let logoutCalls = 0
      let signedIn = true
      server.use(
        http.get("*/api/me", () => (signedIn ? HttpResponse.json(sysAdminMe) : problem(401, "session_expired"))),
        http.post("*/api/auth/logout", async () => {
          logoutCalls += 1
          await new Promise((resolve) => setTimeout(resolve, 50))
          signedIn = false
          return new HttpResponse(null, { status: 204 })
        }),
      )
      const user = userEvent.setup()
      renderAt("/platform")

      const accountGroup = (await screen.findAllByRole("group", { name: "Account" }))[0]
      const button = within(accountGroup).getByRole("button", { name: "Sign out" })
      await user.dblClick(button)
      await user.click(button)

      expect(await screen.findByText("You're signed out. See you soon.")).toBeInTheDocument()
      expect(logoutCalls).toBe(1)
    })

    it("treats a 401 from logout as signed out", async () => {
      let signedIn = true
      server.use(
        http.get("*/api/me", () => (signedIn ? HttpResponse.json(sysAdminMe) : problem(401, "session_expired"))),
        http.post("*/api/auth/logout", () => {
          signedIn = false
          return problem(401, "session_expired")
        }),
      )
      const user = userEvent.setup()
      const { router } = renderAt("/platform")

      const accountGroup = (await screen.findAllByRole("group", { name: "Account" }))[0]
      await user.click(within(accountGroup).getByRole("button", { name: "Sign out" }))

      expect(await screen.findByText("You're signed out. See you soon.")).toBeInTheDocument()
      expect(pathOf(router)).toBe("/login")
    })

    it.each([
      ["a server error", () => problem(500, "server_error"), "We couldn't sign you out. Try again."],
      ["a network failure", () => HttpResponse.error(), "You seem to be offline. Check your connection and try again."],
    ])("stays put with an error toast on %s", async (_label, respond, message) => {
      signedInAs()
      server.use(http.post("*/api/auth/logout", respond))
      const user = userEvent.setup()
      const { router } = renderAt("/platform")

      const accountGroup = (await screen.findAllByRole("group", { name: "Account" }))[0]
      await user.click(within(accountGroup).getByRole("button", { name: "Sign out" }))

      expect(await screen.findByText(message)).toBeInTheDocument()
      expect(pathOf(router)).toBe("/platform")
    })
  })

  describe("drawer", () => {
    it("opens with focus on the current nav item, closes on Esc and returns focus to the menu button", async () => {
      signedInAs()
      const user = userEvent.setup()
      renderAt("/platform")

      const menuButton = await screen.findByRole("button", { name: "Open menu" })
      await user.click(menuButton)

      const drawer = await screen.findByRole("dialog", { name: "Menu" })
      await waitFor(() => expect(within(drawer).getByRole("link", { name: "Platform overview" })).toHaveFocus())
      expect(within(drawer).getByRole("button", { name: "Close menu" })).toBeInTheDocument()
      expect(within(drawer).getByRole("button", { name: "Sign out" })).toBeInTheDocument()
      expect(within(drawer).getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument()

      await user.keyboard("{Escape}")

      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument())
      expect(menuButton).toHaveFocus()
    })

    it("closes when a nav item is chosen", async () => {
      signedInAs()
      const user = userEvent.setup()
      renderAt("/platform")

      await user.click(await screen.findByRole("button", { name: "Open menu" }))
      const drawer = await screen.findByRole("dialog", { name: "Menu" })
      await user.click(within(drawer).getByRole("link", { name: "Platform overview" }))

      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument())
    })
  })

  describe("401 handler", () => {
    it("redirects a protected route to /login?returnTo= and leaves public routes alone", async () => {
      signedInAs()
      const { router, store } = renderAt("/platform")
      const unregister = registerUnauthorizedRedirect(router, store)
      try {
        await screen.findByRole("heading", { level: 1, name: "Platform overview" })

        server.use(http.get("*/api/me", () => problem(401, "session_expired")))
        act(() => notifyUnauthorized())

        await waitFor(() => expect(pathOf(router)).toBe(`/login?returnTo=${encodeURIComponent("/platform")}`))
        expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument()

        act(() => notifyUnauthorized())
        expect(pathOf(router)).toBe(`/login?returnTo=${encodeURIComponent("/platform")}`)
      } finally {
        unregister()
      }
    })
  })

  it("lazy-loads the /login Auth card from the auth feature", async () => {
    renderAt("/login")

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument()
  })

  it("shows the calm fallback when a lazy route fails to load", async () => {
    const failing: RouteObject[] = [
      {
        errorElement: routes[0].errorElement,
        children: [
          {
            path: "/",
            lazy: async () => {
              throw new Error("Failed to fetch dynamically imported module")
            },
          },
        ],
      },
    ]
    const router = createMemoryRouter(failing, { initialEntries: ["/"] })
    render(<RouterProvider router={router} />)

    expect(await screen.findByRole("heading", { level: 1, name: "Something went wrong" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument()
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument()
  })
})
