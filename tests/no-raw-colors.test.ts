// @vitest-environment node
// NFR20 / UX-DR1: fails the build when any component or style file outside tokens.css holds a raw colour,
// pure #000/#FFF, a white/black utility, or a font weight above 700.
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { scanDirectory, scanSource } from "./raw-color-scan.ts"

const root = resolve(import.meta.dirname, "..")

describe("no raw colours outside tokens.css", () => {
  it("finds none in src/", () => {
    const violations = scanDirectory(resolve(root, "src"), root)

    expect(violations, JSON.stringify(violations, null, 2)).toEqual([])
  })

  it("catches every kind of raw colour in the failing fixture", () => {
    const file = "tests/fixtures/raw-colors/bad-component.tsx"
    const violations = scanSource(file, readFileSync(resolve(root, file), "utf8"))
    const matches = violations.map((v) => v.match.toLowerCase())

    expect(matches).toEqual(
      expect.arrayContaining(["bg-white", "text-black", "font-extrabold", "#1f2933", "#fff", "rgb(0", "#000"]),
    )
    expect(new Set(violations.map((v) => v.rule))).toEqual(
      new Set(["hex colour", "colour function", "pure white/black utility", "named colour", "weight above 700"]),
    )
    const linesFor = (rule: string) => violations.filter((v) => v.rule === rule).map((v) => v.line)
    // `style={{ color: "white" }}` (line 7) and CSS `color: white;` (line 14).
    expect(linesFor("named colour")).toEqual([7, 14])
    // `font-extrabold` (line 4) and `fontWeight: 800` (line 8).
    expect(linesFor("weight above 700")).toEqual([4, 8])
  })

  it("finds none in index.html", () => {
    const file = "index.html"
    expect(scanSource(file, readFileSync(resolve(root, file), "utf8"))).toEqual([])
  })

  it("does not flag tokens, ids or colour-mix over tokens", () => {
    const ok = scanSource(
      "ok.tsx",
      [
        '<a href="#main" className="bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),var(--foreground)_12%)]" />',
        'const label = { title: "Red alert", tone: "error" }',
        "font-weight: 700;",
      ].join("\n"),
    )

    expect(ok).toEqual([])
  })

  it("allows raw values in tokens.css only", () => {
    const tokens = readFileSync(resolve(root, "src/styles/tokens.css"), "utf8")

    expect(scanSource("src/styles/tokens.css", tokens).length).toBeGreaterThan(0)
    expect(scanDirectory(resolve(root, "src/styles"), root)).toEqual([])
  })
})
