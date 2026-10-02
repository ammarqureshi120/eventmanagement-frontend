import { createBrowserRouter, redirect, type RouteObject } from "react-router"

import { RouteErrorPage } from "./routes/route-error-page"

/**
 * AD-18: React Router 8 data mode (no React Router Vite plugin). Every route is lazy so each
 * page ships as its own chunk. Feature routes register here through each feature's `index.ts`.
 * The pathless root route owns the error boundary, so a failed chunk load or render error shows
 * a calm fallback instead of the router's developer screen.
 */
export const routes: RouteObject[] = [
  {
    errorElement: <RouteErrorPage />,
    children: [
      {
        // Until sign-in exists (Story 1.4), the app opens on /login. Story 1.4 sends signed-in users to their role home instead.
        path: "/",
        loader: () => redirect("/login"),
      },
      {
        path: "/login",
        lazy: async () => ({ Component: (await import("@/features/auth")).LoginPage }),
      },
      {
        path: "*",
        lazy: async () => ({ Component: (await import("./routes/not-found-page")).NotFoundPage }),
      },
    ],
  },
]

export function createRouter() {
  return createBrowserRouter(routes)
}
