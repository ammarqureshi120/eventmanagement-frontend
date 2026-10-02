import { describe, expect, it } from "vitest"

import { formatInZone } from "./datetime"

describe("formatInZone", () => {
  const instant = "2027-03-15T04:00:00.000Z"

  it("runs the suite in UTC", () => {
    expect(new Date(instant).getHours()).toBe(4)
  })

  it("formats a UTC instant in UTC", () => {
    expect(formatInZone(instant, "UTC")).toBe("15 Mar 2027, 04:00")
  })

  it("formats a UTC instant in Asia/Karachi (UTC+5)", () => {
    expect(formatInZone(instant, "Asia/Karachi")).toBe("15 Mar 2027, 09:00")
  })
})
