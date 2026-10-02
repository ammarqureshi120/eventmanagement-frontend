import * as React from "react"
import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "@/shared/lib/utils"

/** Field label: Inter 14px 600 (DESIGN typography.label). */
function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn("text-label font-semibold text-foreground select-none peer-disabled:cursor-not-allowed", className)}
      {...props}
    />
  )
}

export { Label }
