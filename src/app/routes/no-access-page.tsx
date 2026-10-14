import { LockIcon } from "lucide-react"

import { roleLabel } from "@/shared/auth"

import { SystemPage } from "./system-page"

/** UX-DR11: an area route outside the signed-in role (copy from epics Story 1.4). */
export function NoAccessPage({ role }: { role: string }) {
  return (
    <SystemPage
      pageName="No access"
      icon={LockIcon}
      title="This area isn't available for your role"
      description={`You're signed in as ${roleLabel(role)}. If you need access, ask an Org Administrator.`}
    />
  )
}
