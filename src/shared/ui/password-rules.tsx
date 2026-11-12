import * as React from "react"
import { CheckIcon } from "lucide-react"

import { PASSWORD_RULES } from "@/shared/lib/password-policy"
import { cn } from "@/shared/lib/utils"

interface PasswordRulesProps extends Omit<
  React.ComponentProps<"div">,
  "children"
> {
  /** The password typed so far; never stored or logged here. */
  password: string
}

/**
 * Password rules checklist (DESIGN Password rules, UX-DR25): three rows (8+ characters, a letter, a number) under a
 * password field. A met rule's circle fills with a success tick and its text turns from muted to success. Each row
 * also says "done" or "not yet" to screen readers. The list itself is not live: only a rule whose state just changed
 * is announced, through one visually hidden polite region ("A number: done"). Give the field `aria-describedby` =
 * this element's `id`.
 */
function PasswordRules({ password, className, ...props }: PasswordRulesProps) {
  const states = PASSWORD_RULES.map((rule) => rule.test(password))
  const [previous, setPrevious] = React.useState(states)
  const [announcement, setAnnouncement] = React.useState("")
  const changed = PASSWORD_RULES.filter(
    (_rule, index) => states[index] !== previous[index]
  )
  if (changed.length > 0) {
    // Adjust state while rendering (no effect): announce only the rules that flipped.
    setPrevious(states)
    setAnnouncement(
      changed
        .map(
          (rule) =>
            `${rule.label}: ${states[PASSWORD_RULES.indexOf(rule)] ? "done" : "not yet"}`
        )
        .join(". ")
    )
  }

  return (
    <>
      <div
        data-slot="password-rules"
        className={cn("text-hint", className)}
        {...props}
      >
        <ul aria-label="Password rules" className="grid gap-1">
          {PASSWORD_RULES.map((rule, index) => {
            const met = states[index]
            return (
              <li
                key={rule.id}
                data-rule={rule.id}
                data-met={met || undefined}
                className={cn(
                  "flex items-center gap-2 transition-colors",
                  met ? "text-success" : "text-muted-foreground"
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-4.5 shrink-0 place-items-center rounded-full border-[1.5px] transition-colors [&_svg]:size-3",
                    met
                      ? "border-success bg-success text-card"
                      : "border-input bg-transparent text-transparent"
                  )}
                >
                  <CheckIcon strokeWidth={3} />
                </span>
                <span>
                  {rule.label}
                  <span className="sr-only">
                    {met ? ": done" : ": not yet"}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </div>
      <p
        data-slot="password-rules-status"
        aria-live="polite"
        className="sr-only"
      >
        {announcement}
      </p>
    </>
  )
}

export { PasswordRules, type PasswordRulesProps }
