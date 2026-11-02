import { afterEach, describe, expect, it, vi } from "vitest"

import {
  clearSessionActive,
  closeSessionChannelForTests,
  formatCountdown,
  IDLE_TIMEOUT_MS,
  markSessionActive,
  onSessionMessage,
  postSessionMessage,
  SESSION_ACTIVE_KEY,
  SESSION_CHANNEL_NAME,
  sessionSchedule,
  wasSessionActive,
  WARNING_LEAD_MS,
  type SessionMessage,
} from "./session-timer"

const MIN = 60_000
const T0 = Date.parse("2026-11-02T08:00:00Z")
const iso = (time: number) => new Date(time).toISOString()

describe("sessionSchedule", () => {
  it("is active until 28 idle minutes, with the warning as the next event", () => {
    const schedule = sessionSchedule({ lastActivity: T0, sessionExpiresAt: iso(T0 + 12 * 60 * MIN), now: T0 + 27 * MIN })

    expect(schedule).toEqual({
      phase: "active",
      endsAt: T0 + IDLE_TIMEOUT_MS,
      endReason: "idle",
      nextAt: T0 + IDLE_TIMEOUT_MS - WARNING_LEAD_MS,
      remainingMs: 3 * MIN,
    })
  })

  it("warns (idle) from 28 minutes, counting down to the end", () => {
    const schedule = sessionSchedule({ lastActivity: T0, sessionExpiresAt: iso(T0 + 12 * 60 * MIN), now: T0 + 28 * MIN + 1000 })

    expect(schedule.phase).toBe("warn-idle")
    expect(schedule.remainingMs).toBe(2 * MIN - 1000)
    expect(schedule.nextAt).toBe(T0 + 30 * MIN)
  })

  it("ends at 30 idle minutes", () => {
    expect(sessionSchedule({ lastActivity: T0, sessionExpiresAt: null, now: T0 + 30 * MIN }).phase).toBe("ended")
  })

  it("warns about the 12-hour limit when it comes before the idle end", () => {
    const expiresAt = T0 + 10 * MIN
    const schedule = sessionSchedule({ lastActivity: T0, sessionExpiresAt: iso(expiresAt), now: T0 + 8 * MIN })

    expect(schedule).toMatchObject({ phase: "warn-absolute", endReason: "absolute", endsAt: expiresAt, remainingMs: 2 * MIN })
    expect(sessionSchedule({ lastActivity: T0, sessionExpiresAt: iso(expiresAt), now: T0 + 7 * MIN })).toMatchObject({
      phase: "active",
      nextAt: T0 + 8 * MIN,
    })
    expect(sessionSchedule({ lastActivity: T0 + 9 * MIN, sessionExpiresAt: iso(expiresAt), now: expiresAt }).phase).toBe("ended")
  })

  it("treats a tie as the absolute limit (staying cannot help)", () => {
    const schedule = sessionSchedule({ lastActivity: T0, sessionExpiresAt: iso(T0 + 30 * MIN), now: T0 + 29 * MIN })
    expect(schedule.phase).toBe("warn-absolute")
  })

  it("ignores a missing or unparsable expiry (idle only)", () => {
    for (const sessionExpiresAt of [undefined, null, "", "not a date"]) {
      expect(sessionSchedule({ lastActivity: T0, sessionExpiresAt, now: T0 }).endReason).toBe("idle")
    }
  })
})

describe("formatCountdown", () => {
  it.each([
    [2 * MIN, "2:00"],
    [2 * MIN - 1, "2:00"],
    [MIN + 5000, "1:05"],
    [59_001, "1:00"],
    [1000, "0:01"],
    [1, "0:01"],
    [0, "0:00"],
    [-50, "0:00"],
  ])("%d ms → %s", (ms, text) => {
    expect(formatCountdown(ms)).toBe(text)
  })
})

describe("session channel", () => {
  afterEach(() => {
    closeSessionChannelForTests()
  })

  it("delivers messages between tabs, not back to the sender, and drops malformed ones", async () => {
    const received: SessionMessage[] = []
    const unsubscribe = onSessionMessage((message) => received.push(message))
    const other = new BroadcastChannel(SESSION_CHANNEL_NAME)
    const otherReceived: unknown[] = []
    other.onmessage = (event: MessageEvent) => otherReceived.push(event.data)
    try {
      other.postMessage({ type: "bogus" })
      other.postMessage({ type: "activity", at: "soon" })
      other.postMessage({ type: "ended", reason: "because" })
      other.postMessage({ type: "activity", at: 5 })
      other.postMessage({ type: "ended", reason: "accountDisabled" })
      postSessionMessage({ type: "signedOut" })

      await vi.waitFor(() => expect(otherReceived).toEqual([{ type: "signedOut" }]))
      await vi.waitFor(() =>
        expect(received).toEqual([
          { type: "activity", at: 5 },
          { type: "ended", reason: "accountDisabled" },
        ]),
      )
    } finally {
      unsubscribe()
      other.close()
    }
  })
})

describe("'was signed in here' flag", () => {
  afterEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("is set, read and cleared in localStorage", () => {
    expect(wasSessionActive()).toBe(false)
    markSessionActive()
    expect(localStorage.getItem(SESSION_ACTIVE_KEY)).toBe("1")
    expect(wasSessionActive()).toBe(true)
    clearSessionActive()
    expect(wasSessionActive()).toBe(false)
  })

  it("never throws when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked")
    })
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("blocked")
    })

    expect(() => markSessionActive()).not.toThrow()
    expect(() => clearSessionActive()).not.toThrow()
    expect(wasSessionActive()).toBe(false)
  })
})
