import * as React from "react"

import { cn } from "@/shared/lib/utils"

interface AccountCardProps extends Omit<React.ComponentProps<"section">, "title"> {
  title: string
}

/** A titled card on My account (DESIGN Card): card fill, hairline border, 12px radius, 20px padding, H2 title. */
export function AccountCard({ title, className, children, ...props }: AccountCardProps) {
  const headingId = React.useId()

  return (
    <section
      aria-labelledby={headingId}
      className={cn("min-w-0 rounded-lg border border-border bg-card p-5 text-card-foreground shadow-sm", className)}
      {...props}
    >
      <h2 id={headingId} className="mb-4 text-headline break-words">
        {title}
      </h2>
      {children}
    </section>
  )
}
