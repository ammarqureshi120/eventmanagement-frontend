import * as React from "react"
import { AlertDialog as AlertDialogPrimitive } from "radix-ui"

import { cn } from "@/shared/lib/utils"

/**
 * Confirm / blocking dialog (DESIGN Dialog + Bottom sheet, UX-DR37/38) on Radix AlertDialog:
 * `role="alertdialog"`, modal, focus trapped, the page behind inert, no close on a scrim click, focus
 * returned on close. Popover surface, 16px radius, 22px padding, max 460px, centred with an 8px rise +
 * 98.5% scale over 180ms. Under 640px it is a bottom sheet: full width, 20px top corners, decorative
 * handle, bottom padding that includes the safe area, slides up over 220ms. Pure CSS: no media-query hook.
 */
function AlertDialog(props: React.ComponentProps<typeof AlertDialogPrimitive.Root>) {
  return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

function AlertDialogOverlay({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Overlay>) {
  return (
    <AlertDialogPrimitive.Overlay
      data-slot="alert-dialog-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-scrim backdrop-blur-[2px]",
        "duration-(--motion-dialog) data-[state=open]:animate-in data-[state=open]:fade-in-0",
        "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogContent({ className, children, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Content>) {
  return (
    <AlertDialogPrimitive.Portal>
      <AlertDialogOverlay />
      <AlertDialogPrimitive.Content
        data-slot="alert-dialog-content"
        className={cn(
          "fixed z-50 grid gap-4 border-border bg-popover text-popover-foreground shadow-lg outline-none",
          "max-h-[90dvh] overflow-y-auto ease-(--motion-ease) data-[state=open]:animate-in data-[state=closed]:animate-out",
          // Phones: bottom sheet with a safe-area-aware bottom edge.
          "inset-x-0 bottom-0 rounded-t-2xl border-t pt-3 pb-[calc(22px+env(safe-area-inset-bottom))]",
          "pr-[calc(22px+env(safe-area-inset-right))] pl-[calc(22px+env(safe-area-inset-left))]",
          "duration-(--motion-sheet) data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-6",
          "data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-bottom-6",
          // ≥640px: centred dialog.
          "sm:inset-x-auto sm:bottom-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100vw-32px)] sm:max-w-[460px]",
          "sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-xl sm:border sm:p-5.5",
          "sm:duration-(--motion-dialog) sm:data-[state=open]:slide-in-from-bottom-2 sm:data-[state=open]:zoom-in-[0.985]",
          "sm:data-[state=closed]:slide-out-to-bottom-2 sm:data-[state=closed]:zoom-out-[0.985]",
          className,
        )}
        {...props}
      >
        <span aria-hidden="true" data-slot="alert-dialog-handle" className="mx-auto -mb-1 h-1 w-10 rounded-full bg-border sm:hidden" />
        {children}
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-header" className={cn("grid gap-1.5", className)} {...props} />
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn(
        // Phones: full-width stacked buttons, primary on top. Wider: right-aligned and wrapping.
        "flex flex-col-reverse gap-2 [&>*]:w-full sm:flex-row sm:flex-wrap sm:justify-end sm:[&>*]:w-auto",
        className,
      )}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
  return (
    <AlertDialogPrimitive.Title
      data-slot="alert-dialog-title"
      className={cn("font-heading text-dialog-title font-bold", className)}
      {...props}
    />
  )
}

function AlertDialogDescription({ className, ...props }: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
  return (
    <AlertDialogPrimitive.Description
      data-slot="alert-dialog-description"
      className={cn("text-body text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
}
