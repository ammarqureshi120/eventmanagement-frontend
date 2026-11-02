/**
 * Story 1.5 idle tracking: the server renews the session cookie on every authenticated request, so any
 * HTTP response except a 401 counts as session activity. The base query reports each one here; the idle
 * warning listens. Activity is never inferred from mouse or keyboard input.
 */
export type SessionActivityListener = (at: number) => void

const listeners = new Set<SessionActivityListener>()

/** Subscribes to session activity. Returns the unsubscribe function. */
export function onSessionActivity(listener: SessionActivityListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Called by the base query after a non-401 response. */
export function notifySessionActivity(at: number = Date.now()): void {
  for (const listener of [...listeners]) {
    listener(at)
  }
}
