/** Shared user-facing copy for failures that are not tied to one feature (EXPERIENCE voice). */

/** Network failure (EXPERIENCE State Patterns), shown as an error toast. */
export const OFFLINE_MESSAGE = "You seem to be offline. Check your connection and try again."

/** 5xx or an unexpected failure. */
export const GENERIC_FAILURE_MESSAGE = "Something went wrong on our side. Your data is safe. Try again in a moment."

/**
 * Notices `/login` shows when it is reached with router `state.notice` (never a URL flag, so a reload
 * drops them). Copy from epics Story 1.4/1.5/1.6 and EXPERIENCE State Patterns.
 */
export type LoginNotice = "signedOut" | "sessionEnded" | "accountDisabled" | "passwordUpdated"

export const LOGIN_NOTICE_MESSAGES: Record<LoginNotice, string> = {
  signedOut: "You're signed out. See you soon.",
  sessionEnded: "Your session ended. Sign in again to continue.",
  accountDisabled: "This account is disabled.",
  passwordUpdated: "Password updated. Sign in with your new password.",
}

/** Router state for `/login`: the notice and, after a password reset, the email to prefill (Story 1.6b). */
export interface LoginNoticeState {
  notice: LoginNotice
  email?: string
}

/** Longest email the server accepts (`User.EmailMaxLength`); anything longer in router state is ignored. */
const EMAIL_MAX_LENGTH = 256

/** The notice carried in router state, or `null`; only `passwordUpdated` keeps a usable prefill email. */
export function noticeFrom(state: unknown): LoginNoticeState | null {
  if (typeof state !== "object" || state === null) {
    return null
  }
  const { notice, email } = state as { notice?: unknown; email?: unknown }
  if (typeof notice !== "string" || !Object.hasOwn(LOGIN_NOTICE_MESSAGES, notice)) {
    return null
  }
  const trimmed = notice === "passwordUpdated" && typeof email === "string" ? email.trim() : ""
  return trimmed.length > 0 && trimmed.length <= EMAIL_MAX_LENGTH
    ? { notice: notice as LoginNotice, email: trimmed }
    : { notice: notice as LoginNotice }
}
