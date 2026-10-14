import { useEffect } from "react"

/**
 * UX-DR48: sets `document.title` to "<Page> · EventHub" while the page is mounted and restores the
 * previous title on unmount.
 */
export function useDocumentTitle(page: string) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = `${page} · EventHub`
    return () => {
      document.title = previousTitle
    }
  }, [page])
}
