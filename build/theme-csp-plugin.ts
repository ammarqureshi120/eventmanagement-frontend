import { createHash } from "node:crypto"
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"

import type { HtmlTagDescriptor, Plugin } from "vite"

/**
 * AD-23 / UX-DR3 / UX-DR4 build step:
 * - preloads the body font (Inter 400, latin subset) from the bundle, so first text paints in Inter;
 * - hashes every inline `<script>` of the final `index.html` and writes `dist/csp-hashes.json`
 *   (`{ "script-src": ["'sha256-…'"] }`) for the host/proxy CSP `script-src 'self' 'sha256-<theme-script>'`.
 */

export const CSP_HASHES_FILE = "csp-hashes.json"

/** Matches the Inter 400 latin woff2 that @fontsource emits (Vite adds a content hash). */
const BODY_FONT_PATTERN = /inter-latin-400-normal[-.][^/]*\.woff2$/

const INLINE_SCRIPT_PATTERN = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi

/** Contents of every inline (no `src`) script, exactly as the browser hashes them. */
export function extractInlineScripts(html: string): string[] {
  return [...html.matchAll(INLINE_SCRIPT_PATTERN)].map((match) => match[1])
}

export function cspHash(source: string): string {
  return `'sha256-${createHash("sha256").update(source, "utf8").digest("base64")}'`
}

export function inlineScriptHashes(html: string): string[] {
  return extractInlineScripts(html).map(cspHash)
}

export function themeCspPlugin(): Plugin {
  let outDir = "dist"
  let base = "/"

  return {
    name: "eventhub:theme-csp",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
      base = config.base
    },
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const fontFile = Object.keys(ctx.bundle ?? {}).find((fileName) => BODY_FONT_PATTERN.test(fileName))
        if (!fontFile) {
          return []
        }
        const tag: HtmlTagDescriptor = {
          tag: "link",
          attrs: { rel: "preload", href: `${base}${fontFile}`, as: "font", type: "font/woff2", crossorigin: "" },
          injectTo: "head",
        }
        return [tag]
      },
    },
    writeBundle(_options, bundle) {
      const html = bundle["index.html"]
      if (!html || html.type !== "asset") {
        this.error("index.html missing from the bundle; cannot hash the theme script")
      }
      const source = typeof html.source === "string" ? html.source : new TextDecoder().decode(html.source)
      const hashes = inlineScriptHashes(source)
      if (hashes.length === 0) {
        this.error("No inline theme script found in index.html")
      }
      writeFileSync(resolve(outDir, CSP_HASHES_FILE), `${JSON.stringify({ "script-src": hashes }, null, 2)}\n`)
    },
  }
}
