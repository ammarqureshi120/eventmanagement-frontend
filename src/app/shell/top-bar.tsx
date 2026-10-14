import { MenuIcon } from "lucide-react"

import type { MeResponse } from "@/api/generated/me"
import { ThemeToggle } from "@/features/theme"
import { Button } from "@/shared/ui/button"
import { SheetTrigger } from "@/shared/ui/sheet"

import { UserMenu } from "./user-menu"

/**
 * Sticky top bar (DESIGN Top bar, UX-DR9): min 60px, canvas at 86% with a 10px blur and a hairline
 * border. Left: menu button (<1024px, opens the drawer) and the breadcrumb. Right: icon theme toggle
 * and the user button. Must sit inside the drawer's `Sheet` so the menu button is its trigger.
 */
export function TopBar({ me }: { me: MeResponse }) {
  return (
    <header
      data-slot="top-bar"
      className={[
        "sticky top-0 z-30 border-b border-border bg-background/86 backdrop-blur-[10px]",
        "pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]",
      ].join(" ")}
    >
      <div className="flex min-h-[60px] flex-wrap items-center gap-2 px-4 py-2 sm:px-6 lg:px-gutter-desktop">
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Open menu" className="-ml-1.5 text-muted-foreground lg:hidden">
            <MenuIcon aria-hidden="true" />
          </Button>
        </SheetTrigger>

        <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
          <ol className="flex flex-wrap items-center">
            <li className="min-w-0 text-body-sm font-semibold">
              EventHub platform
            </li>
          </ol>
        </nav>

        <ThemeToggle variant="icon" className="shrink-0" />
        <UserMenu me={me} />
      </div>
    </header>
  )
}
