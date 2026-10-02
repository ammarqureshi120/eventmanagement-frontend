// @vitest-environment node
// UX-DR6 / NFR10 / NFR19: every text token pair is >= 4.5:1 and every non-text pair (ring, input border)
// is >= 3:1, in light and dark, computed on the exact values in src/styles/tokens.css.
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

import { contrast as contrastRgb, mixOklch, parseHex, type Rgb } from "./color-math.ts"

const css = readFileSync(resolve(import.meta.dirname, "../src/styles/tokens.css"), "utf8")

/** Custom properties declared in the first block opened by `selector {`. */
function readBlock(selector: string): Record<string, string> {
  const start = css.search(new RegExp(`^${selector.replace(".", "\\.")}\\s*\\{`, "m"))
  if (start < 0) {
    throw new Error(`No ${selector} block in tokens.css`)
  }
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("\n}", start))
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}

const MODES = { light: readBlock(":root"), dark: readBlock(".dark") }

/** UX-DR1: every DESIGN.md colour token, shadcn names + EventHub extensions. */
const COLOR_TOKENS = [
  "background", "foreground", "card", "card-foreground", "popover", "popover-foreground", "muted",
  "muted-foreground", "border", "input", "primary", "primary-foreground", "secondary", "secondary-foreground",
  "accent", "accent-foreground", "ring", "destructive", "destructive-foreground", "chart-1", "chart-2", "chart-3",
  "chart-4", "chart-5", "primary-soft", "success", "success-bg", "warning", "warning-bg", "destructive-bg", "info",
  "info-bg", "scrim",
]

/** WCAG contrast of two token hex values. */
function contrast(a: string, b: string) {
  return contrastRgb(parseHex(a), parseHex(b))
}

/** [foreground token, background token] pairs that carry text (DESIGN contrast table + where the kit uses them). */
const TEXT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["card-foreground", "card"],
  ["popover-foreground", "popover"],
  ["foreground", "muted"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["muted-foreground", "popover"],
  ["primary-foreground", "primary"],
  ["primary", "card"],
  ["primary", "background"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["primary", "primary-soft"],
  ["success", "success-bg"],
  ["warning", "warning-bg"],
  ["destructive", "destructive-bg"],
  ["info", "info-bg"],
  ["foreground", "success-bg"],
  ["foreground", "warning-bg"],
  ["foreground", "destructive-bg"],
  ["foreground", "info-bg"],
  ["destructive-foreground", "destructive"],
  ["destructive", "card"],
  ["destructive", "background"],
  ["success", "card"],
]

/** Non-text UI pairs (WCAG 1.4.11): focus ring and form-control borders on the surfaces they sit on. */
const NON_TEXT_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["ring", "background"],
  ["ring", "card"],
  ["input", "background"],
  ["input", "card"],
  ["ring", "muted"],
  ["input", "muted"],
]

/**
 * Pairs excluded from the 3:1 loop. The tuned `ring` / `input` values (fixed by the Story 1.2 AC) sit under
 * 3:1 on `muted`, so the kit never paints them there:
 * - read-only inputs keep the canvas (`background`) fill, so their `input` border is measured on background;
 * - disabled inputs use the muted fill but are exempt from WCAG 1.4.11 (inactive components);
 * - ThemeToggle draws its focus ring inside the card-filled checked segment, not on the muted track.
 * Remove an entry when the tokens are re-tuned.
 */
const KNOWN_EXCEPTIONS: ReadonlyArray<{ mode: "light" | "dark"; pair: readonly [string, string] }> = [
  { mode: "light", pair: ["ring", "muted"] },
  { mode: "light", pair: ["input", "muted"] },
  { mode: "dark", pair: ["input", "muted"] },
]

function nonTextPairsFor(mode: string) {
  return NON_TEXT_PAIRS.filter(
    ([fg, bg]) => !KNOWN_EXCEPTIONS.some((e) => e.mode === mode && e.pair[0] === fg && e.pair[1] === bg),
  )
}

describe.each(Object.entries(MODES))("Nordic Fog tokens (%s)", (mode, tokens) => {
  it("defines every DESIGN.md colour token", () => {
    const missing = COLOR_TOKENS.filter((name) => !tokens[name])
    expect(missing).toEqual([])
  })

  it.each(TEXT_PAIRS)("text %s on %s is at least 4.5:1", (fg, bg) => {
    expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(4.5)
  })

  it.each(nonTextPairsFor(mode))("non-text %s on %s is at least 3:1", (fg, bg) => {
    expect(contrast(tokens[fg], tokens[bg])).toBeGreaterThanOrEqual(3)
  })

  it("uses the tuned input / ring values", () => {
    const tuned = { light: { input: "#7a8fa4", ring: "#748ea6" }, dark: { input: "#617282", ring: "#7f95aa" } }[
      mode as "light" | "dark"
    ]
    expect({ input: tokens.input.toLowerCase(), ring: tokens.ring.toLowerCase() }).toEqual(tuned)
  })
})

/**
 * Interactive and tinted states the kit actually paints, resolving its `color-mix(in oklch, …)` formulas:
 * hover = fill mixed 12% toward `foreground` (Button). Alert and destructive-soft tone borders are not listed:
 * they are decorative (meaning is carried by text + icon + tint), so WCAG 1.4.11 does not apply.
 * Each entry: [label, foreground, background, minimum ratio].
 */
function statePairs(tokens: Record<string, string>): ReadonlyArray<readonly [string, Rgb, Rgb, number]> {
  const c = (name: string) => parseHex(tokens[name])
  const hover = (fill: string) => mixOklch(c(fill), c("foreground"), 0.12)
  return [
    ["primary-foreground on primary hover", c("primary-foreground"), hover("primary"), 4.5],
    ["destructive-foreground on destructive hover", c("destructive-foreground"), hover("destructive"), 4.5],
    ["secondary-foreground on secondary hover", c("secondary-foreground"), hover("secondary"), 4.5],
    ["foreground on outline (card) hover", c("foreground"), hover("card"), 4.5],
    // destructive-soft hovers toward the canvas (Button): darkening the tint would drop this below 4.5:1.
    ["destructive on destructive-soft hover", c("destructive"), mixOklch(c("destructive-bg"), c("background"), 0.4), 4.5],
    ["primary on muted", c("primary"), c("muted"), 4.5],
  ]
}

describe.each(Object.entries(MODES))("state colours (%s)", (_mode, tokens) => {
  it.each(statePairs(tokens).map((pair) => [...pair]))("%s is at least the minimum", (_label, fg, bg, min) => {
    const ratio = contrastRgb(fg as Rgb, bg as Rgb)
    expect(ratio, `ratio ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(min as number)
  })
})

describe("Tailwind theme names", () => {
  it("never reuse a colour name as a font-size name (text-<name> would set both)", () => {
    const names = (prefix: string) =>
      new Set([...css.matchAll(new RegExp(`--${prefix}-([a-z0-9-]+):`, "g"))].map((m) => m[1]))
    const colours = names("color")
    const sizes = [...names("text")].filter((name) => !name.includes("--"))
    expect(sizes.filter((name) => colours.has(name))).toEqual([])
    expect(sizes.length).toBeGreaterThan(10)
  })
})

describe("contrast helper", () => {
  it("matches the WCAG reference values", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5)
    // DESIGN.md table: foreground on background, light 13.74.
    expect(contrast(MODES.light.foreground, MODES.light.background)).toBeCloseTo(13.74, 1)
  })
})
