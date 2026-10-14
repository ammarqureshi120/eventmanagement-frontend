import * as React from "react"

import { cn } from "@/shared/lib/utils"

interface PageHeaderProps extends Omit<React.ComponentProps<"header">, "title"> {
  title: React.ReactNode
  /** Muted line under the title. */
  description?: React.ReactNode
  /** Page actions (right on desktop, wrapping under the title on phones). */
  actions?: React.ReactNode
}

/**
 * Page header (DESIGN Page header, UX-DR10): the page's one H1 in the display style. The H1 has
 * `tabIndex={-1}` so the shell can move focus to it on route change (UX-DR48).
 */
function PageHeader({ title, description, actions, className, ...props }: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn("flex flex-wrap items-start justify-between gap-x-4 gap-y-3 pb-6", className)}
      {...props}
    >
      <div className="grid min-w-0 gap-1">
        <h1 tabIndex={-1} className="text-display">
          {title}
        </h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export { PageHeader, type PageHeaderProps }
