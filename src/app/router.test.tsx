import { render, screen } from "@testing-library/react"
import { createMemoryRouter, type RouteObject } from "react-router"
import { RouterProvider } from "react-router/dom"
import { describe, expect, it } from "vitest"

import { routes } from "./router"

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

describe("router", () => {
  it("lazy-loads the placeholder home route", async () => {
    renderAt("/")

    expect(await screen.findByRole("heading", { level: 1, name: "EventHub" })).toBeInTheDocument()
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
