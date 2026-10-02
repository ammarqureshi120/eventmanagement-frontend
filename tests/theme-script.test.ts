// UX-DR4 / AD-23: the inline no-flash script in index.html follows the same rules as resolveTheme, survives
// blocked storage or a missing matchMedia. (The served-hash check lives in e2e/login.spec.ts.)
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { cspHash, extractInlineScripts } from "../build/theme-csp-plugin.ts"
import { resolveTheme, type ThemePreference } from "../src/shared/theme/theme-storage.ts"

const root = resolve(import.meta.dirname, "..")
const sourceHtml = readFileSync(resolve(root, "index.html"), "utf8")
const [themeScript, ...otherInlineScripts] = extractInlineScripts(sourceHtml)

function runScript({ stored, osDark, storageThrows = false }: { stored: string | null; osDark: boolean; storageThrows?: boolean }) {
  document.documentElement.className = ""
  vi.stubGlobal("localStorage", {
    getItem: () => {
      if (storageThrows) {
        throw new DOMException("blocked", "SecurityError")
      }
      return stored
    },
  })
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: query === "(prefers-color-scheme: dark)" && osDark })),
  )
  new Function(themeScript)()
  return document.documentElement.classList.contains("dark")
}

describe("inline theme script", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    document.documentElement.className = ""
  })

  it("is the only inline script and sits in <head> before any stylesheet or module script", () => {
    expect(themeScript).toBeTruthy()
    expect(otherInlineScripts).toEqual([])
    const head = sourceHtml.slice(0, sourceHtml.indexOf("</head>"))
    expect(head).toContain(themeScript)
    expect(themeScript).not.toMatch(/\bimport\b|\brequire\(/)
    const scriptAt = sourceHtml.indexOf(themeScript)
    for (const later of ['rel="stylesheet"', 'type="module"']) {
      const at = sourceHtml.indexOf(later)
      expect(at === -1 || at > scriptAt).toBe(true)
    }
  })

  it.each([
    // [stored, osDark, expected dark]
    [null, true, true],
    [null, false, false],
    ["light", true, false],
    ["dark", false, true],
    ["system", true, true],
    ["system", false, false],
    ["blue", true, true],
    ["blue", false, false],
  ] as const)("stored %j with OS dark=%s -> dark=%s (same as resolveTheme)", (stored, osDark, expected) => {
    expect(runScript({ stored, osDark })).toBe(expected)

    const preference: ThemePreference = stored === "light" || stored === "dark" ? stored : "system"
    expect(resolveTheme(preference, osDark) === "dark").toBe(expected)
  })

  it("treats a missing matchMedia as light instead of throwing", () => {
    document.documentElement.className = ""
    vi.stubGlobal("localStorage", { getItem: () => null })
    vi.stubGlobal("matchMedia", undefined)

    expect(() => new Function(themeScript)()).not.toThrow()
    expect(document.documentElement.classList.contains("dark")).toBe(false)
  })

  it("falls back to the system preference when localStorage throws", () => {
    expect(runScript({ stored: "light", osDark: true, storageThrows: true })).toBe(true)
    expect(runScript({ stored: "dark", osDark: false, storageThrows: true })).toBe(false)
  })

  it("hashes like a browser does (SHA-256 of the exact script text, base64)", () => {
    expect(cspHash("alert('Hello, world.');")).toBe("'sha256-qznLcsROx4GACP2dm0UCKCzCG+HiZ1guq6ZZDob/Tng='")
  })
})
