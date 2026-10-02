import * as React from "react"

import { cn } from "@/shared/lib/utils"
import { useFieldControl } from "@/shared/ui/field"

/**
 * Text input (DESIGN Input, UX-DR14): 44px, 16px text (no iOS zoom), canvas fill, `input` border.
 * Focus = ring border + 3px halo; invalid = destructive border (rose halo on focus); disabled = muted fill,
 * read-only = muted text on the canvas fill.
 * Height is a minimum and padding is fixed, so text never clips when the user scales text up.
 */
function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  const wired = useFieldControl(props)

  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "block min-h-control w-full min-w-0 rounded-md border border-input bg-background px-3 py-[9px]",
        "font-sans text-control text-foreground placeholder:text-muted-foreground",
        "transition-[border-color,box-shadow]",
        "hover:not-disabled:not-read-only:border-[color-mix(in_oklch,var(--input)_55%,var(--foreground))]",
        "focus-visible:border-ring focus-visible:shadow-[0_0_0_3px_var(--focus-halo)]",
        "aria-invalid:border-destructive aria-invalid:focus-visible:border-destructive aria-invalid:focus-visible:shadow-[0_0_0_3px_var(--focus-halo-invalid)]",
        // Read-only keeps the canvas fill so its `input` border stays >= 3:1; only disabled (exempt) uses muted.
        "read-only:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground",
        className,
      )}
      {...wired}
    />
  )
}

export { Input }
