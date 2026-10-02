import { afterEach, describe, expect, it } from "vitest"

import { readCookie } from "./cookies"

const clear = (name: string) => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
}

describe("readCookie", () => {
  afterEach(() => {
    clear("a")
    clear("bad")
  })

  it("returns the decoded value, or null when absent", () => {
    document.cookie = "a=x%20y; path=/"

    expect(readCookie("a")).toBe("x y")
    expect(readCookie("missing")).toBeNull()
  })

  it("returns the raw value when the percent sequence is malformed", () => {
    document.cookie = "bad=%E0%A4%A; path=/"

    expect(readCookie("bad")).toBe("%E0%A4%A")
  })
})
