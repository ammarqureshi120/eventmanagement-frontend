import { describe, expect, it } from "vitest"

import { changePasswordSchema, isValidPhone, phoneProblem, profileSchema } from "./schemas"

const messagesOf = (result: { success: boolean; error?: { issues: Array<{ path: PropertyKey[]; message: string }> } }) =>
  Object.fromEntries((result.error?.issues ?? []).map((issue) => [issue.path.join("."), issue.message]))

describe("account schemas (mirror of the 1.7a validators)", () => {
  it("trims names and turns a blank phone into null", () => {
    expect(profileSchema.parse({ firstName: "  Sara ", lastName: "Admin", phone: "   " })).toEqual({
      firstName: "Sara",
      lastName: "Admin",
      phone: null,
    })
    expect(profileSchema.parse({ firstName: "Sara", lastName: "Admin", phone: " +92 (300) 123-4567 " }).phone).toBe(
      "+92 (300) 123-4567",
    )
  })

  it("requires names of at most 100 characters", () => {
    expect(messagesOf(profileSchema.safeParse({ firstName: "  ", lastName: "x".repeat(101), phone: "" }))).toEqual({
      firstName: "Enter your first name.",
      lastName: "Use 100 characters or fewer.",
    })
    expect(profileSchema.safeParse({ firstName: "x".repeat(100), lastName: "y", phone: "" }).success).toBe(true)
  })

  it("checks the phone like User.IsValidPhone: ASCII digits, spaces and + ( ) - . with a digit, at most 32", () => {
    expect(isValidPhone("+1 (555) 010-0000.1")).toBe(true)
    expect(isValidPhone("12ab")).toBe(false)
    expect(isValidPhone("+()-. ")).toBe(false)
    expect(isValidPhone("١٢٣")).toBe(false)
    expect(phoneProblem("12ab")).toBe("Enter a phone number with digits, spaces and + ( ) - . only.")
    expect(phoneProblem("1".repeat(33))).toBe("Use 32 characters or fewer.")
    expect(phoneProblem(` ${"1".repeat(32)} `)).toBeUndefined()
    expect(phoneProblem("")).toBeUndefined()
  })

  it("change password: current required (not trimmed), the policy on the new one, and Confirm must match", () => {
    expect(
      messagesOf(changePasswordSchema.safeParse({ currentPassword: "  ", newPassword: "abc", confirmPassword: "abd" })),
    ).toEqual({
      currentPassword: "Enter your current password.",
      newPassword: "Use at least 8 characters.",
      confirmPassword: "This doesn't match the password above. Type it again.",
    })
    expect(
      changePasswordSchema.parse({ currentPassword: " old ", newPassword: "Fresh-passw0rd", confirmPassword: "Fresh-passw0rd" }),
    ).toEqual({ currentPassword: " old ", newPassword: "Fresh-passw0rd", confirmPassword: "Fresh-passw0rd" })
  })
})
