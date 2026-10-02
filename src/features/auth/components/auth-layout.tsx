import type { ReactNode } from "react"
import { TicketIcon } from "lucide-react"

import { ThemeToggle } from "@/features/theme"

/**
 * Auth card layout (UX-DR46/57/59, DESIGN Auth card): full `100dvh` canvas with safe-area padding,
 * card centred on desktop and top-aligned with a 72px offset on phones, icon-only theme toggle top-right,
 * and a "Skip to content" link as the first Tab stop (UX-DR11).
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      data-slot="auth-layout"
      className={[
        "relative grid min-h-dvh w-full grid-cols-1 justify-items-center",
        "content-start pt-[calc(72px+env(safe-area-inset-top))] sm:content-center sm:pt-[calc(80px+env(safe-area-inset-top))]",
        "pr-[calc(16px+env(safe-area-inset-right))] pb-[calc(32px+env(safe-area-inset-bottom))] pl-[calc(16px+env(safe-area-inset-left))]",
      ].join(" ")}
    >
      <a
        href="#main"
        onClick={(event) => {
          // Move focus without touching the router's URL.
          event.preventDefault()
          document.getElementById("main")?.focus()
        }}
        className={[
          "sr-only focus:not-sr-only focus:fixed focus:top-[calc(12px+env(safe-area-inset-top))] focus:left-[calc(12px+env(safe-area-inset-left))] focus:z-50",
          "focus:inline-flex focus:min-h-touch focus:items-center focus:rounded-md focus:bg-primary focus:px-4",
          "focus:font-semibold focus:text-primary-foreground focus:no-underline",
        ].join(" ")}
      >
        Skip to content
      </a>

      <div className="absolute top-[calc(16px+env(safe-area-inset-top))] right-[calc(16px+env(safe-area-inset-right))]">
        <ThemeToggle variant="icon" />
      </div>

      <main
        id="main"
        tabIndex={-1}
        className="w-full max-w-auth rounded-lg border border-border bg-card px-4.5 py-5.5 text-card-foreground shadow-sm sm:p-7"
      >
        <div className="flex items-center justify-center gap-2.5 pb-4.5">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground [&_svg]:size-5"
          >
            <TicketIcon />
          </span>
          <span className="font-heading text-brand font-bold">EventHub</span>
        </div>
        {children}
      </main>
    </div>
  )
}
