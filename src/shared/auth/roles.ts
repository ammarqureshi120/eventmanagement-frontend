import type { LucideIcon } from "lucide-react"
import { LayoutDashboardIcon } from "lucide-react"

import type { NavArea, UserRole } from "@/api/generated/me"

/** Visible role names (UX copy). */
export const ROLE_LABEL: Readonly<Record<UserRole, string>> = {
  systemAdministrator: "System Administrator",
  orgAdministrator: "Org Administrator",
  eventManager: "Event Manager",
}

/** Role label with a neutral fallback for role values this build does not know yet (open enums). */
export function roleLabel(role: string): string {
  return (ROLE_LABEL as Readonly<Record<string, string>>)[role] ?? "Team member"
}

/**
 * UX-DR8: each role's home screen, the first item of its nav, or `null` while that role has no home
 * route yet (Org Administrator and Event Manager homes arrive with Epic 2). Callers then go to `/`,
 * where `RoleHomeRedirect` shows No access instead of a dead link.
 */
export function roleHome(role: string): string | null {
  switch (role) {
    case "systemAdministrator":
      return "/platform"
    default:
      return null
  }
}

export interface NavItem {
  area: NavArea
  label: string
  to: string
  Icon: LucideIcon
}

/**
 * Main-nav items per nav area, in nav order. `account` maps to nothing until My account exists
 * (Story 1.7), and "Organizations" waits for its route and nav area (Epic 2).
 */
export const NAV_ITEMS: ReadonlyArray<NavItem> = [
  { area: "platform", label: "Platform overview", to: "/platform", Icon: LayoutDashboardIcon },
]

/** The nav items the signed-in user may see (FR-5: forbidden items are not rendered). */
export function navItemsFor(navAreas: ReadonlyArray<string>): NavItem[] {
  return NAV_ITEMS.filter((item) => navAreas.includes(item.area))
}
