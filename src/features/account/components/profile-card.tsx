import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { useGetMeQuery, useUpdateMyProfileMutation, type MeResponse } from "@/api/generated/me"
import { roleLabel } from "@/shared/auth"
import { useZodForm } from "@/shared/lib/forms"
import { GENERIC_FAILURE_MESSAGE } from "@/shared/lib/messages"
import { applyToForm, toProblem } from "@/shared/lib/problem"
import { Alert } from "@/shared/ui/alert"
import { Button } from "@/shared/ui/button"
import { Field } from "@/shared/ui/field"
import { FormErrorSummary } from "@/shared/ui/form-error-summary"
import { Input } from "@/shared/ui/input"

import { profileSchema, type ProfileFormInput, type ProfileFormValues } from "../schemas"
import { AccountCard } from "./account-card"

const FORM_FIELDS = ["firstName", "lastName", "phone"] as const

export const PROFILE_COPY = {
  title: "Profile",
  save: "Save changes",
  emailHint: "Your email is your sign-in and can't be changed.",
  /** Anyone who is signed in is Active (a deactivated user cannot sign in). */
  status: "Active",
  savedTitle: "Profile saved",
  savedDescription: "Your details are updated.",
  conflict: "Someone else changed your details. Reload to see the latest — nothing was saved.",
  reload: "Reload details",
} as const

function valuesFrom(me: MeResponse): ProfileFormInput {
  return { firstName: me.firstName, lastName: me.lastName, phone: me.phone ?? "" }
}

/**
 * A password change made on this page. `meStartedAt` is the `startedTimeStamp` of the last `/api/me` fetch when the
 * change was sent: the refetch it triggers (the `Me` tag) starts later.
 */
export interface PasswordChange {
  meStartedAt: number | undefined
}

/**
 * A requested re-seed from `/api/me`, settled by the first `/api/me` fetch that started after the request (a later
 * `startedTimeStamp` than `startedAt`): its data re-seeds the form, its failure just ends the wait.
 */
interface Reseed {
  startedAt: number | undefined
  /**
   * - `saved`: after an own save; values typed after the submit (differing from `submitted`) are kept.
   * - `reload`: "Reload details"; everything resets to the server values and the conflict clears.
   * - `keepEdits`: after a password change; edits in progress are kept, only the version and untouched fields follow.
   */
  kind: "saved" | "reload" | "keepEdits"
  submitted?: ProfileFormInput
}

/** What the effect pushes into the form (RHF keeps its own store). */
interface Seed {
  values: ProfileFormInput
  kind: Reseed["kind"]
  submitted?: ProfileFormInput
}

interface ProfileCardProps {
  me: MeResponse
  /** The last password change on this page: it bumped the version (a credential write), so the form re-seeds. */
  passwordChange: PasswordChange | null
}

/**
 * Profile card (FR36, Story 1.7b): First name, Last name, Phone (optional) editable; Email (with its hint), Role and
 * Status read-only. Seeded from `/api/me`; a save sends the `version` of the `/api/me` it was seeded from.
 * - 204 → toast "Profile saved · Your details are updated."; the `Me` tag invalidates (AD-29). Until the refetched
 *   `/api/me` arrives, Save is busy (its version is stale); then the form re-seeds with its values and version, keeping
 *   anything typed after the submit.
 * - A password change elsewhere on the page re-seeds the version too, keeping what the user is typing — except while
 *   the conflict Alert shows: only "Reload details" may move past a conflict.
 * - 409 `concurrency_conflict` → a warning Alert with "Reload details" (refetches `/api/me`, then resets the form to
 *   the server values and clears the Alert); the inputs are kept until then.
 * - A failed `/api/me` refetch ends the wait: offline → the app's offline toast, anything else → a generic Alert.
 * - `validation` → messages under the fields (`applyToForm`); more than one → the summary Alert, focus on the first.
 * - Offline → the app's single offline toast, inputs kept. Anything else → a generic Alert.
 */
export function ProfileCard({ me, passwordChange }: ProfileCardProps) {
  const formRef = useRef<HTMLFormElement>(null)
  const {
    data: latestMe,
    startedTimeStamp,
    fulfilledTimeStamp,
    isFetching,
    isError,
    error: meError,
    refetch,
  } = useGetMeQuery()
  const [updateMyProfile] = useUpdateMyProfileMutation()

  const [version, setVersion] = useState(me.version)
  const [reseed, setReseed] = useState<Reseed | null>(null)
  const [conflict, setConflict] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [seenPasswordChange, setSeenPasswordChange] = useState(passwordChange)
  const [seed, setSeed] = useState<Seed | null>(null)

  // State is adjusted while rendering (no effects), see https://react.dev/learn/you-might-not-need-an-effect.
  if (passwordChange !== seenPasswordChange) {
    // A password change bumped the version: follow it, keeping what the user is typing.
    setSeenPasswordChange(passwordChange)
    if (passwordChange) {
      const startedAt = passwordChange.meStartedAt
      setReseed((current) => current ?? { startedAt, kind: "keepEdits" })
    }
  }
  const newerFetchSettled =
    reseed !== null &&
    !isFetching &&
    startedTimeStamp !== undefined &&
    (reseed.startedAt === undefined || startedTimeStamp > reseed.startedAt)
  if (reseed && newerFetchSettled) {
    setReseed(null)
    if (isError || !latestMe || fulfilledTimeStamp === undefined || fulfilledTimeStamp < startedTimeStamp) {
      // The refetch failed: stop waiting. Offline already has its toast; anything else gets the generic Alert.
      if (toProblem(meError).code !== "network") {
        setFormError(GENERIC_FAILURE_MESSAGE)
      }
    } else if (reseed.kind === "keepEdits" && conflict) {
      // A conflict is showing: never adopt a newer version behind the user's back; "Reload details" does that.
    } else {
      setVersion(latestMe.version)
      setSeed({ values: valuesFrom(latestMe), kind: reseed.kind, submitted: reseed.submitted })
      if (reseed.kind === "reload") {
        setConflict(false)
        setAttempt(0)
      }
    }
  }

  const {
    register,
    handleSubmit,
    setError,
    reset,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useZodForm(profileSchema, {
    // Messages appear on submit, then follow each change. Validating on blur would insert a message (and shift the
    // Save button) between a tap's press and release on phones, swallowing the tap.
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: valuesFrom(me),
  })

  // Push a re-seed into the form.
  useEffect(() => {
    if (!seed) {
      return
    }
    if (seed.kind === "keepEdits") {
      reset(seed.values, { keepDirtyValues: true })
      return
    }
    const current = getValues()
    reset(seed.values)
    if (seed.kind === "saved" && seed.submitted) {
      // Keep what was typed after the submit.
      for (const name of FORM_FIELDS) {
        if (current[name] !== seed.submitted[name]) {
          setValue(name, current[name], { shouldDirty: true })
        }
      }
    }
  }, [seed, reset, getValues, setValue])

  const onValid = async (values: ProfileFormValues) => {
    setFormError(null)
    const submitted = getValues()
    const result = await updateMyProfile({
      updateMyProfileRequest: { firstName: values.firstName, lastName: values.lastName, phone: values.phone, version },
    })

    if (!("error" in result)) {
      toast.success(PROFILE_COPY.savedTitle, { description: PROFILE_COPY.savedDescription })
      setAttempt(0)
      setConflict(false)
      setReseed({ startedAt: startedTimeStamp, kind: "saved", submitted })
      return
    }

    const problem = toProblem(result.error)
    if (problem.code === "concurrency_conflict") {
      setConflict(true)
      return
    }
    if (applyToForm(problem, setError, FORM_FIELDS)) {
      setAttempt((count) => count + 1)
      return
    }
    if (problem.code === "network") {
      return
    }
    setFormError(GENERIC_FAILURE_MESSAGE)
  }

  const reloadDetails = () => {
    setFormError(null)
    setReseed({ startedAt: startedTimeStamp, kind: "reload" })
    void refetch()
  }

  /** Saving now would send a version the server has already moved past. */
  const waitingForMe = reseed !== null

  return (
    <AccountCard title={PROFILE_COPY.title} data-slot="profile-card">
      <div className="grid gap-4">
        {conflict && (
          <Alert tone="warning" role="alert" data-slot="profile-conflict">
            <p>{PROFILE_COPY.conflict}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-3 w-full py-2 leading-tight whitespace-normal sm:w-auto"
              loading={reseed?.kind === "reload"}
              onClick={reloadDetails}
            >
              {PROFILE_COPY.reload}
            </Button>
          </Alert>
        )}
        {formError && <Alert tone="error">{formError}</Alert>}
        <FormErrorSummary errors={errors} attempt={attempt} containerRef={formRef} />

        <form
          ref={formRef}
          noValidate
          onSubmit={handleSubmit(onValid, () => setAttempt((count) => count + 1))}
          className="grid gap-4"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="First name" required error={errors.firstName?.message}>
              <Input autoComplete="given-name" {...register("firstName")} />
            </Field>
            <Field label="Last name" required error={errors.lastName?.message}>
              <Input autoComplete="family-name" {...register("lastName")} />
            </Field>
            <Field label="Phone" optional error={errors.phone?.message}>
              <Input type="tel" inputMode="tel" autoComplete="tel" {...register("phone")} />
            </Field>
            <Field label="Email" hint={PROFILE_COPY.emailHint}>
              <Input type="email" readOnly value={me.email} />
            </Field>
            <Field label="Role">
              <Input readOnly value={roleLabel(me.role)} />
            </Field>
            <Field label="Status">
              <Input readOnly value={PROFILE_COPY.status} />
            </Field>
          </div>

          <div>
            <Button
              type="submit"
              className="w-full py-2 leading-tight whitespace-normal sm:w-auto"
              loading={isSubmitting || waitingForMe}
            >
              {PROFILE_COPY.save}
            </Button>
          </div>
        </form>
      </div>
    </AccountCard>
  )
}
