/** Shared user-facing copy for failures that are not tied to one feature (EXPERIENCE voice). */

/** Network failure (EXPERIENCE State Patterns), shown as an error toast. */
export const OFFLINE_MESSAGE = "You seem to be offline. Check your connection and try again."

/** 5xx or an unexpected failure. */
export const GENERIC_FAILURE_MESSAGE = "Something went wrong on our side. Your data is safe. Try again in a moment."

/**
 * Notices `/login` shows when it is reached with router `state.notice` (never a URL flag, so a reload
 * drops them). Copy from epics Story 1.4/1.5 and EXPERIENCE State Patterns.
 */
export type LoginNotice = "signedOut" | "sessionEnded" | "accountDisabled"

export const LOGIN_NOTICE_MESSAGES: Record<LoginNotice, string> = {
  signedOut: "You're signed out. See you soon.",
  sessionEnded: "Your session ended. Sign in again to continue.",
  accountDisabled: "This account is disabled.",
}

/** The notice carried in router state, or `null`. */
export function noticeFrom(state: unknown): LoginNotice | null {
  if (typeof state !== "object" || state === null) {
    return null
  }
  const notice = (state as { notice?: unknown }).notice
  return typeof notice === "string" && Object.hasOwn(LOGIN_NOTICE_MESSAGES, notice) ? (notice as LoginNotice) : null
}
