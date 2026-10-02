import { afterEach, describe, expect, it, vi } from "vitest"

import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  THEME_STORAGE_KEY,
  writeThemePreference,
} from "./theme-storage"

function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  )
}

describe("theme-storage", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    document.documentElement.classList.remove("dark")
  })

  it.each([
    [null, "system"],
    ["light", "light"],
    ["dark", "dark"],
    ["system", "system"],
    ["blue", "system"],
    ["", "system"],
  ])("reads stored %j as %s", (stored, expected) => {
    if (stored !== null) {
      localStorage.setItem(THEME_STORAGE_KEY, stored)
    }
    expect(readThemePreference()).toBe(expected)
  })

  it("falls back to system when storage throws, and reports a failed write", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError")
    })
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError")
    })

    expect(readThemePreference()).toBe("system")
    expect(writeThemePreference("dark")).toBe(false)
  })

  it("persists under the eventhub-theme key", () => {
    expect(writeThemePreference("dark")).toBe(true)
    expect(localStorage.getItem("eventhub-theme")).toBe("dark")
  })

  it("resolves system from prefers-color-scheme", () => {
    stubMatchMedia(true)
    expect(resolveTheme("system")).toBe("dark")
    stubMatchMedia(false)
    expect(resolveTheme("system")).toBe("light")
    expect(resolveTheme("dark", false)).toBe("dark")
    expect(resolveTheme("light", true)).toBe("light")
  })

  it("treats a missing matchMedia as light", () => {
    vi.stubGlobal("matchMedia", undefined)
    expect(resolveTheme("system")).toBe("light")
  })

  it("toggles the dark class on <html>", () => {
    applyTheme("dark")
    expect(document.documentElement).toHaveClass("dark")
    applyTheme("light")
    expect(document.documentElement).not.toHaveClass("dark")
  })
})
