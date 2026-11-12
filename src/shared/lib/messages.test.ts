import { describe, expect, it } from "vitest"

import { noticeFrom } from "./messages"

describe("noticeFrom", () => {
  it.each([null, undefined, "signedOut", {}, { notice: "pwned" }, { notice: 1 }])("ignores %j", (state) => {
    expect(noticeFrom(state)).toBeNull()
  })

  it("keeps a trimmed prefill email on passwordUpdated", () => {
    expect(noticeFrom({ notice: "passwordUpdated", email: "  sara@example.test \n" })).toEqual({
      notice: "passwordUpdated",
      email: "sara@example.test",
    })
  })

  it("keeps a 256-character email", () => {
    const email = `${"a".repeat(243)}@example.test`
    expect(email).toHaveLength(256)
    expect(noticeFrom({ notice: "passwordUpdated", email })).toEqual({ notice: "passwordUpdated", email })
  })

  it.each([
    ["whitespace only", "   "],
    ["257 characters", `${"a".repeat(244)}@example.test`],
    ["not a string", { evil: true }],
  ])("drops a prefill email that is %s", (_case, email) => {
    expect(noticeFrom({ notice: "passwordUpdated", email })).toEqual({ notice: "passwordUpdated" })
  })

  it.each(["signedOut", "sessionEnded", "accountDisabled"])("drops an email on the %s notice", (notice) => {
    expect(noticeFrom({ notice, email: "sara@example.test" })).toEqual({ notice })
  })
})
