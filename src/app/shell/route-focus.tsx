import { useEffect } from "react"
import { useLocation, useNavigationType } from "react-router"

/** True until the first route has rendered in this document (a fresh page load keeps the browser's focus). */
let initialLoad = true

/** Focuses the page H1 inside `main` (tabIndex -1), if there is one. */
export function focusPageHeading(): boolean {
  const heading = document.querySelector<HTMLElement>("main h1")
  if (!heading) {
    return false
  }
  heading.focus()
  return true
}

/**
 * UX-DR48: on every pathname change, move focus to the page H1 so keyboard and screen-reader users
 * start at the new page's title. Mounted once at the router root, so standalone pages (`/login`,
 * Not found, session error) get it too. A fresh page load (initial POP) leaves focus alone, so the skip link
 * stays the first Tab stop.
 */
export function RouteFocus() {
  const { pathname } = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    const firstRender = initialLoad
    initialLoad = false
    if (firstRender && navigationType === "POP") {
      return
    }
    if (!focusPageHeading()) {
      // A lazy page may commit a frame later.
      const frame = requestAnimationFrame(() => focusPageHeading())
      return () => cancelAnimationFrame(frame)
    }
  }, [pathname, navigationType])

  return null
}

/** Test seam: makes the next render behave like a fresh page load again. */
export function resetRouteFocusForTests() {
  initialLoad = true
}
