import type { IncomingMessage, ServerResponse } from "node:http"

import type { Plugin } from "vite"

/**
 * AD-16 / AD-23 (Story 1.6b): the auth routes are served with `Referrer-Policy: no-referrer`, so a reset (or later
 * invite) token can never leak through a Referer header. The SPA also carries `<meta name="referrer"
 * content="no-referrer">` in `index.html` (one document, so it applies app-wide); this header covers the first
 * load of each auth route on the Vite dev and preview servers. The production host/proxy sends the same header.
 */
export const NO_REFERRER_PATHS: readonly string[] = ["/login", "/forgot-password", "/reset-password"]

/** True when the request path (query ignored, one trailing slash allowed) is an auth route. */
export function isNoReferrerPath(url: string | undefined): boolean {
  if (!url) {
    return false
  }
  const pathname = url.split(/[?#]/, 1)[0]
  const normalized = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname
  return NO_REFERRER_PATHS.includes(normalized)
}

/** Connect middleware: sets the header before Vite answers with `index.html`. */
export function noReferrerMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  if (isNoReferrerPath(req.url)) {
    res.setHeader("Referrer-Policy", "no-referrer")
  }
  next()
}

export function authReferrerPlugin(): Plugin {
  return {
    name: "eventhub:auth-referrer",
    configureServer(server) {
      server.middlewares.use(noReferrerMiddleware)
    },
    configurePreviewServer(server) {
      server.middlewares.use(noReferrerMiddleware)
    },
  }
}
