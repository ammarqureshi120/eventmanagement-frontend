import { render, screen } from "@testing-library/react"
import { Provider } from "react-redux"
import { createMemoryRouter, type RouteObject } from "react-router"
import { RouterProvider } from "react-router/dom"
import { describe, expect, it } from "vitest"

import { routes } from "./router"
import { createStore } from "./store"

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <Provider store={createStore()}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe("router", () => {
  it("redirects / to the /login Sign in page", async () => {
    const router = createMemoryRouter(routes, { initialEntries: ["/"] })
    render(
      <Provider store={createStore()}>
        <RouterProvider router={router} />
      </Provider>,
    )

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe("/login")
  })

  it("lazy-loads the /login Auth card from the auth feature", async () => {
    renderAt("/login")

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument()
  })

  it("renders the not-found page for unknown paths", async () => {
    renderAt("/does-not-exist")

    expect(await screen.findByRole("heading", { level: 1, name: /couldn.t find that page/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go to home" })).toHaveAttribute("href", "/")
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
