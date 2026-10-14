import { Outlet } from "react-router"

import type { NavArea } from "@/api/generated/me"
import { useMe } from "@/shared/auth"

import { AppLoading } from "./app-loading"
import { NoAccessPage } from "./no-access-page"

/** Renders an area's routes only when `/api/me` lists that nav area; otherwise the No access page (AD-9). */
export function RequireArea({ area }: { area: NavArea }) {
  const { me } = useMe()

  if (!me) {
    return <AppLoading />
  }
  if (!me.navAreas.includes(area)) {
    return <NoAccessPage role={me.role} />
  }
  return <Outlet />
}
