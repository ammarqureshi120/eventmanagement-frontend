/**
 * UX-DR11: what happens when the API says the session is gone (401 `session_expired`).
 * `shared` cannot import the router, so the app registers the handler at start-up (`app/main.tsx`)
 * and decides there whether the current route needs a redirect to `/login?returnTo=`.
 */
export type UnauthorizedHandler = () => void

let handler: UnauthorizedHandler | null = null

/** Registers (or, with `null`, clears) the handler. Returns a function that restores the previous one. */
export function setUnauthorizedHandler(next: UnauthorizedHandler | null): () => void {
  const previous = handler
  handler = next
  return () => {
    handler = previous
  }
}

/** Called by the base query; a no-op until a handler is registered. */
export function notifyUnauthorized(): void {
  handler?.()
}
