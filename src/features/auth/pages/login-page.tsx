import { useEffect, useState } from "react"
import { Link, Navigate, useLocation, useNavigate, useNavigation } from "react-router"

import { roleHome, useMe } from "@/shared/auth"
import { useZodForm } from "@/shared/lib/forms"
import { GENERIC_FAILURE_MESSAGE, LOGIN_NOTICE_MESSAGES, noticeFrom, type LoginNotice } from "@/shared/lib/messages"
import { applyToForm } from "@/shared/lib/problem"
import { useDocumentTitle } from "@/shared/lib/use-document-title"
import { Alert } from "@/shared/ui/alert"
import { Button } from "@/shared/ui/button"
import { Field } from "@/shared/ui/field"
import { Input } from "@/shared/ui/input"
import { PasswordInput } from "@/shared/ui/password-input"

import { AuthLayout } from "../components/auth-layout"
import { useSignIn } from "../hooks/use-sign-in"
import { useLoginNoticeCleanup } from "../hooks/use-sign-out"
import { loginSchema, type LoginFormValues } from "../schemas"

/** UX-DR51 copy (epics Story 1.4). */
const INVALID_CREDENTIALS =
  "Email or password is incorrect. Check both and try again. After 5 tries, sign-in pauses for 15 minutes."

/** EXPERIENCE State Patterns, "Signed out by admin": sign-in attempts show the same message. */
const ACCOUNT_DISABLED = LOGIN_NOTICE_MESSAGES.accountDisabled

const FORM_FIELDS = ["email", "password"] as const

/** The disabled notice is a warning; the other two are calm info notes. */
function NoticeAlert({ notice }: { notice: LoginNotice }) {
  if (notice === "accountDisabled") {
    return (
      <Alert tone="warning" role="alert" className="mb-5">
        {LOGIN_NOTICE_MESSAGES.accountDisabled}
      </Alert>
    )
  }
  return (
    <Alert tone="info" role="status" className="mb-5">
      {LOGIN_NOTICE_MESSAGES[notice]}
    </Alert>
  )
}

/**
 * `/login` (FR-1, UX-DR46/51/11). Client checks first, then `POST /api/auth/login`.
 * - `invalid_credentials` → error Alert; email kept, password cleared and focused.
 * - server `validation` with field errors → messages on those fields, first one focused.
 * - anything else → generic error Alert; offline → the app's single offline toast (base query).
 * Entered data is always kept.
 * Notices (signed out, session ended, account disabled) come from router `state.notice` and share the
 * Alert slot. While one shows, `/api/me` is not called (a session that just ended must not be renewed).
 * A signed-in user without a notice is sent home.
 */
export function LoginPage() {
  useDocumentTitle("Sign in")

  const location = useLocation()
  const navigate = useNavigate()
  const navigation = useNavigation()
  // Read the notice once, then drop it from history state so a reload neither shows it again nor
  // re-runs the cleanup.
  const [notice] = useState(() => noticeFrom(location.state))
  const { me, status } = useMe({ skip: notice !== null })
  const { signIn, pending } = useSignIn()
  const [formError, setFormError] = useState<string | null>(null)
  useLoginNoticeCleanup(notice)
  useEffect(() => {
    if (notice) {
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

  // Right after sign-out or a session end the cache is cleared just after this page shows; never bounce back then.
  if (status === "signedIn" && me && !pending && !notice && navigation.state === "idle") {
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
      return
    }
    setFormError(GENERIC_FAILURE_MESSAGE)
  }

  const shownNotice = formError === null ? notice : null

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
      {shownNotice && <NoticeAlert notice={shownNotice} />}

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
