import * as React from "react"
import { CircleAlertIcon } from "lucide-react"

import { cn } from "@/shared/lib/utils"
import { Label } from "@/shared/ui/label"

/**
 * Form field (UX-DR14): label above, optional "(optional)" marker, the control, a hint and an error row.
 * The control (Input, PasswordInput, …) reads `useFieldControl()` to get its `id`, `aria-describedby`
 * (hint + error), `aria-invalid` and `aria-required`, so wiring is never done by hand.
 */
interface FieldContextValue {
  controlId: string
  hintId?: string
  errorId?: string
  invalid: boolean
  required: boolean
}

const FieldContext = React.createContext<FieldContextValue | null>(null)

type FieldControlProps = {
  id?: string
  "aria-describedby"?: string
  "aria-invalid"?: React.AriaAttributes["aria-invalid"]
  "aria-required"?: React.AriaAttributes["aria-required"]
}

/** Merges the surrounding Field's wiring into a control's props (explicit props win). */
function useFieldControl<P extends FieldControlProps>(props: P): P {
  const field = React.useContext(FieldContext)
  if (!field) {
    return props
  }
  const describedBy = [props["aria-describedby"], field.hintId, field.errorId].filter(Boolean).join(" ")
  return {
    ...props,
    id: props.id ?? field.controlId,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": props["aria-invalid"] ?? (field.invalid || undefined),
    "aria-required": props["aria-required"] ?? (field.required || undefined),
  }
}

interface FieldProps extends Omit<React.ComponentProps<"div">, "children"> {
  label: React.ReactNode
  children: React.ReactNode
  /** Muted helper text under the control. */
  hint?: React.ReactNode
  /** Error message; marks the control invalid and links the message to it. */
  error?: React.ReactNode
  /** Adds a muted "(optional)" after the label. */
  optional?: boolean
  /** Sets `aria-required` on the control. */
  required?: boolean
  /** Control id; generated when omitted. */
  controlId?: string
}

function Field({ label, children, hint, error, optional, required = false, controlId, className, ...props }: FieldProps) {
  const generatedId = React.useId()
  const id = controlId ?? `${generatedId}-control`
  const hintId = hint ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const invalid = Boolean(error)

  const context = React.useMemo<FieldContextValue>(
    () => ({ controlId: id, hintId, errorId, invalid, required }),
    [id, hintId, errorId, invalid, required],
  )

  return (
    <div data-slot="field" data-invalid={invalid || undefined} className={cn("grid min-w-0 gap-1.5", className)} {...props}>
      <Label htmlFor={id}>
        {label}
        {optional && (
          <>
            {" "}
            <span className="text-hint font-medium text-muted-foreground">(optional)</span>
          </>
        )}
      </Label>
      <FieldContext.Provider value={context}>{children}</FieldContext.Provider>
      {hint && (
        <p id={hintId} data-slot="field-hint" className="text-hint text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} data-slot="field-error" className="flex items-start gap-1.5 text-hint text-destructive">
          <CircleAlertIcon aria-hidden="true" className="mt-px size-4 shrink-0" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

export { Field, useFieldControl, type FieldProps }
