import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"

import { useForgotPasswordMutation } from "@/api/generated/auth"
import { useZodForm } from "@/shared/lib/forms"
import { GENERIC_FAILURE_MESSAGE } from "@/shared/lib/messages"
import { applyToForm, toProblem } from "@/shared/lib/problem"
import { useDocumentTitle } from "@/shared/lib/use-document-title"
import { Alert } from "@/shared/ui/alert"
import { Button } from "@/shared/ui/button"
import { Field } from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"

import { AuthLayout } from "../components/auth-layout"
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "../schemas"

const FORM_FIELDS = ["email"] as const

/** Epics Story 1.6 / EXPERIENCE copy: the same words for every email, whether or not an account exists. */
function confirmationFor(email: string) {
  return `Check your inbox. If an account exists for ${email}, we've sent a reset link. It works once and expires in 1 hour.`
}

function BackToSignIn() {
  return (
    <div className="mt-4 flex justify-center">
      <Button asChild variant="link">
        <Link to="/login">Back to sign in</Link>
      </Button>
    </div>
  )
}

/**
 * `/forgot-password` (FR4, Story 1.6b). Client email check (the sign-in rule), then
 * `POST /api/auth/forgot-password`, which always answers 202. On 202 the form is replaced by one fixed
 * confirmation naming the email, so the page never tells an existing account from an unknown one.
 * - server `validation` on `email` → the field message;
 * - offline → the app's single offline toast (base query), form kept;
 * - anything else → generic error Alert, form kept.
 * The confirmation lands in a polite live region that is mounted (empty) from the start, and focus moves to it, since
 * the focused submit button unmounts with the form.
 * Works signed in or signed out; never redirects.
 */
export function ForgotPasswordPage() {
  useDocumentTitle("Forgot password")

  const [forgotPassword] = useForgotPasswordMutation()
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const confirmationRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (sentTo !== null) {
      confirmationRef.current?.focus()
    }
  }, [sentTo])

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useZodForm(forgotPasswordSchema, { defaultValues: { email: "" } })

  const onValid = async ({ email }: ForgotPasswordFormValues) => {
    setFormError(null)
    const result = await forgotPassword({ forgotPasswordRequest: { email } })
    if (!("error" in result)) {
      setSentTo(email)
      return
    }

    const problem = toProblem(result.error)
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
        Forgot your password?
      </h1>

      {/* Mounted before its text arrives, so screen readers announce the confirmation. */}
      <div aria-live="polite" className={sentTo !== null ? "mt-5" : undefined}>
        {sentTo !== null && (
          <Alert ref={confirmationRef} tabIndex={-1} tone="success" className="[overflow-wrap:anywhere]">
            {confirmationFor(sentTo)}
          </Alert>
        )}
      </div>

      {sentTo !== null ? (
        <BackToSignIn />
      ) : (
        <>
          <p className="mt-1.5 mb-5.5 text-center text-muted-foreground">
            Enter your account email and we'll send you a link to set a new password.
          </p>

          {formError && (
            <Alert tone="error" className="mb-5">
              {formError}
            </Alert>
          )}

          <form noValidate onSubmit={handleSubmit(onValid)} className="grid gap-4">
            <Field label="Email" required error={errors.email?.message}>
              <Input type="email" inputMode="email" autoComplete="email" spellCheck={false} {...register("email")} />
            </Field>

            <Button type="submit" className="w-full py-2 leading-tight whitespace-normal" loading={isSubmitting}>
              Send reset link
            </Button>
          </form>
          <BackToSignIn />
        </>
      )}
    </AuthLayout>
  )
}
