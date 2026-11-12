import { useState } from "react"

import { useMe } from "@/shared/auth"
import { useDocumentTitle } from "@/shared/lib/use-document-title"
import { PageHeader } from "@/shared/ui/page-header"

import { ChangePasswordCard } from "../components/change-password-card"
import { ProfileCard, type PasswordChange } from "../components/profile-card"

/**
 * `/profile`, My account (FR36, Story 1.7b), for every signed-in role: a Profile card and a Change password card,
 * stacked in one column within the 880px form width (two-column field grid from 768px). Rendered inside the app
 * shell, which only mounts once `/api/me` is known.
 */
export function ProfilePage() {
  useDocumentTitle("My account")
  const { me } = useMe()
  const [passwordChange, setPasswordChange] = useState<PasswordChange | null>(null)

  if (!me) {
    return null
  }

  return (
    <div data-slot="profile-page" className="max-w-form">
      <PageHeader title="My account" description="Your details and password." />
      <div className="grid gap-6">
        <ProfileCard me={me} passwordChange={passwordChange} />
        <ChangePasswordCard email={me.email} onChanged={(meStartedAt) => setPasswordChange({ meStartedAt })} />
      </div>
    </div>
  )
}
