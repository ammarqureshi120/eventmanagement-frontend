import { useEffect, useState } from "react"
import { Link, Navigate, useLocation, useNavigate, useNavigation } from "react-router"
import { toast } from "sonner"

import { roleHome, useMe } from "@/shared/auth"
import { useZodForm } from "@/shared/lib/forms"
import { GENERIC_FAILURE_MESSAGE, OFFLINE_MESSAGE } from "@/shared/lib/messages"
import { applyToForm } from "@/shared/lib/problem"
import { useDocumentTitle } from "@/shared/lib/use-document-title"
import { Alert } from "@/shared/ui/alert"
import { Button } from "@/shared/ui/button"
import { Field } from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"
import { PasswordInput } from "@/shared/ui/password-input"

import { AuthLayout } from "../components/auth-layout"
import { useSignIn } from "../hooks/use-sign-in"
import { SIGNED_OUT_NOTICE, useSignedOutCleanup } from "../hooks/use-sign-out"
import { loginSchema, type LoginFormValues } from "../schemas"

/** UX-DR51 copy (epics Story 1.4). */
const INVALID_CREDENTIALS =
  "Email or password is incorrect. Check both and try again. After 5 tries, sign-in pauses for 15 minutes."

const SIGNED_OUT = "You're signed out. See you soon."

/** EXPERIENCE State Patterns, "Signed out by admin": sign-in attempts show the same message. */
const ACCOUNT_DISABLED = "This account is disabled."

const FORM_FIELDS = ["email", "password"] as const

function hasNotice(state: unknown, notice: string): boolean {
  return typeof state === "object" && state !== null && (state as { notice?: unknown }).notice === notice
}

/**
 * `/login` (FR-1, UX-DR46/51/11). Client checks first, then `POST /api/auth/login`.
 * - `invalid_credentials` → error Alert; email kept, password cleared and focused.
 * - server `validation` with field errors → messages on those fields, first one focused.
 * - anything else → generic error Alert; offline → toast. Entered data is always kept.
 * The signed-out notice comes from router state and shares the Alert slot. A signed-in user is sent home.
 */
export function LoginPage() {
  useDocumentTitle("Sign in")

  const location = useLocation()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const { me, status } = useMe()
  const { signIn, pending } = useSignIn()
  const [formError, setFormError] = useState<string | null>(null)
  // Read the notice once, then drop it from history state so a reload neither shows it again nor
  // re-runs the sign-out cleanup.
  const [signedOutNotice] = useState(() => hasNotice(location.state, SIGNED_OUT_NOTICE))
  useSignedOutCleanup(signedOutNotice)
  useEffect(() => {
    if (signedOutNotice) {
      void navigate(`${location.pathname}${location.search}`, { replace: true, state: null })
    }
    // Only on mount: the notice is captured above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const {
    register,
    handleSubmit,
    setError,
    resetField,
    setFocus,
    formState: { errors, isSubmitting },
  } = useZodForm(loginSchema, { defaultValues: { email: "", password: "" } })

  // Right after sign-out the cache is cleared just after this page shows; never bounce back then.
  if (status === "signedIn" && me && !pending && !signedOutNotice && navigation.state === "idle") {
    return <Navigate to={roleHome(me.role) ?? "/"} replace />
  }

  const onValid = async (values: LoginFormValues) => {
    setFormError(null)
    const result = await signIn(values)
    if (result.ok) {
      return
    }

    const { problem } = result
    if (problem.code === "invalid_credentials") {
      resetField("password")
      setFormError(INVALID_CREDENTIALS)
      setFocus("password")
      return
    }
    if (problem.code === "account_disabled") {
      setFormError(ACCOUNT_DISABLED)
      return
    }
    if (applyToForm(problem, setError, FORM_FIELDS)) {
      return
    }
    if (problem.code === "network") {
      toast.error(OFFLINE_MESSAGE)
      return
    }
    setFormError(GENERIC_FAILURE_MESSAGE)
  }

  const showSignedOut = formError === null && signedOutNotice

  return (
    <AuthLayout>
      <h1 tabIndex={-1} className="text-center text-display">
        Sign in
      </h1>
      <p className="mt-1.5 mb-5.5 text-center text-muted-foreground">Welcome back. Sign in to manage your events.</p>

      {formError && (
        <Alert tone="error" className="mb-5">
          {formError}
        </Alert>
      )}
      {showSignedOut && (
        <Alert tone="info" role="status" className="mb-5">
          {SIGNED_OUT}
        </Alert>
      )}

      <form noValidate onSubmit={handleSubmit(onValid)} className="grid gap-4">
        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" inputMode="email" autoComplete="email" spellCheck={false} {...register("email")} />
        </Field>

        <Field label="Password" required error={errors.password?.message}>
          <PasswordInput autoComplete="current-password" {...register("password")} />
        </Field>

        <div className="-mt-1.5 flex justify-end">
          <Button asChild variant="link">
            <Link to="/forgot-password">Forgot password?</Link>
          </Button>
        </div>

        <Button type="submit" className="w-full" loading={isSubmitting || pending}>
          Sign in
        </Button>
      </form>
    </AuthLayout>
  )
}
