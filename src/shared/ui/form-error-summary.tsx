import * as React from "react"
import type { FieldErrors, FieldValues } from "react-hook-form"

import { Alert } from "@/shared/ui/alert"

/** Fields of a flat form that currently show a message (the form-level `root` error is not a field). */
export function countFieldErrors<TValues extends FieldValues>(errors: FieldErrors<TValues>): number {
  return Object.entries(errors).filter(([name, error]) => name !== "root" && Boolean(error?.message)).length
}

/** EXPERIENCE copy: "2 fields need a look. The messages below say what to change." */
export function fieldsNeedALook(count: number): string {
  return count === 1
    ? "1 field needs a look. The messages below say what to change."
    : `${count} fields need a look. The messages below say what to change.`
}

/** Focuses the first invalid control (`aria-invalid="true"`, DOM order) inside `container`. */
export function focusFirstInvalid(container: HTMLElement | null): boolean {
  const first = container?.querySelector<HTMLElement>('[aria-invalid="true"]')
  if (!first) {
    return false
  }
  first.focus()
  return true
}

interface FormErrorSummaryProps<TValues extends FieldValues> extends Omit<React.ComponentProps<"div">, "children" | "title"> {
  errors: FieldErrors<TValues>
  /** Counts failed submit attempts (client or server); each new attempt moves focus to the first invalid field. */
  attempt: number
  /** The form (or card) whose first invalid field gets focus. */
  containerRef: React.RefObject<HTMLElement | null>
}

/**
 * UX-DR15 summary (EXPERIENCE "Error (submit)"): after a failed submit with more than one field message, an error
 * Alert at the top of the form — "N fields need a look. The messages below say what to change." · "Nothing was
 * saved yet." (`role="alert"`). It goes away as the user fixes fields (one message left is enough on its own).
 * Each failed attempt moves focus to the first invalid field in DOM order. Entered data is never touched.
 */
function FormErrorSummary<TValues extends FieldValues>({
  errors,
  attempt,
  containerRef,
  className,
  ...props
}: FormErrorSummaryProps<TValues>) {
  const count = countFieldErrors(errors)

  React.useEffect(() => {
    if (attempt > 0) {
      focusFirstInvalid(containerRef.current)
    }
    // Only a new failed attempt moves focus; fixing fields while typing must not.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  if (attempt === 0 || count < 2) {
    return null
  }

  return (
    <Alert data-slot="form-error-summary" tone="error" title={fieldsNeedALook(count)} className={className} {...props}>
      Nothing was saved yet.
    </Alert>
  )
}

export { FormErrorSummary, type FormErrorSummaryProps }
