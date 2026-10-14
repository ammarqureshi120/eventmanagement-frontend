import { CompassIcon } from "lucide-react"

import { useMe } from "@/shared/auth"

import { AppShell } from "../shell/app-shell"
import { AppLoading } from "./app-loading"
import { SessionErrorPage } from "./session-error-page"
import { SystemPage } from "./system-page"

/** UX-DR11 copy (epics Story 1.4, EXPERIENCE Not found). Same page for "does not exist" and "not yours" (NFR-2). */
export function NotFoundContent({ standalone = false }: { standalone?: boolean }) {
  return (
    <SystemPage
      standalone={standalone}
      pageName="Page not found"
      titleName="Not found"
      icon={CompassIcon}
      title="We couldn't find that"
      description="It may have been moved, or you may not have access to it."
    />
  )
}

/** `*`: Not found inside the app shell when signed in, standalone otherwise. */
export function NotFoundPage() {
  const { status, problemCode, refetch } = useMe()

  if (status === "loading") {
    return <AppLoading />
  }
  if (status === "error") {
    return <SessionErrorPage problemCode={problemCode} onRetry={refetch} />
  }
  if (status === "signedIn") {
    return (
      <AppShell>
        <NotFoundContent />
      </AppShell>
    )
  }
  return <NotFoundContent standalone />
}
