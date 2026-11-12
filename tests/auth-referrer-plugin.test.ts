// @vitest-environment node
// Story 1.6b: the Vite dev/preview servers send `Referrer-Policy: no-referrer` on the auth routes only, and
// index.html carries the no-referrer meta. (The served header is also checked end to end in e2e/password-reset.spec.ts.)
import { readFileSync } from "node:fs"
import type { IncomingMessage, ServerResponse } from "node:http"
import { resolve } from "node:path"

import { describe, expect, it, vi } from "vitest"

import { isNoReferrerPath, noReferrerMiddleware } from "../build/auth-referrer-plugin.ts"

describe("auth referrer policy", () => {
  it.each([
    "/login",
    "/login?returnTo=%2Fplatform",
    "/forgot-password",
    "/forgot-password/",
    "/reset-password?token=abc",
    "/reset-password#x",
  ])("matches the auth route %s", (url) => {
    expect(isNoReferrerPath(url)).toBe(true)
  })

  it.each([undefined, "/", "/platform", "/login-help", "/reset-password-x", "/assets/index.js", "/api/auth/login"])(
    "leaves %s alone",
    (url) => {
      expect(isNoReferrerPath(url)).toBe(false)
    },
  )

  it("sets the header before passing the request on", () => {
    const setHeader = vi.fn()
    const next = vi.fn()
    noReferrerMiddleware({ url: "/reset-password?token=abc" } as IncomingMessage, { setHeader } as unknown as ServerResponse, next)
    expect(setHeader).toHaveBeenCalledWith("Referrer-Policy", "no-referrer")
    expect(next).toHaveBeenCalledOnce()

    setHeader.mockClear()
    noReferrerMiddleware({ url: "/platform" } as IncomingMessage, { setHeader } as unknown as ServerResponse, next)
    expect(setHeader).not.toHaveBeenCalled()
  })

  it("index.html carries the no-referrer meta", () => {
    const html = readFileSync(resolve(import.meta.dirname, "../index.html"), "utf8")
    expect(html).toMatch(/<meta name="referrer" content="no-referrer"\s*\/?>/)
  })
})
