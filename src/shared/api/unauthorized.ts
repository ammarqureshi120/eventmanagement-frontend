import type { SessionEndCode } from "@/shared/lib/problem"

/**
 * UX-DR11: what happens when the API says the session is gone (401 `session_expired`) or the user was
 * deactivated (401 `account_disabled`). `shared` cannot import the router, so the app registers the
 * handler at start-up (`app/main.tsx`) and decides there where to send the user and with which notice.
 */
export type UnauthorizedHandler = (code: SessionEndCode) => void

let handler: UnauthorizedHandler | null = null

/** Registers (or, with `null`, clears) the handler. Returns a function that restores the previous one. */
export function setUnauthorizedHandler(next: UnauthorizedHandler | null): () => void {
  const previous = handler
  handler = next
  return () => {
    handler = previous
  }
}

/** Called by the base query with the 401 code; a no-op until a handler is registered. */
export function notifyUnauthorized(code: SessionEndCode = "session_expired"): void {
  handler?.(code)
}
