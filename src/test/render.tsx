import { render } from "@testing-library/react"
import { Provider } from "react-redux"
import { createMemoryRouter, type RouteObject } from "react-router"
import { RouterProvider } from "react-router/dom"
import { http, HttpResponse } from "msw"

import { createStore } from "@/app/store"

import { sysAdminMe } from "./msw/handlers"
import { server } from "./msw/server"

type InitialEntry = string | { pathname: string; search?: string; state?: unknown }

/** Renders routes in a memory data router with a fresh store; returns both for assertions. */
export function renderRoutes(routes: RouteObject[], initialEntry: InitialEntry = "/") {
  const store = createStore()
  const router = createMemoryRouter(routes, { initialEntries: [initialEntry] })
  const view = render(
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>,
  )
  return { ...view, store, router }
}

/** `GET /api/me` answers 200 with the given user (default: the seeded System Administrator). */
export function signedInAs(me = sysAdminMe) {
  server.use(http.get("*/api/me", () => HttpResponse.json(me)))
}
