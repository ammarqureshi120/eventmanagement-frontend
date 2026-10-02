import { createHash } from "node:crypto"

import { AxeBuilder } from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

/**
 * Story 1.2 `/login` on every DEVICE_MATRIX project (6 devices × light/dark OS scheme).
 * UX-DR4/5 no-flash + toggle, UX-DR56 axe, UX-DR58 overflow / 44px targets / 200% text / keyboard-safe focus.
 * Not emulable here (reported as not verified): real OS font scale, the on-screen keyboard, real safe-area insets.
 */

/** Token values the first paint must already use (DESIGN.md `background` / `background-dark`). */
const BACKGROUND = { light: "rgb(245, 247, 249)", dark: "rgb(23, 28, 33)" } as const

type Scheme = keyof typeof BACKGROUND

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
  expect(blocking, JSON.stringify(blocking.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)).toEqual(
    [],
  )
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

/**
 * Clipped content: text wider than its box (no wrap), or a control (fixed-height box) whose content is
 * taller than the control. Glyph ink above a heading's line box is not clipping, so text is checked sideways only.
 */
async function clippedElements(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("h1, p, label, a, button, input, [role=radio]")]
      .filter((el) => el.getClientRects().length > 0 && !el.closest(".sr-only") && !el.classList.contains("sr-only"))
      .filter((el) => {
        const isControl = el.matches("a, button, input, [role=radio]")
        return el.scrollWidth > el.clientWidth + 1 || (isControl && el.scrollHeight > el.clientHeight + 1)
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent)?.trim().slice(0, 40)}"`),
  )
}

/** Visible interactive targets smaller than 44×44 (sr-only skip link excluded until focused). */
async function smallTargets(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("a[href], button, input, [role=radio]")]
      .filter((el) => !el.classList.contains("sr-only"))
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0)
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(({ el, box }) => `${el.tagName.toLowerCase()} "${el.getAttribute("aria-label") ?? el.textContent?.trim()}" ${Math.round(box.width)}x${Math.round(box.height)}`),
  )
}

function schemeOf(colorScheme: string | null | undefined): Scheme {
  return colorScheme === "dark" ? "dark" : "light"
}

test.describe("/login", () => {
  test.describe("no flash: the first paint already has the stored theme (React blocked)", () => {
    for (const stored of [null, "light", "dark", "system", "blue"] as const) {
      test(`stored ${stored ?? "nothing"}`, async ({ page }, testInfo) => {
        const os = schemeOf(testInfo.project.use.colorScheme)
        const expected: Scheme = stored === "light" || stored === "dark" ? stored : os

        if (stored !== null) {
          await page.addInitScript((value) => localStorage.setItem("eventhub-theme", value), stored)
        }
        // Without the app bundle only the inline <head> script can set the class: this is the first paint.
        await page.route("**/assets/*.js", (route) => route.abort())
        await page.goto("/login")

        const state = await page.evaluate(() => ({
          dark: document.documentElement.classList.contains("dark"),
          background: getComputedStyle(document.body).backgroundColor,
          reactMounted: (document.getElementById("root")?.childElementCount ?? 0) > 0,
        }))
        expect(state.reactMounted).toBe(false)
        expect(state.dark).toBe(expected === "dark")
        expect(state.background).toBe(BACKGROUND[expected])
      })
    }
  })

  test("the CSP hash in csp-hashes.json matches the served inline theme script", async ({ request }) => {
    const html = await (await request.get("/login")).text()
    const scripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1])
    const hashes = scripts.map((s) => `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`)
    const emitted = (await (await request.get("/csp-hashes.json")).json()) as Record<string, string[]>

    expect(scripts).toHaveLength(1)
    expect(emitted["script-src"]).toEqual(hashes)
  })

  test("fonts load from this origin only, with the body font preloaded", async ({ page, baseURL }) => {
    const fontHosts = new Set<string>()
    page.on("request", (req) => {
      if (req.resourceType() === "font") {
        fontHosts.add(new URL(req.url()).origin)
      }
    })
    await page.goto("/login")
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)

    expect([...fontHosts]).toEqual([new URL(baseURL ?? "").origin])
    await expect(page.locator('link[rel="preload"][as="font"][href*="inter-latin-400-normal"]')).toHaveCount(1)
    const fonts = await page.evaluate(() => ({
      body: getComputedStyle(document.body).fontFamily,
      h1: getComputedStyle(document.querySelector("h1") as Element).fontFamily,
      inter: document.fonts.check('400 15px "Inter"'),
      nunito: document.fonts.check('700 25px "Nunito Sans"'),
    }))
    expect(fonts.body).toMatch(/^"?Inter"?/)
    expect(fonts.h1).toMatch(/^"?Nunito Sans"?/)
    expect(fonts.inter && fonts.nunito).toBe(true)
  })

  test("renders the Auth card with no overflow, 44px targets, safe layout and no serious axe issues", async ({
    page,
  }, testInfo) => {
    await page.goto("/login")

    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible()
    await expect(page).toHaveTitle("Sign in · EventHub")
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveAttribute("autocomplete", "email")
    await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "current-password")
    await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password")

    // Theme follows the OS scheme by default (System).
    const os = schemeOf(testInfo.project.use.colorScheme)
    await expect(page.locator("html")).toHaveClass(os === "dark" ? /\bdark\b/ : /^(?!.*\bdark\b).*$/)

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    expect(await clippedElements(page)).toEqual([])
    expect(await smallTargets(page)).toEqual([])

    // Inputs use 16px text (no iOS zoom) at the default text size.
    expect(await page.getByRole("textbox", { name: "Email" }).evaluate((el) => getComputedStyle(el).fontSize)).toBe("16px")

    // Sign-in button is full width of the form.
    const signIn = await page.getByRole("button", { name: "Sign in" }).boundingBox()
    const email = await page.getByRole("textbox", { name: "Email" }).boundingBox()
    expect(Math.round(signIn?.width ?? 0)).toBe(Math.round(email?.width ?? -1))

    // Phones: card top-aligned at 72px (+ safe-area inset, 0 here). Wider: card centred vertically.
    const viewport = page.viewportSize() ?? { width: 0, height: 0 }
    const card = await page.getByRole("main").boundingBox()
    if (viewport.width < 640) {
      expect(Math.round(card?.y ?? 0)).toBe(72)
    } else if (card && card.height + 112 < viewport.height) {
      const centre = card.y + card.height / 2
      expect(Math.abs(centre - (viewport.height + 48) / 2)).toBeLessThanOrEqual(2)
    }

    // The icon-only toggle sits top-right and does not overlap the card.
    const toggle = await page.getByRole("radiogroup", { name: "Theme" }).boundingBox()
    expect((toggle?.x ?? 0) + (toggle?.width ?? 0)).toBeGreaterThan(viewport.width - 24)
    expect((toggle?.y ?? 0) + (toggle?.height ?? 0)).toBeLessThanOrEqual(card?.y ?? 0)

    await expectNoSeriousA11yViolations(page)
  })

  test("the theme toggle applies instantly, persists, survives reload and works with arrow keys", async ({ page }) => {
    await page.goto("/login")
    const html = page.locator("html")

    await page.getByRole("radio", { name: "Dark" }).click()
    await expect(html).toHaveClass(/\bdark\b/)
    expect(await page.evaluate(() => localStorage.getItem("eventhub-theme"))).toBe("dark")
    await expect(page.locator("body")).toHaveCSS("background-color", BACKGROUND.dark)
    await expectNoSeriousA11yViolations(page)

    await page.reload()
    await expect(html).toHaveClass(/\bdark\b/)
    await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked()

    await page.getByRole("radio", { name: "Dark" }).focus()
    await page.keyboard.press("ArrowLeft")
    await expect(page.getByRole("radio", { name: "Light" })).toBeChecked()
    await expect(page.getByRole("radio", { name: "Light" })).toBeFocused()
    await expect(html).not.toHaveClass(/\bdark\b/)
    await expect(page.locator("body")).toHaveCSS("background-color", BACKGROUND.light)
    expect(await page.evaluate(() => localStorage.getItem("eventhub-theme"))).toBe("light")
    await expectNoSeriousA11yViolations(page)

    await page.reload()
    await expect(html).not.toHaveClass(/\bdark\b/)
  })

  test("System follows an OS theme change live, without reload", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "light" })
    await page.goto("/login")
    await expect(page.getByRole("radio", { name: "System" })).toBeChecked()
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)

    await page.emulateMedia({ colorScheme: "dark" })
    await expect(page.locator("html")).toHaveClass(/\bdark\b/)
    await page.emulateMedia({ colorScheme: "light" })
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
  })

  test("keyboard: skip link is the first Tab stop, focus is visible on every Tab stop", async ({ page, browserName }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible()

    const tab = "Tab"
    const skip = page.getByRole("link", { name: "Skip to content" })
    // The skip link is the first focusable element in document order.
    expect(
      await page.evaluate(
        () => document.querySelector("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1'])")?.textContent,
      ),
    ).toBe("Skip to content")
    if (browserName === "webkit") {
      // WebKit (Safari default) skips links on Tab unless "Press Tab to highlight each item" is on; focus it directly.
      await skip.focus()
    } else {
      await page.keyboard.press(tab)
    }
    await expect(skip).toBeFocused()
    const box = await skip.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    await page.keyboard.press("Enter")
    await expect(page.getByRole("main")).toBeFocused()


    // Every Tab stop after the skip link, in order, shows a visible focus indicator (2px outline and/or halo).
    const stops = [
      page.getByRole("radio", { name: "System" }), // roving focus: only the checked segment is a Tab stop
      page.getByRole("textbox", { name: "Email" }),
      page.getByLabel("Password", { exact: true }),
      page.getByRole("button", { name: "Show password" }),
      page.getByRole("link", { name: "Forgot password?" }),
      page.getByRole("button", { name: "Sign in" }),
    ]
    await skip.focus()
    for (const stop of stops) {
      if (browserName === "webkit") {
        // Keyboard modality first, so programmatic focus still matches :focus-visible.
        await page.keyboard.press("Shift")
        await stop.focus()
      } else {
        await page.keyboard.press(tab)
      }
      await expect(stop).toBeFocused()
      const indicator = await stop.evaluate((el) => {
        const style = getComputedStyle(el)
        return {
          visible: el.matches(":focus-visible"),
          outline: style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 2,
          halo: style.boxShadow !== "none" && style.boxShadow.includes("3px"),
        }
      })
      expect(indicator.visible, await stop.evaluate((el) => el.outerHTML.slice(0, 80))).toBe(true)
      expect(indicator.outline || indicator.halo).toBe(true)
    }
  })

  test("Sign in validates on the client and focuses the first invalid field", async ({ page }) => {
    await page.goto("/login")
    const apiCalls: string[] = []
    page.on("request", (req) => {
      if (new URL(req.url()).pathname.startsWith("/api")) {
        apiCalls.push(req.url())
      }
    })

    await page.getByRole("button", { name: "Sign in" }).click()
    const email = page.getByRole("textbox", { name: "Email" })
    await expect(email).toHaveAttribute("aria-invalid", "true")
    await expect(email).toBeFocused()
    await expect(page.getByText("Enter your email address.")).toBeVisible()
    await expect(page.getByText("Enter your password.")).toBeVisible()
    expect(await clippedElements(page)).toEqual([])
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    await expectNoSeriousA11yViolations(page)

    await email.fill("sara@")
    await page.getByLabel("Password", { exact: true }).fill("secret")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByText("Enter an email like name@company.com.")).toBeVisible()

    await email.fill("sara@example.test")
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(email).not.toHaveAttribute("aria-invalid", "true")
    expect(apiCalls).toEqual([])
  })

  test("long text wraps and nothing clips at 200% text size", async ({ page }) => {
    await page.goto("/login")
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible()

    // Browser text zoom: every rem-based size doubles.
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%"
    })
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page.getByText("Enter your email address.")).toBeVisible()

    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    expect(await clippedElements(page)).toEqual([])
    expect(await smallTargets(page)).toEqual([])
  })

  test("a focused input stays in view when the on-screen keyboard takes half the screen", async ({ page }) => {
    const viewport = page.viewportSize() ?? { width: 0, height: 0 }
    await page.goto("/login")
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible()

    // Approximation: shrink the visual viewport the way an on-screen keyboard does, then focus each field.
    await page.setViewportSize({ width: viewport.width, height: Math.round(viewport.height * 0.5) })
    for (const field of [page.getByRole("textbox", { name: "Email" }), page.getByLabel("Password", { exact: true })]) {
      await field.focus()
      await expect
        .poll(() =>
          field.evaluate((el) => {
            const r = el.getBoundingClientRect()
            return r.top >= 0 && r.bottom <= window.innerHeight
          }),
        )
        .toBe(true)
    }
  })
})
