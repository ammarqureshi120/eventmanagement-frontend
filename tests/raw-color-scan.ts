// NFR20 / UX-DR1: components use tokens only. Raw colours live in src/styles/tokens.css and nowhere else.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"

export interface RawColorViolation {
  file: string
  line: number
  rule: string
  match: string
}

const NAMED_COLOURS = [
  "white", "black", "red", "blue", "green", "gray", "grey", "yellow", "orange", "purple", "pink", "brown",
  "silver", "navy", "teal", "maroon", "olive", "lime", "aqua", "fuchsia", "cyan", "magenta", "gold", "indigo",
  "violet",
]

/** Each rule names what it catches; all are case-insensitive. */
export const RAW_COLOR_RULES: ReadonlyArray<{ rule: string; pattern: RegExp }> = [
  // #RGB, #RGBA, #RRGGBB, #RRGGBBAA not followed by more word characters (so `#main` and ids pass).
  { rule: "hex colour", pattern: /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/gi },
  { rule: "colour function", pattern: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[\d.]/gi },
  { rule: "pure white/black utility", pattern: /\b(?:bg|text|border|ring|fill|stroke|outline|from|to|via|shadow|decoration|divide|accent|caret)-(?:white|black)\b/gi },
  // CSS `color: white;` and JSX `color: "white"` / `background: 'red'` (common named colours as a whole value).
  {
    rule: "named colour",
    pattern: new RegExp(String.raw`:\s*["']?(?:${NAMED_COLOURS.join("|")})["']?\s*(?=[;,})]|$)`, "gim"),
  },
  { rule: "weight above 700", pattern: /\bfont-(?:extrabold|black)\b|\bfont-\[(?:8|9)00\]|font-?weight:\s*["']?[89]00\b/gi },
]

const SCANNED_EXTENSIONS = /\.(?:tsx?|css|html)$/
const ALLOWED_FILES = new Set(["src/styles/tokens.css"])
const SKIPPED_DIRS = new Set(["api/generated"])

function toPosix(path: string) {
  return path.split(sep).join("/")
}

export function scanSource(file: string, source: string): RawColorViolation[] {
  const violations: RawColorViolation[] = []
  const lines = source.split(/\r?\n/)
  lines.forEach((text, index) => {
    for (const { rule, pattern } of RAW_COLOR_RULES) {
      for (const match of text.matchAll(pattern)) {
        violations.push({ file, line: index + 1, rule, match: match[0] })
      }
    }
  })
  return violations
}

function walk(dir: string, root: string, out: string[]) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = toPosix(relative(root, full))
    if (statSync(full).isDirectory()) {
      if (![...SKIPPED_DIRS].some((skip) => rel.endsWith(skip))) {
        walk(full, root, out)
      }
    } else if (SCANNED_EXTENSIONS.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
}

/** Scans every component/style file under `dir` (relative paths reported from `root`). */
export function scanDirectory(dir: string, root: string): RawColorViolation[] {
  const files: string[] = []
  walk(dir, root, files)
  return files
    .map((file) => ({ file: toPosix(relative(root, file)), source: readFileSync(file, "utf8") }))
    .filter(({ file }) => !ALLOWED_FILES.has(file))
    .flatMap(({ file, source }) => scanSource(file, source))
}
