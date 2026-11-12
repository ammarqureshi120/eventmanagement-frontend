import { z } from "zod"

import { confirmProblem } from "@/shared/lib/password-confirm"
import { passwordProblems } from "@/shared/lib/password-policy"

/**
 * My account checks (Story 1.7b), mirrored from the 1.7a server validators for UX only (the server stays the
 * authority): `UpdateMyProfileCommandValidator` and `ChangeMyPasswordCommandValidator`. Messages are the server's.
 */
export const PROFILE_MESSAGES = {
  firstNameRequired: "Enter your first name.",
  lastNameRequired: "Enter your last name.",
  nameTooLong: "Use 100 characters or fewer.",
  phoneTooLong: "Use 32 characters or fewer.",
  phoneInvalid: "Enter a phone number with digits, spaces and + ( ) - . only.",
} as const

export const CHANGE_PASSWORD_MESSAGES = {
  currentRequired: "Enter your current password.",
  /** The server's message for a wrong current password (400 `validation` on `currentPassword`). */
  currentWrong: "That's not your current password. Check it and try again.",
} as const

/** `User.NameMaxLength` / `User.PhoneMaxLength` (UTF-16 units, as .NET counts `string.Length`). */
export const NAME_MAX_LENGTH = 100
export const PHONE_MAX_LENGTH = 32

const PHONE_CHARACTERS = /^[0-9 +().-]+$/
const ASCII_DIGIT = /[0-9]/

/** `User.IsValidPhone` on a trimmed, non-empty value: ASCII digits, spaces and `+ ( ) - .`, with at least one digit. */
export function isValidPhone(phone: string): boolean {
  return phone.length > 0 && phone.length <= PHONE_MAX_LENGTH && PHONE_CHARACTERS.test(phone) && ASCII_DIGIT.test(phone)
}

/** The server's first message for a phone as typed, or `undefined` (blank means "no phone"). */
export function phoneProblem(phone: string): string | undefined {
  const trimmed = phone.trim()
  if (trimmed.length === 0) {
    return undefined
  }
  if (trimmed.length > PHONE_MAX_LENGTH) {
    return PROFILE_MESSAGES.phoneTooLong
  }
  return isValidPhone(trimmed) ? undefined : PROFILE_MESSAGES.phoneInvalid
}

const name = (required: string) =>
  z.string().trim().min(1, required).max(NAME_MAX_LENGTH, PROFILE_MESSAGES.nameTooLong)

/** Profile card: names trimmed and required, phone optional (blank → `null`). */
export const profileSchema = z.object({
  firstName: name(PROFILE_MESSAGES.firstNameRequired),
  lastName: name(PROFILE_MESSAGES.lastNameRequired),
  phone: z
    .string()
    .superRefine((value, ctx) => {
      const problem = phoneProblem(value)
      if (problem) {
        ctx.addIssue({ code: "custom", message: problem })
      }
    })
    .transform((value) => {
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed : null
    }),
})

export type ProfileFormInput = z.input<typeof profileSchema>
export type ProfileFormValues = z.output<typeof profileSchema>

/**
 * Change password card: current password required (whitespace-only counts as empty, like the server's `NotEmpty`),
 * the shared password policy on `newPassword` (first broken rule), and Confirm must match. Passwords are never
 * trimmed. One object refinement, so every message shows at once.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string(),
    newPassword: z.string(),
    confirmPassword: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.currentPassword.trim().length === 0) {
      ctx.addIssue({ code: "custom", path: ["currentPassword"], message: CHANGE_PASSWORD_MESSAGES.currentRequired })
    }
    const [firstProblem] = passwordProblems(values.newPassword)
    if (firstProblem) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: firstProblem })
    }
    const mismatch = confirmProblem(values.newPassword, values.confirmPassword)
    if (mismatch) {
      ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: mismatch })
    }
  })

export type ChangePasswordFormInput = z.input<typeof changePasswordSchema>
export type ChangePasswordFormValues = z.output<typeof changePasswordSchema>
