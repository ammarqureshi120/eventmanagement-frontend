import { useCallback, useId, useRef, useState } from "react"
import { useWatch } from "react-hook-form"
import { toast } from "sonner"

import { useChangeMyPasswordMutation, useGetMeQuery } from "@/api/generated/me"
import { useZodForm } from "@/shared/lib/forms"
import { GENERIC_FAILURE_MESSAGE } from "@/shared/lib/messages"
import { useLiveConfirm } from "@/shared/lib/password-confirm"
import { applyToForm, toProblem } from "@/shared/lib/problem"
import { Alert } from "@/shared/ui/alert"
import { Button } from "@/shared/ui/button"
import { Field } from "@/shared/ui/field"
import { FormErrorSummary } from "@/shared/ui/form-error-summary"
import { PasswordInput } from "@/shared/ui/password-input"
import { PasswordRules } from "@/shared/ui/password-rules"

import { changePasswordSchema, type ChangePasswordFormInput, type ChangePasswordFormValues } from "../schemas"
import { AccountCard } from "./account-card"

/** The fields the server validates (Confirm is client-only). */
const SERVER_FIELDS = ["currentPassword", "newPassword"] as const

const EMPTY: ChangePasswordFormInput = { currentPassword: "", newPassword: "", confirmPassword: "" }

export const CHANGE_PASSWORD_COPY = {
  title: "Change password",
  submit: "Change password",
  changedTitle: "Password updated",
  changedDescription: "Other devices were signed out.",
} as const

interface ChangePasswordCardProps {
  /** The account's email, for password managers (a hidden `username` field). */
  email: string
  /**
   * Called after a successful change (the server bumped the version and re-issued this session's cookie), with the
   * `startedTimeStamp` of the last `/api/me` fetch when the change was sent.
   */
  onChanged: (meStartedAt: number | undefined) => void
}

/**
 * Change password card (FR36, Story 1.7b): Current password, New password with the live Password rules checklist,
 * Confirm new password (quiet until it is as long as the new password, then live; UX-DR25).
 * - 204 → toast "Password updated · Other devices were signed out.", all three fields cleared; this session stays
 *   signed in (the server re-issued its cookie) and `Me` refetches (AD-29).
 * - `validation` → messages under the fields, e.g. a wrong current password on Current password; nothing cleared.
 * - Offline → the app's single offline toast, fields kept. Anything else → a generic Alert.
 * Passwords are never logged or stored; the mutation state is dropped right after each call.
 */
export function ChangePasswordCard({ email, onChanged }: ChangePasswordCardProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const rulesId = useId()
  const [changeMyPassword, { reset: forgetMutation }] = useChangeMyPasswordMutation()
  const { startedTimeStamp: meStartedAt } = useGetMeQuery()
  const [formError, setFormError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const {
    register,
    handleSubmit,
    setError,
    trigger,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useZodForm(changePasswordSchema, {
    // The checklist gives live feedback while typing; field errors appear on submit, then follow each change.
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: EMPTY,
  })

  const [newPassword, confirmPassword] = useWatch({ control, name: ["newPassword", "confirmPassword"] })
  const validateConfirm = useCallback(() => void trigger("confirmPassword"), [trigger])
  const confirm = useLiveConfirm(newPassword, confirmPassword, validateConfirm)

  const onValid = async (values: ChangePasswordFormValues) => {
    setFormError(null)
    const result = await changeMyPassword({
      changeMyPasswordRequest: { currentPassword: values.currentPassword, newPassword: values.newPassword },
    })
    // Drop the request (both passwords) from the API store at once.
    forgetMutation()

    if (!("error" in result)) {
      toast.success(CHANGE_PASSWORD_COPY.changedTitle, { description: CHANGE_PASSWORD_COPY.changedDescription })
      confirm.stop()
      reset(EMPTY)
      setAttempt(0)
      onChanged(meStartedAt)
      return
    }

    const problem = toProblem(result.error)
    if (applyToForm(problem, setError, SERVER_FIELDS)) {
      setAttempt((count) => count + 1)
      return
    }
    if (problem.code === "network") {
      return
    }
    setFormError(GENERIC_FAILURE_MESSAGE)
  }

  return (
    <AccountCard title={CHANGE_PASSWORD_COPY.title} data-slot="change-password-card">
      <div className="grid gap-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <FormErrorSummary errors={errors} attempt={attempt} containerRef={formRef} />

        <form
          ref={formRef}
          noValidate
          onSubmit={handleSubmit(onValid, () => setAttempt((count) => count + 1))}
          className="grid gap-4"
        >
          {/* Lets password managers file the new password under this account. */}
          <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Current password" required error={errors.currentPassword?.message}>
              <PasswordInput autoComplete="current-password" {...register("currentPassword")} />
            </Field>
            <div className="grid content-start gap-2 md:col-start-1">
              <Field label="New password" required error={errors.newPassword?.message}>
                <PasswordInput autoComplete="new-password" aria-describedby={rulesId} {...register("newPassword")} />
              </Field>
              <PasswordRules id={rulesId} password={newPassword} />
            </div>
            <Field label="Confirm new password" required error={errors.confirmPassword?.message} className="content-start">
              <PasswordInput autoComplete="new-password" {...register("confirmPassword")} />
            </Field>
          </div>

          <div>
            <Button type="submit" className="w-full py-2 leading-tight whitespace-normal sm:w-auto" loading={isSubmitting}>
              {CHANGE_PASSWORD_COPY.submit}
            </Button>
          </div>
        </form>
      </div>
    </AccountCard>
  )
}
