import { Outlet } from "react-router"

import { RouteFocus } from "../shell/route-focus"

/** Root layout: every page, in or out of the shell, gets H1 focus on route change (UX-DR48). */
export function RootLayout() {
  return (
    <>
      <Outlet />
      <RouteFocus />
    </>
  )
}
