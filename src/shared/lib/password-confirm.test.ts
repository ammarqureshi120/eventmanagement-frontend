import { act, renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { confirmProblem, isConfirmReady, PASSWORD_MISMATCH, useLiveConfirm } from "./password-confirm"

describe("password confirm", () => {
  it("reports a mismatch with the UX-DR25 copy; passwords are compared as typed", () => {
    expect(confirmProblem("Abcdefg1", "Abcdefg1")).toBeUndefined()
    expect(confirmProblem("Abcdefg1", "Abcdefg1 ")).toBe(PASSWORD_MISMATCH)
    expect(PASSWORD_MISMATCH).toBe("This doesn't match the password above. Type it again.")
  })

  it("is ready once Confirm is as long as the password (code points)", () => {
    expect(isConfirmReady("abcd", "")).toBe(false)
    expect(isConfirmReady("abcd", "abc")).toBe(false)
    expect(isConfirmReady("abcd", "abcx")).toBe(true)
    expect(isConfirmReady("a😀", "ab")).toBe(true)
  })

  it("stays quiet until ready, then validates on every change, until stopped", () => {
    const validate = vi.fn()
    const { result, rerender } = renderHook(({ password, confirm }) => useLiveConfirm(password, confirm, validate), {
      initialProps: { password: "abcd", confirm: "ab" },
    })
    expect(validate).not.toHaveBeenCalled()

    rerender({ password: "abcd", confirm: "abcx" })
    expect(validate).toHaveBeenCalledTimes(1)
    rerender({ password: "abcd", confirm: "a" })
    expect(validate).toHaveBeenCalledTimes(2)

    act(() => result.current.stop())
    rerender({ password: "", confirm: "" })
    expect(result.current.live).toBe(false)
    expect(validate).toHaveBeenCalledTimes(2)
  })
})
