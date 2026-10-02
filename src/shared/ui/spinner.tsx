import { cn } from "@/shared/lib/utils"

/** 16px loading ring in the current text colour. Decorative: pair it with visible or sr-only text. */
function Spinner({ className }: { className?: string }) {
  return (
    <span
      data-slot="spinner"
      aria-hidden="true"
      className={cn(
        "inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent",
        className,
      )}
    />
  )
}

export { Spinner }
