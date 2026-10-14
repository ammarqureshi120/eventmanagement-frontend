import { useEffect, useState } from "react"

import { Spinner } from "@/shared/ui/spinner"

/** Loading only shows after this delay, so fast answers never flicker (EXPERIENCE Skeleton). */
export const LOADING_DELAY_MS = 200

/** Full-height, centred Spinner + "Loading…" while the session is checked. Shown after 200ms. */
export function AppLoading() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), LOADING_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div data-slot="app-loading" role="status" aria-live="polite" className="grid min-h-dvh place-items-center p-4">
      {visible && (
        <span className="inline-flex items-center gap-2.5 text-muted-foreground">
          <Spinner />
          Loading…
        </span>
      )}
    </div>
  )
}
