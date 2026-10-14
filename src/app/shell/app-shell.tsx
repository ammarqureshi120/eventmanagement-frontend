import { XIcon } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { Outlet, useLocation } from "react-router"

import { useMe } from "@/shared/auth"
import { Button } from "@/shared/ui/button"
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/shared/ui/sheet"

import { AppLoading } from "../routes/app-loading"
import { focusPageHeading } from "./route-focus"
import { SidebarNav } from "./sidebar-nav"
import { TopBar } from "./top-bar"

const DESKTOP_QUERY = "(min-width: 1024px)"

/**
 * Signed-in app shell (UX-DR7/8/9/53/54): skip link first, fixed 264px sidebar at ≥1024px, an
 * off-canvas drawer (304px, max 86vw) below that, the sticky top bar and `<main id="main">` (max
 * 1240px). While the drawer is open everything behind it is `inert` (UX-DR53).
 * Renders `children` when given (Not found inside the shell), otherwise the route outlet.
 * Only mounted for a signed-in user (inside `RequireAuth`, or by the Not found route).
 */
export function AppShell({ children }: { children?: ReactNode }) {
  const { me } = useMe()
  const { pathname } = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathnameRef = useRef(pathname)
  const openedAtRef = useRef(pathname)

  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  // Growing past the breakpoint swaps the drawer for the fixed sidebar: never leave both open.
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return
    }
    const query = window.matchMedia(DESKTOP_QUERY)
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setDrawerOpen(false)
      }
    }
    query.addEventListener?.("change", onChange)
    return () => query.removeEventListener?.("change", onChange)
  }, [])

  if (!me) {
    return <AppLoading />
  }

  const onOpenChange = (open: boolean) => {
    if (open) {
      openedAtRef.current = pathnameRef.current
    }
    setDrawerOpen(open)
  }

  return (
    <div data-slot="app-shell" className="min-h-dvh" inert={drawerOpen || undefined}>
      <a
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById("main")?.focus()
        }}
        className={[
          "sr-only focus:not-sr-only focus:fixed focus:top-[calc(8px+env(safe-area-inset-top))] focus:left-[calc(8px+env(safe-area-inset-left))] focus:z-50",
          "focus:inline-flex focus:min-h-touch focus:items-center focus:rounded-md focus:bg-primary focus:px-4",
          "focus:font-semibold focus:text-primary-foreground focus:no-underline",
        ].join(" ")}
      >
        Skip to content
      </a>

      <aside
        data-slot="sidebar"
        aria-label="Sidebar"
        className="fixed inset-y-0 left-0 z-20 hidden w-sidebar overflow-y-auto border-r border-border bg-card pl-[env(safe-area-inset-left)] lg:block"
      >
        <SidebarNav me={me} />
      </aside>

      <Sheet open={drawerOpen} onOpenChange={onOpenChange}>
        <div className="flex min-h-dvh flex-col lg:pl-sidebar">
          <TopBar me={me} />
          <main
            id="main"
            tabIndex={-1}
            className={[
              "mx-auto w-full max-w-content flex-1 pt-6 lg:pt-8",
              "pr-[calc(16px+env(safe-area-inset-right))] pb-[calc(24px+env(safe-area-inset-bottom))] pl-[calc(16px+env(safe-area-inset-left))]",
              "sm:pr-[calc(24px+env(safe-area-inset-right))] sm:pl-[calc(24px+env(safe-area-inset-left))] lg:px-gutter-desktop",
            ].join(" ")}
          >
            {children ?? <Outlet />}
          </main>
        </div>

        <SheetContent
          side="left"
          aria-describedby={undefined}
          className="overflow-y-auto"
          onOpenAutoFocus={(event) => {
            // Start on the current nav item (UX-DR53); fall back to the close button.
            event.preventDefault()
            const content = event.currentTarget as HTMLElement
            const current = content.querySelector<HTMLElement>("[aria-current=page]")
            const close = content.querySelector<HTMLElement>("[data-slot=drawer-close]")
            ;(current ?? close)?.focus()
          }}
          onCloseAutoFocus={(event) => {
            // Radix returns focus to the menu button; after navigating to another page the H1 gets it.
            if (pathnameRef.current !== openedAtRef.current) {
              event.preventDefault()
              focusPageHeading()
            }
          }}
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarNav
            me={me}
            onNavigate={() => setDrawerOpen(false)}
            brandEnd={
              <SheetClose asChild>
                <Button
                  data-slot="drawer-close"
                  variant="ghost"
                  size="icon"
                  aria-label="Close menu"
                  className="-mr-2 text-muted-foreground"
                >
                  <XIcon aria-hidden="true" />
                </Button>
              </SheetClose>
            }
          />
        </SheetContent>
      </Sheet>

    </div>
  )
}
