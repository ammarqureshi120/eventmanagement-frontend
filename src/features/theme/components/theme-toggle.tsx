import type { LucideIcon } from "lucide-react"
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/shared/lib/utils"
import { isThemePreference, type ThemePreference } from "@/shared/theme/theme-storage"

import { useTheme } from "../hooks/use-theme"

const OPTIONS: ReadonlyArray<{ value: ThemePreference; label: string; Icon: LucideIcon }> = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
]

const ARROW_STEPS: Readonly<Record<string, 1 | -1>> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

export interface ThemeToggleProps {
  /** `labelled` shows the text (drawer/sidebar); `icon` is icon-only with labels kept for screen readers (auth pages). */
  variant?: "labelled" | "icon"
  className?: string
}

/**
 * Light / Dark / System segmented radio group (UX-DR5). Radix gives roving focus: Tab enters on the
 * checked segment, arrow keys move and choose. Every segment is at least 44×44.
 */
export function ThemeToggle({ variant = "labelled", className }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme()
  const iconOnly = variant === "icon"

  return (
    <RadioGroupPrimitive.Root
      aria-label="Theme"
      loop
      value={preference}
      onKeyDownCapture={(event) => {
        // Choose on key-down. Radix moves focus a tick later and only checks the item if the key is still held,
        // which a quick tap (or automation) can miss; choosing here makes every arrow press count.
        // Capture phase: Radix's own item handler calls preventDefault() on arrows during bubbling, so only
        // here does `defaultPrevented` mean "someone outside the toggle handled this key".
        const step = ARROW_STEPS[event.key]
        if (!step || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
          return
        }
        // Step from the focused segment (where Radix moves focus from); ignore keys from anything else.
        const focused = (event.target as HTMLElement).getAttribute("value")
        const index = OPTIONS.findIndex((option) => option.value === focused)
        if (index < 0) {
          return
        }
        setPreference(OPTIONS[(index + step + OPTIONS.length) % OPTIONS.length].value)
      }}
      onValueChange={(value) => {
        // Radix re-fires the value the keydown handler already chose; don't apply it twice.
        if (isThemePreference(value) && value !== preference) {
          setPreference(value)
        }
      }}
      data-slot="theme-toggle"
      className={cn(
        "inline-flex gap-0.5 rounded-lg bg-muted p-[3px]",
        variant === "labelled" && "flex w-full",
        className,
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <RadioGroupPrimitive.Item
          key={value}
          value={value}
          title={iconOnly ? label : undefined}
          className={cn(
            "inline-flex min-h-touch min-w-touch cursor-pointer items-center justify-center gap-1.5 rounded-[calc(var(--radius)-3px)] px-2.5 text-label font-semibold text-muted-foreground",
            "transition-[background-color,color,box-shadow] hover:text-foreground",
            "data-[state=checked]:bg-card data-[state=checked]:text-foreground data-[state=checked]:shadow-sm",
            // Ring drawn inside the (checked, card-filled) segment: ring on the muted track would be under 3:1.
            "focus-visible:outline-offset-[-2px] focus-visible:shadow-[0_0_0_3px_var(--focus-halo)] [&_svg]:size-[1.125rem] [&_svg]:shrink-0",
            !iconOnly && "flex-1",
          )}
        >
          <Icon aria-hidden="true" />
          <span className={cn(iconOnly && "sr-only")}>{label}</span>
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  )
}
