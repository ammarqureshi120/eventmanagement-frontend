/**
 * The password policy, mirrored from the server's `Auth.PasswordPolicy` (FR4, NFR23) for live UX only; the server
 * stays the authority. Length is counted in code points (`[...s].length`, like the server's runes), a letter is any
 * Unicode letter (`\p{L}`) and a number any Unicode decimal digit (`\p{Nd}`).
 */
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_MAX_LENGTH = 128

/** The server's messages, used as client field errors so both sides read the same. */
export const PASSWORD_MESSAGES = {
  tooShort: "Use at least 8 characters.",
  needsLetter: "Include at least one letter.",
  needsNumber: "Include at least one number.",
  tooLong: "Use at most 128 characters.",
} as const

export type PasswordRuleId = "length" | "letter" | "number"

export interface PasswordRule {
  id: PasswordRuleId
  /** Checklist label (UX-DR25). */
  label: string
  /** Field error when the rule is not met. */
  message: string
  test: (password: string) => boolean
}

const LETTER = /\p{L}/u
const DIGIT = /\p{Nd}/u

/** Length in code points, as the server counts runes. */
export function passwordLength(password: string): number {
  return [...password].length
}

/** The three checklist rules, in display order. The 128 maximum is a field error only, not a checklist row. */
export const PASSWORD_RULES: readonly PasswordRule[] = [
  {
    id: "length",
    label: "8+ characters",
    message: PASSWORD_MESSAGES.tooShort,
    test: (password) => passwordLength(password) >= PASSWORD_MIN_LENGTH,
  },
  { id: "letter", label: "A letter", message: PASSWORD_MESSAGES.needsLetter, test: (password) => LETTER.test(password) },
  { id: "number", label: "A number", message: PASSWORD_MESSAGES.needsNumber, test: (password) => DIGIT.test(password) },
]

/** The messages of every rule `password` breaks, in the server's order (length, max, letter, number). */
export function passwordProblems(password: string): string[] {
  const problems: string[] = []
  if (passwordLength(password) < PASSWORD_MIN_LENGTH) {
    problems.push(PASSWORD_MESSAGES.tooShort)
  }
  if (passwordLength(password) > PASSWORD_MAX_LENGTH) {
    problems.push(PASSWORD_MESSAGES.tooLong)
  }
  if (!LETTER.test(password)) {
    problems.push(PASSWORD_MESSAGES.needsLetter)
  }
  if (!DIGIT.test(password)) {
    problems.push(PASSWORD_MESSAGES.needsNumber)
  }
  return problems
}
