import { describe, expect, it } from "vitest"

import { loginPathFor, safeReturnTo } from "./return-to"

describe("safeReturnTo", () => {
  it.each([
    ["/platform", "/platform"],
    ["/platform?tab=a&b=2", "/platform?tab=a&b=2"],
    ["/events/1#top", "/events/1#top"],
    ["/", "/"],
  ])("keeps the same-origin relative path %s", (value, expected) => {
    expect(safeReturnTo(value)).toBe(expected)
  })

  it.each([
    "//evil.com",
    "//evil.com/platform",
    "https://x",
    "http://localhost/platform",
    "javascript:alert(1)",
    "/\\evil.com",
    "/\\x",
    "\\evil.com",
    "/login",
    "/login?returnTo=/platform",
    "/login/",
    "/LOGIN",
    "/Login?returnTo=/platform",
    "/%6Cogin",
    "/%4C%4FGIN/",
    "/%E0%A4%A",
    "platform",
    "",
    "/plat\nform",
    "/\tevil.com",
    "%2F%2Fevil.com",
    null,
    undefined,
  ])("ignores %j", (value) => {
    expect(safeReturnTo(value)).toBeNull()
  })
})

describe("loginPathFor", () => {
  it("encodes the protected path and search as returnTo", () => {
    expect(loginPathFor({ pathname: "/platform", search: "?a=1&b=2" })).toBe("/login?returnTo=%2Fplatform%3Fa%3D1%26b%3D2")
  })

  it("leaves returnTo out for the root and for unsafe paths", () => {
    expect(loginPathFor({ pathname: "/", search: "" })).toBe("/login")
    expect(loginPathFor({ pathname: "//evil.com" })).toBe("/login")
  })
})
