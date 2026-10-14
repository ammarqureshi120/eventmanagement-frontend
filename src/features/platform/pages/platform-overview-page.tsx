import { LayoutDashboardIcon } from "lucide-react"

import { useDocumentTitle } from "@/shared/lib/use-document-title"
import { EmptyState } from "@/shared/ui/empty-state"
import { PageHeader } from "@/shared/ui/page-header"

/**
 * `/platform`, the System Administrator home (UX-DR8/10/48). Organizations and their counts arrive with
 * Epic 2; until then a calm empty state with no actions.
 */
export function PlatformOverviewPage() {
  useDocumentTitle("Platform overview")

  return (
    <>
      <PageHeader title="Platform overview" />
      <EmptyState
        icon={LayoutDashboardIcon}
        title="Nothing to show yet"
        description="Organizations you create will show up here."
      />
    </>
  )
}
