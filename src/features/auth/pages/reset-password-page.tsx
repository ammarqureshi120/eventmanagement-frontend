import { useEffect, useId, useRef, useState } from "react"
import { useWatch } from "react-hook-form"
import { Link, useLocation, useNavigate } from "react-router"
import { Link2OffIcon } from "lucide-react"

import { useResetPasswordMutation } from "@/api/generated/auth"
import { useZodForm } from "@/shared/lib/forms"
import { GENERIC_FAILURE_MESSAGE, type LoginNoticeState } from "@/shared/lib/messages"
import { passwordLength } from "@/shared/lib/password-policy"
import { applyToForm, toProblem } from "@/shared/lib/problem"
import { useDocumentTitle } from "@/shared/lib/use-document-title"
import { Alert } from "@/shared/ui/alert"
import { Button } from "@/shared/ui/button"
import { Field } from "@/shared/ui/field"
import { PasswordInput } from "@/shared/ui/password-input"
import { PasswordRules } from "@/shared/ui/password-rules"

import { AuthLayout } from "../components/auth-layout"
import { PASSWORD_UPDATED_NOTICE } from "../hooks/use-sign-out"
import { resetPasswordSchema, type ResetPasswordFormValues } from "../schemas"

const FORM_FIELDS = ["newPassword"] as const

/** The token from `?token=` of the URL the page was opened with, or `null`. */
function tokenFrom(search: string): string | null {
  const token = new URLSearchParams(search).get("token")
  return token && token.length > 0 ? token : null
}

/**
 * Epics Story 1.6 expired-link card: reason and the one next step. When it replaces the form after a rejected
 * submit, focus moves to its title so it is announced (on a fresh load focus is left alone).
 */
function ExpiredLinkCard({ focusTitle }: { focusTitle: boolean }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (focusTitle) {
      headingRef.current?.focus()
    }
  }, [focusTitle])

  return (
    <div data-slot="expired-link" className="flex flex-col items-center py-2 text-center">
      <span
        aria-hidden="true"
        className="grid size-14 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground [&_svg]:size-6"
      >
        <Link2OffIcon />
      </span>
      <h1 ref={headingRef} tabIndex={-1} className="mt-4 text-display">
        This reset link has expired
      </h1>
      <p className="mt-1.5 mb-5.5 text-muted-foreground">Reset links work once and expire after 1 hour.</p>
      <Button asChild className="w-full py-2 leading-tight whitespace-normal">
        <Link to="/forgot-password">Get a new link</Link>
      </Button>
    </div>
  )
}

/**
 * `/reset-password?token=…` (FR4, AD-16, Story 1.6b).
 * - The token is read once from the URL the page was opened with, then removed from the address bar (a replace
 *   navigation, i.e. `history.replaceState`), and kept only in this component's memory. It is sent only in the
 *   POST body, never logged or stored. No token (a bare URL, or a reload after the strip) → the expired-link card,
 *   with no request.
 * - New password with the live Password rules checklist; Confirm validates once its length reaches the first
 *   field's, then live.
 * - `POST /api/auth/reset-password`: 200 `{ email }` → `/login` with the "Password updated" notice and the email
 *   prefilled; `token_invalid` → the expired-link card; `validation` → the message under New password (token
 *   kept, retry allowed); offline → the app's single offline toast, form kept; anything else → generic Alert.
 * Works signed in or signed out; never redirects a signed-in user.
 */
export function ResetPasswordPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const rulesId = useId()

  // Captured from the first render only; the URL is stripped right after.
  const [token, setToken] = useState<string | null>(() => tokenFrom(location.search))
  const [linkRejected, setLinkRejected] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmLive, setConfirmLive] = useState(false)
  const [resetPassword, { reset: forgetMutation }] = useResetPasswordMutation()

  useDocumentTitle(token ? "Set a new password" : "Reset link expired")

  useEffect(() => {
    if (location.search.length > 0) {
      void navigate(location.pathname, { replace: true, state: location.state })
    }
    // Only on mount: strip `?token=` (and anything else) from the address bar once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    register,
    handleSubmit,
    setError,
    trigger,
    control,
    formState: { errors, isSubmitting },
  } = useZodForm(resetPasswordSchema, {
    // The checklist gives live feedback while typing; field errors appear on submit, then follow each change.
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { newPassword: "", confirmPassword: "" },
  })

  const [newPassword, confirmPassword] = useWatch({ control, name: ["newPassword", "confirmPassword"] })

  // Confirm starts validating once it is as long as the first field, then stays live (UX-DR25).
  // Counted in code points, as the policy counts length.
  const confirmLength = passwordLength(confirmPassword)
  const confirmReady = confirmLength > 0 && confirmLength >= passwordLength(newPassword)
  if (confirmReady && !confirmLive) {
    setConfirmLive(true)
  }
  useEffect(() => {
    if (confirmLive) {
      void trigger("confirmPassword")
    }
  }, [confirmLive, newPassword, confirmPassword, trigger])

  if (token === null) {
    return (
      <AuthLayout>
        <ExpiredLinkCard focusTitle={linkRejected} />
      </AuthLayout>
    )
  }

  const onValid = async (values: ResetPasswordFormValues) => {
    setFormError(null)
    const result = await resetPassword({ resetPasswordRequest: { token, newPassword: values.newPassword } })
    // Drop the request (token and password) from the API store at once; the page keeps its own state.
    forgetMutation()

    if (!("error" in result)) {
      const state: LoginNoticeState = { notice: PASSWORD_UPDATED_NOTICE, email: result.data.email }
      await navigate("/login", { replace: true, state })
      return
    }

    const problem = toProblem(result.error)
    if (problem.code === "token_invalid") {
      setLinkRejected(true)
      setToken(null)
      return
    }
    if (applyToForm(problem, setError, FORM_FIELDS)) {
      return
    }
    if (problem.code === "network") {
      return
    }
    setFormError(GENERIC_FAILURE_MESSAGE)
  }

  return (
    <AuthLayout>
      <h1 tabIndex={-1} className="text-center text-display">
        Set a new password
      </h1>
      <p className="mt-1.5 mb-5.5 text-center text-muted-foreground">Other devices will be signed out.</p>

      {formError && (
        <Alert tone="error" className="mb-5">
          {formError}
        </Alert>
      )}

      <form noValidate onSubmit={handleSubmit(onValid)} className="grid gap-4">
        <div className="grid gap-2">
          <Field label="New password" required error={errors.newPassword?.message}>
            <PasswordInput autoComplete="new-password" aria-describedby={rulesId} {...register("newPassword")} />
          </Field>
          <PasswordRules id={rulesId} password={newPassword} />
        </div>

        <Field label="Confirm new password" required error={errors.confirmPassword?.message}>
          <PasswordInput autoComplete="new-password" {...register("confirmPassword")} />
        </Field>

        <Button type="submit" className="w-full py-2 leading-tight whitespace-normal" loading={isSubmitting}>
          Save new password
        </Button>
      </form>
      <div className="mt-4 flex justify-center">
        <Button asChild variant="link">
          <Link to="/login">Back to sign in</Link>
        </Button>
      </div>
    </AuthLayout>
  )
}
