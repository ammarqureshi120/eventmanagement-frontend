import { useCallback, useEffect, useEffectEvent, useId, useRef, useState } from "react"
import { useLocation, useNavigate } from "react-router"

import type { MeResponse } from "@/api/generated/me"
import { useSignOut } from "@/features/auth"
import { onSessionActivity } from "@/shared/api/activity"
import { useMe } from "@/shared/auth"
import {
  clearSessionActive,
  formatCountdown,
  onSessionMessage,
  postSessionMessage,
  sessionSchedule,
  type SessionEndReason,
} from "@/shared/auth/session-timer"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog"
import { Button } from "@/shared/ui/button"

import { sessionEndTarget } from "./end-session"

/** Copy: epics Story 1.5, EXPERIENCE State Patterns "Idle warning". */
export const IDLE_WARNING_COPY = {
  title: "Still there?",
  idle: "You'll be signed out in 2 minutes to keep your account safe.",
  absolute: "Your session reaches its 12-hour limit in 2 minutes. Save your work, then sign in again.",
  timeLeft: "Time left",
  signOut: "Sign out",
  stay: "Stay signed in",
  ok: "OK",
} as const

/** `setTimeout` caps at ~24.8 days; the 12-hour window never needs more, but stay safe. */
const MAX_TIMER_MS = 2 ** 31 - 1

/**
 * The last activity per session (keyed by `sessionExpiresAt`, fixed for a sign-in), so a remount of the
 * shell (Not found ↔ a protected page) keeps the window instead of starting it again. A new sign-in has a
 * new expiry and starts fresh.
 */
let remembered: { sessionExpiresAt: string; lastActivity: number } | null = null

/** Test helper: forget the remembered window. */
export function resetIdleWarningForTests(): void {
  remembered = null
}

function initialActivity(sessionExpiresAt: string): number {
  return remembered?.sessionExpiresAt === sessionExpiresAt ? remembered.lastActivity : Date.now()
}

/**
 * Story 1.5 idle warning and local session end, mounted once in the app shell (signed-in only).
 *
 * - Activity is an API response only: this tab's own (base query) and the other tabs' (`activity` on the
 *   session channel). Nothing here calls the API except "Stay signed in" (`GET /api/me`).
 * - 2 minutes before the end: `alertdialog` "Still there?" with a m:ss countdown, "Sign out" and the
 *   focused "Stay signed in" (Esc means stay; a scrim click does nothing). When the 12-hour limit comes
 *   first it says so and offers only "OK", which just closes it.
 * - When the window ends: every tab goes to `/login` (`returnTo` kept) with the session-ended notice;
 *   no request is made, since one could renew a session the client believes has ended.
 * - `ended` and `signedOut` from another tab send this tab to `/login` with the matching notice.
 */
export function IdleWarning({ me }: { me: MeResponse }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { refetch } = useMe()
  const { signOut, pending: signingOut } = useSignOut()
  const sessionExpiresAt = me.sessionExpiresAt

  const [lastActivity, setLastActivity] = useState(() => initialActivity(sessionExpiresAt))
  const [now, setNow] = useState(() => Date.now())
  /** `endsAt` of the 12-hour warning the user acknowledged with "OK". */
  const [acknowledgedEnd, setAcknowledgedEnd] = useState<number | null>(null)
  const leftRef = useRef(false)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const stayRef = useRef<HTMLButtonElement>(null)
  const okRef = useRef<HTMLButtonElement>(null)

  const descriptionId = useId()
  const countdownId = useId()
  const schedule = sessionSchedule({ lastActivity, sessionExpiresAt, now })

  useEffect(() => {
    remembered = { sessionExpiresAt, lastActivity }
  }, [sessionExpiresAt, lastActivity])

  const recordActivity = useCallback((at: number) => {
    setLastActivity((previous) => Math.max(previous, at))
    setNow(Date.now())
  }, [])

  const leave = useEffectEvent((reason: SessionEndReason | "signedOut", broadcast: boolean) => {
    if (leftRef.current) {
      return
    }
    leftRef.current = true
    remembered = null
    clearSessionActive()
    if (reason === "signedOut") {
      void navigate("/login", { replace: true, state: { notice: "signedOut" } })
      return
    }
    if (broadcast) {
      postSessionMessage({ type: "ended", reason })
    }
    const target = sessionEndTarget(reason, location)
    void navigate(target.to, { replace: true, state: target.state })
  })

  // This tab's API responses renew the window here and in every other tab.
  useEffect(
    () =>
      onSessionActivity((at) => {
        recordActivity(at)
        postSessionMessage({ type: "activity", at })
      }),
    [recordActivity],
  )

  // The other tabs.
  useEffect(
    () =>
      onSessionMessage((message) => {
        switch (message.type) {
          case "activity":
            recordActivity(message.at)
            return
          case "ended":
            leave(message.reason, false)
            return
          case "signedOut":
            leave("signedOut", false)
            return
        }
      }),
    [recordActivity],
  )

  // One timer to the next phase change; once a second while the countdown shows. Background tabs may
  // fire late, so coming back to the tab re-checks at once.
  useEffect(() => {
    if (schedule.phase === "ended") {
      return
    }
    const delay =
      schedule.phase === "active" ? schedule.nextAt - Date.now() : schedule.remainingMs % 1000 || 1000
    const id = setTimeout(() => setNow(Date.now()), Math.min(Math.max(0, delay), MAX_TIMER_MS))
    return () => clearTimeout(id)
  }, [schedule.phase, schedule.nextAt, schedule.remainingMs])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        setNow(Date.now())
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])

  useEffect(() => {
    if (schedule.phase === "ended") {
      leave("sessionEnded", true)
    }
  }, [schedule.phase])

  const absolute = schedule.phase === "warn-absolute"
  const open = schedule.phase === "warn-idle" || (absolute && acknowledgedEnd !== schedule.endsAt)

  const stay = () => {
    if (signingOut) {
      return
    }
    // Only the request. Its response renews the window and closes the warning here and in every tab
    // (activity path); a 401 takes the normal path (RequireAuth → session-ended notice); a network
    // failure keeps the warning open and shows the offline toast.
    refetch()
  }

  const acknowledge = () => setAcknowledgedEnd(schedule.endsAt)

  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        data-slot="idle-warning"
        // Read the countdown with the message when the warning opens.
        aria-describedby={`${descriptionId} ${countdownId}`}
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
          ;(absolute ? okRef : stayRef).current?.focus()
        }}
        onCloseAutoFocus={(event) => {
          // There is no trigger: give focus back to where it was when the warning opened.
          event.preventDefault()
          const previous = returnFocusRef.current
          returnFocusRef.current = null
          if (previous?.isConnected) {
            previous.focus()
          }
        }}
        onEscapeKeyDown={(event) => {
          // Esc means "Stay signed in" (or "OK" for the 12-hour notice), never a silent dismiss.
          event.preventDefault()
          if (absolute) {
            acknowledge()
          } else {
            stay()
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>{IDLE_WARNING_COPY.title}</AlertDialogTitle>
          <AlertDialogDescription id={descriptionId}>{absolute ? IDLE_WARNING_COPY.absolute : IDLE_WARNING_COPY.idle}</AlertDialogDescription>
        </AlertDialogHeader>

        <p id={countdownId} className="flex items-baseline gap-2 text-body-sm text-muted-foreground">
          {IDLE_WARNING_COPY.timeLeft}
          <span role="timer" className="font-heading text-headline font-bold text-foreground tabular-nums">
            {formatCountdown(schedule.remainingMs)}
          </span>
        </p>

        <AlertDialogFooter>
          {absolute ? (
            <Button ref={okRef} onClick={acknowledge}>
              {IDLE_WARNING_COPY.ok}
            </Button>
          ) : (
            <>
              <Button variant="outline" loading={signingOut} onClick={() => void signOut()}>
                {IDLE_WARNING_COPY.signOut}
              </Button>
              <Button ref={stayRef} onClick={stay} aria-disabled={signingOut || undefined}>
                {IDLE_WARNING_COPY.stay}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
