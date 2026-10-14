import * as React from "react"
import { Dialog as SheetPrimitive } from "radix-ui"

import { cn } from "@/shared/lib/utils"

/**
 * Off-canvas sheet on Radix Dialog (DESIGN Sidebar/drawer, Bottom sheet): modal, focus trapped, the
 * rest of the page inert (aria-hidden + no pointer events), closes on scrim tap and Esc, returns focus
 * to the trigger. Scrim uses the `scrim` token with a 2px blur; the panel is a popover surface with
 * `shadow-lg` and safe-area padding on its outer edges.
 */
function Sheet(props: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger(props: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetClose(props: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />
}

function SheetOverlay({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-scrim backdrop-blur-[2px]",
        "duration-(--motion-drawer) data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    />
  )
}

type SheetSide = "left" | "right" | "bottom"

const SIDE_CLASSES: Record<SheetSide, string> = {
  left: [
    "inset-y-0 left-0 h-dvh w-drawer max-w-[86vw] border-r",
    "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]",
    "data-[state=open]:slide-in-from-left data-[state=closed]:slide-out-to-left",
  ].join(" "),
  right: [
    "inset-y-0 right-0 h-dvh w-drawer max-w-[86vw] border-l",
    "pt-[env(safe-area-inset-top)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)]",
    "data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right",
  ].join(" "),
  bottom: [
    "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-2xl border-t pb-[env(safe-area-inset-bottom)]",
    "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
  ].join(" "),
}

function SheetContent({
  className,
  children,
  side = "left",
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: SheetSide }) {
  return (
    <SheetPrimitive.Portal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(
          "fixed z-50 flex flex-col border-border bg-popover text-popover-foreground shadow-lg outline-none",
          "ease-(--motion-ease) duration-(--motion-drawer) data-[state=open]:animate-in data-[state=closed]:animate-out",
          SIDE_CLASSES[side],
          className,
        )}
        {...props}
      >
        {children}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  )
}

function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title data-slot="sheet-title" className={cn("text-dialog-title font-heading font-bold", className)} {...props} />
  )
}

function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-body-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription }
