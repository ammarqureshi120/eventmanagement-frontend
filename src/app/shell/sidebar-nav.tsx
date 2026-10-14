import { LogOutIcon, TicketIcon } from "lucide-react"
import { useId, type ReactNode } from "react"
import { NavLink } from "react-router"

import type { MeResponse } from "@/api/generated/me"
import { useSignOut } from "@/features/auth"
import { ThemeToggle } from "@/features/theme"
import { navItemsFor, roleLabel } from "@/shared/auth"
import { cn } from "@/shared/lib/utils"

const NAV_ITEM = [
  "flex min-h-touch w-full items-center gap-3 rounded-md px-3 py-2 text-left text-label font-semibold text-muted-foreground",
  "transition-colors hover:bg-muted hover:text-foreground",
  "aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground",
  "[&_svg]:size-[1.125rem] [&_svg]:shrink-0",
].join(" ")

interface SidebarNavProps {
  me: MeResponse
  /** Called when a nav link is chosen (the drawer closes on navigation). */
  onNavigate?: () => void
  /** Rendered at the end of the brand row (the drawer's "Close menu" button). */
  brandEnd?: ReactNode
  className?: string
}

/**
 * Sidebar content (DESIGN Sidebar, UX-DR7/8/9): brand, org chip, main nav from `/api/me` nav areas,
 * the ACCOUNT group with "Sign out" (My account arrives with Story 1.7) and the labelled theme toggle
 * at the foot. Used by the desktop sidebar and the phone/tablet drawer.
 */
export function SidebarNav({ me, onNavigate, brandEnd, className }: SidebarNavProps) {
  const { signOut, pending } = useSignOut()
  const accountLabelId = useId()
  const items = navItemsFor(me.navAreas)

  return (
    <div data-slot="sidebar-nav" className={cn("flex min-h-full flex-col gap-5 px-4 py-5", className)}>
      <div className="-my-1 flex min-h-touch items-center gap-2.5 px-1">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground [&_svg]:size-5"
        >
          <TicketIcon />
        </span>
        <span className="min-w-0 flex-1 font-heading text-brand font-bold">EventHub</span>
        {brandEnd}
      </div>

      <div data-slot="org-chip" className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2.5">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-badge font-bold text-accent-foreground"
        >
          EH
        </span>
        <span className="grid min-w-0">
          <span className="text-label font-semibold">EventHub platform</span>
          <span className="text-hint text-muted-foreground">{roleLabel(me.role)}</span>
        </span>
      </div>

      <nav aria-label="Main navigation">
        <ul className="grid gap-1">
          {items.map(({ to, label, Icon }) => (
            <li key={to}>
              <NavLink to={to} end className={NAV_ITEM} onClick={onNavigate}>
                <Icon aria-hidden="true" />
                <span className="min-w-0">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div role="group" aria-labelledby={accountLabelId} className="grid gap-1">
        <p id={accountLabelId} className="px-3 pb-1 text-nav-label font-bold text-muted-foreground uppercase">
          Account
        </p>
        <button
          type="button"
          className={cn(NAV_ITEM, "cursor-pointer aria-busy:cursor-progress")}
          aria-busy={pending || undefined}
          onClick={() => void signOut()}
        >
          <LogOutIcon aria-hidden="true" />
          <span className="min-w-0">Sign out</span>
        </button>
      </div>

      <div className="mt-auto pt-2">
        <ThemeToggle variant="labelled" />
      </div>
    </div>
  )
}
