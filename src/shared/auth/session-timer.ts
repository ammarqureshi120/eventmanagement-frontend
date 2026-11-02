/**
 * Story 1.5 safe sessions, client side (AD-16): the server ends a session after 30 idle minutes or 12
 * hours from sign-in. The SPA mirrors those windows so it can warn 2 minutes before the end and leave
 * calmly when it comes. Activity means an API response only (see `shared/api/activity`).
 *
 * This module holds the pure scheduler, the cross-tab channel and the "was signed in here" flag. It never
 * calls the API and has no timers of its own.
 */

/** Sliding idle window, renewed by every authenticated request (AD-16). */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000

/** The warning shows this long before the session ends. */
export const WARNING_LEAD_MS = 2 * 60 * 1000

export type SessionPhase =
  /** Nothing to show; `nextAt` is when the warning is due. */
  | "active"
  /** The idle window ends first: "Still there?" with "Stay signed in". */
  | "warn-idle"
  /** The 12-hour limit ends first: only "OK"; activity cannot extend it. */
  | "warn-absolute"
  /** The window has ended. */
  | "ended"

export interface SessionSchedule {
  phase: SessionPhase
  /** When the session ends (the earlier of the idle and absolute ends), epoch ms. */
  endsAt: number
  /** Which window ends first. */
  endReason: "idle" | "absolute"
  /** When the phase next changes, epoch ms (`endsAt` while warning; the warning time while active). */
  nextAt: number
  /** Time left until `endsAt`, never negative. */
  remainingMs: number
}

export interface ScheduleInput {
  /** Last API response seen by this tab or reported by another, epoch ms. */
  lastActivity: number
  /** `sessionExpiresAt` from `GET /api/me` (ISO 8601), or nothing when unknown. */
  sessionExpiresAt?: string | null
  now: number
}

function parseInstant(value: string | null | undefined): number {
  if (!value) {
    return Number.POSITIVE_INFINITY
  }
  const time = Date.parse(value)
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
}

/**
 * Given the last activity, the absolute expiry and now, returns the current phase, the end time and when
 * the phase next changes. When both windows end together the absolute one wins: staying cannot help.
 */
export function sessionSchedule({ lastActivity, sessionExpiresAt, now }: ScheduleInput): SessionSchedule {
  const idleEnd = lastActivity + IDLE_TIMEOUT_MS
  const absoluteEnd = parseInstant(sessionExpiresAt)
  const endReason = absoluteEnd <= idleEnd ? "absolute" : "idle"
  const endsAt = Math.min(idleEnd, absoluteEnd)
  const warnAt = endsAt - WARNING_LEAD_MS
  const remainingMs = Math.max(0, endsAt - now)

  if (now >= endsAt) {
    return { phase: "ended", endsAt, endReason, nextAt: endsAt, remainingMs }
  }
  if (now >= warnAt) {
    return { phase: endReason === "absolute" ? "warn-absolute" : "warn-idle", endsAt, endReason, nextAt: endsAt, remainingMs }
  }
  return { phase: "active", endsAt, endReason, nextAt: warnAt, remainingMs }
}

/** `m:ss` for the countdown, rounding up so it reads 0:01 until the very end. */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

// ---------------------------------------------------------------------------------------------------
// Cross-tab sync
// ---------------------------------------------------------------------------------------------------

export const SESSION_CHANNEL_NAME = "eventhub-session"

/** Why every tab leaves: the session ended, or the account was disabled. */
export type SessionEndReason = "sessionEnded" | "accountDisabled"

export type SessionMessage =
  /** This tab got an API response at `at`. */
  | { type: "activity"; at: number }
  /** The session is over: every tab goes to `/login` with the matching notice. */
  | { type: "ended"; reason: SessionEndReason }
  /** The user signed out in another tab. */
  | { type: "signedOut" }

function isSessionMessage(value: unknown): value is SessionMessage {
  if (typeof value !== "object" || value === null) {
    return false
  }
  const message = value as { type?: unknown; at?: unknown; reason?: unknown }
  switch (message.type) {
    case "activity":
      return typeof message.at === "number" && Number.isFinite(message.at)
    case "ended":
      return message.reason === "sessionEnded" || message.reason === "accountDisabled"
    case "signedOut":
      return true
    default:
      return false
  }
}

type SessionMessageListener = (message: SessionMessage) => void

/**
 * One channel per tab, used for both sending and receiving: a `BroadcastChannel` never delivers a message
 * to the object that posted it, so a tab never reacts to its own broadcasts. Without `BroadcastChannel`
 * (very old browsers) cross-tab sync is simply off.
 */
let channel: BroadcastChannel | null | undefined
const messageListeners = new Set<SessionMessageListener>()

function sessionChannel(): BroadcastChannel | null {
  if (channel !== undefined) {
    return channel
  }
  if (typeof BroadcastChannel !== "function") {
    channel = null
    return channel
  }
  try {
    channel = new BroadcastChannel(SESSION_CHANNEL_NAME)
  } catch {
    channel = null
    return channel
  }
  channel.addEventListener("message", (event: MessageEvent) => {
    if (!isSessionMessage(event.data)) {
      return
    }
    for (const listener of [...messageListeners]) {
      listener(event.data)
    }
  })
  // Node (Vitest) keeps the process alive for an open channel; browsers have no `unref`.
  ;(channel as { unref?: () => void }).unref?.()
  return channel
}

/** Tells the other tabs. Best effort: a closed or missing channel drops the message. */
export function postSessionMessage(message: SessionMessage): void {
  try {
    sessionChannel()?.postMessage(message)
  } catch {
    // Nothing to do: the other tabs fall back to their own timers and the server's 401s.
  }
}

/** Listens to the other tabs. Returns the unsubscribe function. */
export function onSessionMessage(listener: SessionMessageListener): () => void {
  sessionChannel()
  messageListeners.add(listener)
  return () => {
    messageListeners.delete(listener)
  }
}

/** Test helper: closes this tab's channel so the next call opens a fresh one. */
export function closeSessionChannelForTests(): void {
  channel?.close()
  channel = undefined
  messageListeners.clear()
}

// ---------------------------------------------------------------------------------------------------
// "Was signed in here" flag
// ---------------------------------------------------------------------------------------------------

/**
 * The server answers `session_expired` for any missing cookie, so a first visit and an expired session
 * look the same. This flag (no secret, just "1") tells them apart: set on a successful `GET /api/me`,
 * cleared on sign-out or when the session ends. Storage that throws (private mode) means no notice.
 */
export const SESSION_ACTIVE_KEY = "eventhub.session.active"

export function markSessionActive(): void {
  try {
    localStorage.setItem(SESSION_ACTIVE_KEY, "1")
  } catch {
    // Storage blocked: a later expiry just shows no notice.
  }
}

export function clearSessionActive(): void {
  try {
    localStorage.removeItem(SESSION_ACTIVE_KEY)
  } catch {
    // Storage blocked: nothing was stored either.
  }
}

export function wasSessionActive(): boolean {
  try {
    return localStorage.getItem(SESSION_ACTIVE_KEY) === "1"
  } catch {
    return false
  }
}
