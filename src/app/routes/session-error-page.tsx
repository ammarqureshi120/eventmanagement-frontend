import { CloudOffIcon } from "lucide-react"

import { OFFLINE_MESSAGE } from "@/shared/lib/messages"
import { Button } from "@/shared/ui/button"

import { SystemPage } from "./system-page"

const SERVER_FAULT = "Something went wrong on our side while loading this page. Your data is safe. Try again in a moment."

/**
 * `/api/me` failed for a reason other than a lost session: calm error with a retry (EXPERIENCE Error
 * (load)). Offline says so instead of blaming the server.
 */
export function SessionErrorPage({ problemCode, onRetry }: { problemCode: string | null; onRetry: () => void }) {
  return (
    <SystemPage
      standalone
      tone="error"
      pageName="Something went wrong"
      icon={CloudOffIcon}
      title="We couldn't load this"
      description={problemCode === "network" ? OFFLINE_MESSAGE : SERVER_FAULT}
      action={
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  )
}
