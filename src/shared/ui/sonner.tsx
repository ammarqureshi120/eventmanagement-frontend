import * as React from "react"
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon, XIcon } from "lucide-react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { Spinner } from "@/shared/ui/spinner"

/**
 * Toasts (DESIGN Toast, UX-DR41): bottom-right, max 380px (full width minus 16px gutters on phones,
 * above the safe area), 3px tone bar + tone icon + bold title + muted description + 44px dismiss button,
 * 6.5s auto-dismiss, max 3 stacked, in Sonner's polite live region. Colours are tokens, so no `theme` prop.
 * Sonner pauses on hover; it is told to pause on keyboard focus too (see `usePauseOnFocus`).
 */
const TOAST_DURATION_MS = 6500

const GUTTER = "16px"

const offset = {
  right: `calc(${GUTTER} + env(safe-area-inset-right))`,
  bottom: `calc(${GUTTER} + env(safe-area-inset-bottom))`,
}

const mobileOffset = {
  left: `calc(${GUTTER} + env(safe-area-inset-left))`,
  right: `calc(${GUTTER} + env(safe-area-inset-right))`,
  bottom: `calc(${GUTTER} + env(safe-area-inset-bottom))`,
}

const iconClass = "size-[1.125rem]"

/**
 * Sonner pauses its timers only while the stack is "expanded" (pointer hover). When keyboard focus enters
 * the toaster we raise the same signal it listens to, and lower it when focus leaves — including when the
 * focused toast itself is removed (no focusout fires then), which a MutationObserver catches.
 */
function usePauseOnFocus() {
  React.useEffect(() => {
    let paused: { list: HTMLElement; observer: MutationObserver } | null = null

    const toasterOf = (target: EventTarget | null) =>
      target instanceof Element ? target.closest<HTMLElement>("[data-sonner-toaster]") : null

    const release = () => {
      if (!paused) {
        return
      }
      const { list, observer } = paused
      paused = null
      observer.disconnect()
      if (list.isConnected) {
        list.dispatchEvent(new MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body }))
      }
    }

    const onFocusIn = (event: FocusEvent) => {
      const list = toasterOf(event.target)
      if (!list) {
        return
      }
      list.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }))
      if (paused?.list !== list) {
        release()
        const observer = new MutationObserver(() => {
          if (!list.contains(document.activeElement)) {
            release()
          }
        })
        observer.observe(list, { childList: true, subtree: true })
        paused = { list, observer }
      }
    }
    const onFocusOut = (event: FocusEvent) => {
      const list = toasterOf(event.target)
      if (list && !list.contains(event.relatedTarget as Node | null)) {
        release()
      }
    }

    document.addEventListener("focusin", onFocusIn)
    document.addEventListener("focusout", onFocusOut)
    return () => {
      release()
      document.removeEventListener("focusin", onFocusIn)
      document.removeEventListener("focusout", onFocusOut)
    }
  }, [])
}

function Toaster(props: ToasterProps) {
  usePauseOnFocus()

  return (
    <Sonner
      position="bottom-right"
      visibleToasts={3}
      duration={TOAST_DURATION_MS}
      closeButton
      offset={offset}
      mobileOffset={mobileOffset}
      style={{ "--width": "min(380px, calc(100vw - 32px - env(safe-area-inset-left) - env(safe-area-inset-right)))" } as React.CSSProperties}
      icons={{
        success: <CircleCheckIcon className={iconClass} />,
        info: <InfoIcon className={iconClass} />,
        warning: <TriangleAlertIcon className={iconClass} />,
        error: <CircleAlertIcon className={iconClass} />,
        loading: <Spinner />,
        close: <XIcon className={iconClass} aria-hidden="true" />,
      }}
      toastOptions={{
        unstyled: true,
        closeButtonAriaLabel: "Dismiss notification",
        classNames: {
          toast: [
            "group/toast flex w-full items-start gap-3 rounded-lg border border-l-3 border-border border-l-primary",
            "bg-popover py-3.5 pr-2.5 pl-4 text-popover-foreground shadow-lg",
            "font-sans text-alert",
            "data-[type=success]:border-l-success data-[type=info]:border-l-info",
            "data-[type=warning]:border-l-warning data-[type=error]:border-l-destructive",
          ].join(" "),
          icon: [
            "mt-0.5 flex shrink-0 items-center text-primary",
            "group-data-[type=success]/toast:text-success group-data-[type=info]/toast:text-info",
            "group-data-[type=warning]/toast:text-warning group-data-[type=error]/toast:text-destructive",
          ].join(" "),
          content: "grid min-w-0 flex-1 gap-0.5",
          title: "font-semibold",
          description: "text-body-sm text-muted-foreground",
          closeButton: [
            "order-last -my-2.5 inline-flex size-touch shrink-0 cursor-pointer items-center justify-center rounded-md",
            "text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            "focus-visible:shadow-[0_0_0_3px_var(--focus-halo)]",
          ].join(" "),
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
