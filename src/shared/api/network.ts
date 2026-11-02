/**
 * EXPERIENCE "Network failure": every request that never got a response (fetch failed or timed out) is
 * reported here by the base query, so the app shows one offline toast instead of each caller its own.
 * `shared` cannot show app UI, so the app registers the handler at start-up (`app/main.tsx`).
 */
export type NetworkErrorHandler = () => void

let handler: NetworkErrorHandler | null = null

/** Registers (or, with `null`, clears) the handler. Returns a function that restores the previous one. */
export function setNetworkErrorHandler(next: NetworkErrorHandler | null): () => void {
  const previous = handler
  handler = next
  return () => {
    handler = previous
  }
}

/** Called by the base query on `FETCH_ERROR` / `TIMEOUT_ERROR`; a no-op until a handler is registered. */
export function notifyNetworkError(): void {
  handler?.()
}
