import { useEffect, useState } from "react"

import { passwordLength } from "./password-policy"

/** UX-DR25 copy for a Confirm field that differs from the password above (Stories 1.6b and 1.7b). */
export const PASSWORD_MISMATCH = "This doesn't match the password above. Type it again."

/** The Confirm field's message, or `undefined` when it matches. Passwords are compared as typed (never trimmed). */
export function confirmProblem(password: string, confirm: string): string | undefined {
  return confirm === password ? undefined : PASSWORD_MISMATCH
}

/** Confirm starts validating once it is as long as the password above (counted in code points, like the policy). */
export function isConfirmReady(password: string, confirm: string): boolean {
  const confirmLength = passwordLength(confirm)
  return confirmLength > 0 && confirmLength >= passwordLength(password)
}

/**
 * UX-DR25 live Confirm: stays quiet until Confirm is as long as the password above, then re-validates Confirm on
 * every change of either field (`validateConfirm`, e.g. RHF `trigger("confirmPassword")`; keep it stable).
 * `stop()` goes back to quiet, for a form that is cleared after a successful submit.
 */
export function useLiveConfirm(password: string, confirm: string, validateConfirm: () => void) {
  const [live, setLive] = useState(false)
  if (!live && isConfirmReady(password, confirm)) {
    // Adjust state while rendering (no effect): once ready, Confirm stays live.
    setLive(true)
  }
  useEffect(() => {
    if (live) {
      validateConfirm()
    }
  }, [live, password, confirm, validateConfirm])

  return { live, stop: () => setLive(false) }
}
