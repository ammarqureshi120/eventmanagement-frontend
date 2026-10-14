import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import { Link } from "react-router"

import { useDocumentTitle } from "@/shared/lib/use-document-title"
import { Button } from "@/shared/ui/button"
import { EmptyState } from "@/shared/ui/empty-state"

interface SystemPageProps {
  /** Screen-reader H1. */
  pageName: string
  /** `document.title` page name (defaults to `pageName`). */
  titleName?: string
  icon: LucideIcon
  title: string
  description: ReactNode
  /** Standalone (signed out): own `<main>` and skip-link target. Inside the shell: content only. */
  standalone?: boolean
  tone?: "default" | "error"
  action?: ReactNode
}

/**
 * Full-page system state (UX-DR11): an sr-only H1, the Empty state with an H2 title, one sentence and
 * "Go to home". Inside the app shell it renders as page content; signed out it brings its own `<main>`.
 */
export function SystemPage({ pageName, titleName, icon, title, description, standalone = false, tone, action }: SystemPageProps) {
  useDocumentTitle(titleName ?? pageName)

  const content = (
    <>
      <h1 tabIndex={-1} className="sr-only">
        {pageName}
      </h1>
      <EmptyState
        icon={icon}
        tone={tone}
        title={title}
        description={description}
        action={
          action ?? (
            <Button asChild variant="outline">
              <Link to="/">Go to home</Link>
            </Button>
          )
        }
      />
    </>
  )

  if (!standalone) {
    return content
  }

  return (
    <main
      id="main"
      tabIndex={-1}
      className={[
        "mx-auto grid min-h-dvh w-full max-w-xl content-center py-8",
        "pr-[calc(16px+env(safe-area-inset-right))] pl-[calc(16px+env(safe-area-inset-left))]",
      ].join(" ")}
    >
      {content}
    </main>
  )
}
