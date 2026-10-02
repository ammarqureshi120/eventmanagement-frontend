import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/shared/lib/utils"
import { Spinner } from "@/shared/ui/spinner"

// Hover = the fill mixed 12% toward the ink; press = 1px down over 120ms (DESIGN Button, UX-DR60).
const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-transparent",
    "font-sans font-semibold whitespace-nowrap select-none",
    "transition-[background-color,border-color,color,box-shadow,text-decoration-color,translate]",
    "active:not-aria-disabled:translate-y-px active:not-aria-disabled:duration-(--motion-press)",
    "focus-visible:shadow-[0_0_0_3px_var(--focus-halo)]",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "aria-disabled:not-aria-busy:cursor-not-allowed aria-disabled:not-aria-busy:opacity-50 aria-busy:cursor-progress",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[1.125rem]",
  ],
  {
    variants: {
      variant: {
        primary: [
          "bg-primary text-primary-foreground shadow-sm",
          "focus-visible:shadow-[0_0_0_3px_var(--focus-halo),var(--elevation-sm)]",
          "hover:not-aria-disabled:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_12%)]",
        ],
        secondary: ["bg-secondary text-secondary-foreground", "hover:not-aria-disabled:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_12%)]"],
        outline: ["border-input bg-card text-foreground", "hover:not-aria-disabled:bg-[color-mix(in_oklch,var(--card),var(--foreground)_12%)]"],
        ghost: "bg-transparent text-foreground hover:not-aria-disabled:bg-muted",
        destructive: ["bg-destructive text-destructive-foreground", "hover:not-aria-disabled:bg-[color-mix(in_oklch,var(--destructive),var(--foreground)_12%)]"],
        "destructive-soft": [
          // Soft decorative border; hover moves toward the canvas, since darkening the tint drops the
          // rose label below 4.5:1 (see tests/token-contrast.test.ts).
          "border-[color-mix(in_oklch,var(--destructive)_22%,var(--destructive-bg))] bg-destructive-bg text-destructive",
          "hover:not-aria-disabled:bg-[color-mix(in_oklch,var(--destructive-bg),var(--background)_40%)]",
        ],
        link: [
          "border-0 bg-transparent text-primary underline underline-offset-4",
          "decoration-[color-mix(in_oklch,var(--primary)_35%,transparent)] hover:decoration-primary",
        ],
      },
      size: {
        // Heights are minimums so scaled-up text never clips. 36px gets an invisible hit area growing it to 44×44.
        sm: "min-h-control-sm min-w-control-sm px-3.25 text-button-sm after:absolute after:-inset-1",
        md: "min-h-control min-w-touch px-4.5 text-button",
        lg: "min-h-control-lg min-w-touch px-6 text-button-lg",
        icon: "min-h-touch min-w-touch p-0 text-button",
      },
    },
    compoundVariants: [{ variant: "link", class: "px-1.5" }],
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  },
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    /** Renders the single child (for example a router `Link`) with button styling. No loading state. */
    asChild?: boolean
    /** Shows a spinner + `loadingText`, keeps the width, sets `aria-busy` and ignores clicks. Focus stays. */
    loading?: boolean
    loadingText?: string
  }

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  loadingText = "Working…",
  children,
  onClick,
  "aria-disabled": ariaDisabled,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className)
  const isAriaDisabled = ariaDisabled === true || ariaDisabled === "true"

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (loading || isAriaDisabled) {
      // Swallow clicks (and the form submit or navigation they would trigger) while busy or aria-disabled.
      event.preventDefault()
      event.stopPropagation()
      return
    }
    onClick?.(event)
  }

  if (asChild) {
    return (
      <Slot.Root
        data-slot="button"
        className={classes}
        aria-disabled={ariaDisabled}
        onClick={handleClick as unknown as React.MouseEventHandler<HTMLElement>}
        {...props}
      >
        {children}
      </Slot.Root>
    )
  }

  const iconOnly = size === "icon"

  return (
    <button
      data-slot="button"
      data-loading={loading || undefined}
      className={classes}
      aria-busy={loading || undefined}
      aria-disabled={loading || ariaDisabled || undefined}
      onClick={handleClick}
      {...props}
    >
      {/* Both layers share one grid cell, so the width never changes between idle and loading. */}
      <span className="grid place-items-center">
        <span
          data-slot="button-label"
          aria-hidden={loading || undefined}
          className={cn("col-start-1 row-start-1 inline-flex items-center justify-center gap-2", loading && "invisible")}
        >
          {children}
        </span>
        <span
          data-slot="button-loading"
          aria-hidden={!loading || undefined}
          className={cn("col-start-1 row-start-1 inline-flex items-center justify-center gap-2", !loading && "invisible")}
        >
          {/* Only spin while visible: a rotating box would otherwise add scroll overflow to idle buttons. */}
          <Spinner className={loading ? undefined : "animate-none"} />
          {iconOnly ? <span className="sr-only">{loadingText}</span> : loadingText}
        </span>
      </span>
    </button>
  )
}

export { Button, buttonVariants, type ButtonProps }
