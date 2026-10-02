import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/shared/lib/utils"

/**
 * Radix radio group in Nordic Fog tokens: 20px circle, 1.5px `input` border, primary fill when checked,
 * hit area grown to 44×44, ring + halo on keyboard focus. Arrow keys move and choose (roving focus).
 * Custom-looking groups (theme toggle, radio cards) style `RadioGroupPrimitive` directly.
 */
function RadioGroup({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn("grid w-full gap-2", className)} {...props} />
}

function RadioGroupItem({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
  return (
    <RadioGroupPrimitive.Item
      data-slot="radio-group-item"
      className={cn(
        "relative grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border-[1.5px] border-input bg-background",
        "transition-[background-color,border-color,box-shadow] after:absolute after:-inset-3",
        "focus-visible:shadow-[0_0_0_3px_var(--focus-halo)]",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        "aria-invalid:border-destructive disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator data-slot="radio-group-indicator" className="size-2 rounded-full bg-primary-foreground" />
    </RadioGroupPrimitive.Item>
  )
}

export { RadioGroup, RadioGroupItem }
