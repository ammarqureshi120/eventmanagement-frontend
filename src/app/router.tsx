import { createBrowserRouter, type RouteObject } from "react-router"

import { RequireArea } from "./routes/require-area"
import { REQUIRES_AUTH_HANDLE, RequireAuth } from "./routes/require-auth"
import { RootLayout } from "./routes/root-layout"
import { RouteErrorPage } from "./routes/route-error-page"
import { RoleHomeRedirect } from "./routes/role-home-redirect"

/**
 * AD-18: React Router 8 data mode (no React Router Vite plugin). Pages are lazy so each ships as its
 * own chunk; feature pages register here through each feature's `index.ts`. The pathless root route
 * owns the error boundary, so a failed chunk load or render error shows a calm fallback.
 *
 * - `/` → the role home (or `/login` when signed out).
 * - Protected routes: `RequireAuth` (→ `/login?returnTo=`) → `AppShell` → `RequireArea` → page.
 * - `*` → Not found, inside the shell when signed in and standalone otherwise.
 */
export const routes: RouteObject[] = [
  {
    Component: RootLayout,
    errorElement: <RouteErrorPage />,
    children: [
      { path: "/", Component: RoleHomeRedirect },
      {
        path: "/login",
        lazy: async () => ({ Component: (await import("@/features/auth")).LoginPage }),
      },
      {
        id: "protected",
        Component: RequireAuth,
        handle: REQUIRES_AUTH_HANDLE,
        children: [
          {
            lazy: async () => ({ Component: (await import("./shell/app-shell")).AppShell }),
            children: [
              {
                element: <RequireArea area="platform" />,
                children: [
                  {
                    path: "/platform",
                    lazy: async () => ({ Component: (await import("@/features/platform")).PlatformOverviewPage }),
                  },
                ],
              },
            ],
          },
        ],
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
