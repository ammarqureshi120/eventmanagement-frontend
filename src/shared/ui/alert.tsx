import * as React from "react"
import { cva } from "class-variance-authority"
import type { LucideIcon } from "lucide-react"
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, LockIcon, TriangleAlertIcon } from "lucide-react"

import { cn } from "@/shared/lib/utils"

/**
 * Inline banner (DESIGN Alert, UX-DR42): tint fill + soft tone border (decorative; meaning is carried by
 * text + icon + tint), 18px tone icon, optional bold lead.
 * Error summaries announce with `role="alert"`, success notices with `role="status"`.
 */
export type AlertTone = "info" | "success" | "warning" | "error" | "neutral"

const alertVariants = cva(
  "flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-alert text-foreground [&>svg]:mt-px [&>svg]:size-[1.125rem] [&>svg]:shrink-0 [&>svg]:text-(--alert-tone)",
  {
    variants: {
      tone: {
        info: "border-[color-mix(in_oklch,var(--info)_20%,var(--info-bg))] bg-info-bg [--alert-tone:var(--info)]",
        success: "border-[color-mix(in_oklch,var(--success)_20%,var(--success-bg))] bg-success-bg [--alert-tone:var(--success)]",
        warning: "border-[color-mix(in_oklch,var(--warning)_20%,var(--warning-bg))] bg-warning-bg [--alert-tone:var(--warning)]",
        error:
          "border-[color-mix(in_oklch,var(--destructive)_20%,var(--destructive-bg))] bg-destructive-bg [--alert-tone:var(--destructive)]",
        neutral: "border-border bg-muted [--alert-tone:var(--muted-foreground)]",
      },
    },
    defaultVariants: { tone: "info" },
  },
)

const TONE_ICONS: Record<AlertTone, LucideIcon> = {
  info: InfoIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
  error: CircleAlertIcon,
  neutral: LockIcon,
}

const TONE_ROLES: Partial<Record<AlertTone, React.AriaRole>> = {
  error: "alert",
  success: "status",
}

interface AlertProps extends Omit<React.ComponentProps<"div">, "title"> {
  tone?: AlertTone
  /** Optional bold lead sentence, shown in the tone colour. */
  title?: React.ReactNode
}

function Alert({ tone = "info", title, role, className, children, ...props }: AlertProps) {
  const Icon = TONE_ICONS[tone]

  return (
    <div
      data-slot="alert"
      data-tone={tone}
      role={role ?? TONE_ROLES[tone]}
      className={cn(alertVariants({ tone }), className)}
      {...props}
    >
      <Icon aria-hidden="true" />
      <div className="grid min-w-0 gap-0.5">
        {title && (
          <p data-slot="alert-title" className="font-semibold text-(--alert-tone)">
            {title}
          </p>
        )}
        {children && <div data-slot="alert-description">{children}</div>}
      </div>
    </div>
  )
}

export { Alert, alertVariants, type AlertProps }
