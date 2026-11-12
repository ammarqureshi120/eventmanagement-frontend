import { z } from "zod"

import { confirmProblem } from "@/shared/lib/password-confirm"
import { passwordProblems } from "@/shared/lib/password-policy"

/**
 * Sign-in form checks (UX only; the server stays the authority from Story 1.4).
 * Messages are the agreed copy (spec 1.2 Decisions).
 */
const emailRule = z
  .string()
  .trim()
  .min(1, "Enter your email address.")
  .pipe(z.email("Enter an email like name@company.com."))

export const loginSchema = z.object({
  email: emailRule,
  password: z.string().min(1, "Enter your password."),
})

export type LoginFormInput = z.input<typeof loginSchema>
export type LoginFormValues = z.output<typeof loginSchema>

/** `/forgot-password` (Story 1.6b): the same email rule as sign-in, as the server's validator. */
export const forgotPasswordSchema = z.object({
  email: emailRule,
})

export type ForgotPasswordFormInput = z.input<typeof forgotPasswordSchema>
export type ForgotPasswordFormValues = z.output<typeof forgotPasswordSchema>

/**
 * `/reset-password` (Story 1.6b): the shared password policy (first broken rule, the server's message) on
 * `newPassword`, and Confirm must match it. Both checks run in one object refinement so the mismatch shows even
 * while the policy still fails. Passwords are never trimmed.
 */
export const resetPasswordSchema = z
  .object({
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((values, ctx) => {
    const [firstProblem] = passwordProblems(values.newPassword)
    if (firstProblem) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: firstProblem })
    }
    const mismatch = confirmProblem(values.newPassword, values.confirmPassword)
    if (mismatch) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: mismatch })
    }
  })

export type ResetPasswordFormInput = z.input<typeof resetPasswordSchema>
export type ResetPasswordFormValues = z.output<typeof resetPasswordSchema>
