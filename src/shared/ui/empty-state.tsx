import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/shared/lib/utils"

interface EmptyStateProps extends Omit<React.ComponentProps<"section">, "title"> {
  icon: LucideIcon
  title: React.ReactNode
  /** One muted sentence (max 440px). */
  description: React.ReactNode
  /** At most one action, rendered only when the role may take it. */
  action?: React.ReactNode
  /** Heading level of the title (h2 under a page H1 by default). */
  headingLevel?: 2 | 3
  /** Error variant: rose icon tile. */
  tone?: "default" | "error"
}

/**
 * Empty state (DESIGN Empty state, UX-DR10): centred in a card with 48px vertical padding, a 56px icon
 * tile, a headline title, one muted sentence and an optional single action.
 */
function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  headingLevel = 2,
  tone = "default",
  className,
  ...props
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? "h2" : "h3"

  return (
    <section
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center rounded-lg border border-border bg-card px-5 py-12 text-center text-card-foreground shadow-sm",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className={cn(
          "grid size-14 shrink-0 place-items-center rounded-xl [&_svg]:size-6",
          tone === "error" ? "bg-destructive-bg text-destructive" : "bg-accent text-accent-foreground",
        )}
      >
        <Icon />
      </span>
      <Heading className="mt-4 text-headline">{title}</Heading>
      <p className="mt-1.5 max-w-[440px] text-muted-foreground">{description}</p>
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </section>
  )
}

export { EmptyState, type EmptyStateProps }
