// @vitest-environment node
// `cn` must know every Nordic Fog font-size token, or `text-<size>` next to a text colour gets merged away.
// (Lives in tests/ because it reads tokens.css from disk: Vitest serves CSS imports, even `?raw`, as empty.)
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { cn } from "../src/shared/lib/utils.ts"

/** Every `--text-<name>` font-size token in tokens.css (sub-properties like `--text-body--line-height` excluded). */
const tokens = readFileSync(resolve(import.meta.dirname, "../src/styles/tokens.css"), "utf8")
const fontSizeNames = [...new Set([...tokens.matchAll(/--text-([a-z0-9-]+):/g)].map((m) => m[1]))].filter(
  (name) => !name.includes("--"),
)

describe("cn font-size tokens", () => {
  it("finds the type scale in tokens.css", () => {
    expect(fontSizeNames).toEqual(expect.arrayContaining(["body", "button", "control", "display", "label"]))
  })

  it.each(fontSizeNames)("keeps text-%s next to a text colour (registered as a font size)", (name) => {
    expect(cn(`text-${name}`, "text-foreground").split(" ")).toEqual([`text-${name}`, "text-foreground"])
  })

  it("still merges real conflicts", () => {
    expect(cn("text-body", "text-label")).toBe("text-label")
    expect(cn("text-primary", "text-foreground")).toBe("text-foreground")
  })
})
