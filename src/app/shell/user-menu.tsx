import { LogOutIcon, UserRoundIcon } from "lucide-react"
import { Link } from "react-router"

import type { MeResponse } from "@/api/generated/me"
import { useSignOut } from "@/features/auth"
import { fullNameOf, initialsOf, roleLabel } from "@/shared/auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu"
import { Spinner } from "@/shared/ui/spinner"

/**
 * User button + menu (UX-DR9/45): 34px initials avatar plus name and role (avatar only below 640px; the
 * name stays in the accessible name). The menu shows name + role, "My account" (when the `account` nav area is
 * listed; Story 1.7), a divider, then "Sign out". Long names wrap.
 */
export function UserMenu({ me }: { me: MeResponse }) {
  const { signOut, pending } = useSignOut()
  const name = fullNameOf(me)
  const role = roleLabel(me.role)

  return (
    // Non-modal: nothing behind it is aria-hidden while it is open; Esc, Tab and outside clicks still close it.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        data-slot="user-button"
        className={[
          // No shrink-0 and capped at max-w-full: the button shrinks to the bar width, so a long name wraps inside it.
          "inline-flex min-h-touch min-w-touch max-w-full cursor-pointer items-center justify-center gap-2.5 rounded-md px-1.5 text-left",
          "transition-colors hover:bg-muted data-[state=open]:bg-muted sm:pr-3",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className="grid min-h-[34px] min-w-[34px] shrink-0 place-items-center rounded-full bg-primary-soft px-1 text-badge font-bold text-primary"
        >
          {initialsOf(me)}
        </span>
        <span className="sr-only sm:not-sr-only sm:grid sm:min-w-0">
          <span className="text-label font-semibold break-words">{name}</span>{" "}
          <span className="text-hint text-muted-foreground">{role}</span>
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel className="grid gap-0.5">
          <span className="font-semibold break-words">{name}</span>
          <span className="text-hint font-normal text-muted-foreground">{role}</span>
        </DropdownMenuLabel>
        {me.navAreas.includes("account") && (
          <DropdownMenuItem asChild>
            <Link to="/profile">
              <UserRoundIcon aria-hidden="true" />
              My account
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          aria-busy={pending || undefined}
          className="aria-busy:cursor-progress"
          onSelect={(event) => {
            // Stay open while signing out so the busy state shows (and a failure toast has context);
            // the menu goes away with the page on success.
            event.preventDefault()
            void signOut()
          }}
        >
          {pending ? <Spinner /> : <LogOutIcon aria-hidden="true" />}
          {pending ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
