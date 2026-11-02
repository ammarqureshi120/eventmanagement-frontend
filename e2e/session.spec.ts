import { expect, test, type Locator, type Page } from "@playwright/test"

import { STUB_EMAIL, STUB_PASSWORD, stubApi } from "./fixtures/api-stub.ts"
import {
  clippedElements,
  expectNoA11yViolations,
  expectNoSeriousA11yViolations,
  horizontalOverflow,
  smallTargets,
} from "./fixtures/checks.ts"

/**
 * Story 1.5b safe sessions on every DEVICE_MATRIX project (6 devices × light/dark), against the API stub
 * with a fake browser clock (`page.clock`): the idle warning (dialog ≥640px, bottom sheet below), the
 * 12-hour variant, the local session end with its notice and returnTo, and the disabled notice.
 * Not emulable here (reported as not verified): real notch insets, real OS font scale.
 */

const START = new Date("2026-11-02T08:00:00Z")
const SESSION_ENDED = "Your session ended. Sign in again to continue."

async function expectCleanLayout(page: Page) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  expect(await clippedElements(page)).toEqual([])
  expect(await smallTargets(page)).toEqual([])
}

/** Waits for the dialog's enter animation (rise + 98.5% scale) so sizes are final. */
async function settled(dialog: Locator) {
  await expect
    .poll(async () => dialog.evaluate((el) => el.getAnimations({ subtree: true }).filter((a) => a.playState === "running").length))
    .toBe(0)
}

async function openPlatform(page: Page) {
  await page.clock.install({ time: START })
  await page.goto("/platform")
  await expect(page.getByRole("heading", { level: 1, name: "Platform overview" })).toBeVisible()
}

test.describe("safe sessions", () => {
  test("the idle warning shows at 28 minutes as a dialog (bottom sheet on phones) and Esc stays signed in", async ({
    page,
  }) => {
    const api = await stubApi(page, { signedIn: true })
    await openPlatform(page)

    await page.clock.fastForward("27:59")
    await expect(page.getByRole("alertdialog")).toHaveCount(0)
    await page.clock.fastForward("00:01")

    const dialog = page.getByRole("alertdialog", { name: "Still there?" })
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText("You'll be signed out in 2 minutes to keep your account safe.")
    await expect(dialog.getByRole("timer")).toHaveText(/^(2:00|1:59)$/)
    await expect(dialog.getByRole("button", { name: "Stay signed in" })).toBeFocused()
    await expect(dialog.getByRole("button", { name: "Sign out" })).toBeVisible()

    // Wait for the enter animation, then check the geometry.
    const viewport = page.viewportSize() ?? { width: 0, height: 0 }
    await settled(dialog)
    const box = (await dialog.boundingBox()) ?? { x: 0, y: 0, width: 0, height: 0 }
    if (viewport.width < 640) {
      // Bottom sheet: full width, anchored to the bottom edge, 20px top corners.
      expect(Math.round(box.x)).toBe(0)
      expect(Math.round(box.width)).toBe(viewport.width)
      expect(Math.round(box.y + box.height)).toBe(viewport.height)
      await expect(dialog).toHaveCSS("border-top-left-radius", "20px")
    } else {
      // Centred dialog, at most 460px wide, 16px radius.
      expect(Math.round(box.width)).toBeLessThanOrEqual(460)
      expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(1)
      expect(Math.abs(box.y + box.height / 2 - viewport.height / 2)).toBeLessThanOrEqual(1)
      await expect(dialog).toHaveCSS("border-top-left-radius", "16px")
    }
    await expect(dialog.getByRole("button", { name: "Stay signed in" })).toBeInViewport({ ratio: 1 })
    await expect(dialog.getByRole("button", { name: "Sign out" })).toBeInViewport({ ratio: 1 })
    await expectCleanLayout(page)
    await expectNoA11yViolations(page)

    // A scrim click does nothing; Esc means "Stay signed in": one GET /api/me, and the warning closes.
    await page.mouse.click(4, 4)
    await expect(dialog).toBeVisible()
    const before = api.calls.length
    await page.keyboard.press("Escape")
    await expect(dialog).toBeHidden()
    await expect.poll(() => api.calls.slice(before)).toEqual(["GET /api/me"])
  })

  test("the 12-hour variant offers only OK, which sends nothing", async ({ page }) => {
    const api = await stubApi(page, { signedIn: true, sessionExpiresAt: new Date(START.getTime() + 10 * 60_000).toISOString() })
    await openPlatform(page)

    await page.clock.fastForward("08:00")
    const dialog = page.getByRole("alertdialog", { name: "Still there?" })
    await expect(dialog).toContainText("Your session reaches its 12-hour limit in 2 minutes. Save your work, then sign in again.")
    await expect(dialog.getByRole("button")).toHaveCount(1)
    await expect(dialog.getByRole("button")).toHaveAccessibleName("OK")
    await expect(dialog.getByRole("button", { name: "OK" })).toBeFocused()
    await settled(dialog)
    await expectCleanLayout(page)
    await expectNoA11yViolations(page)

    const before = api.calls.length
    await dialog.getByRole("button", { name: "OK" }).click()
    await expect(dialog).toBeHidden()
    expect(api.calls.slice(before)).toEqual([])
  })

  test("when the idle window ends: /login with returnTo and the notice, no API call, and sign-in returns", async ({
    page,
  }) => {
    const api = await stubApi(page, { signedIn: true })
    await openPlatform(page)

    await page.clock.fastForward("28:00")
    await expect(page.getByRole("alertdialog")).toBeVisible()
    // The server ends the session too (stub), and the client leaves without asking it.
    api.signedIn = false
    const before = api.calls.length
    await page.clock.fastForward("02:00")

    await expect(page).toHaveURL(/\/login\?returnTo=%2Fplatform$/)
    await expect(page.getByRole("status").filter({ hasText: SESSION_ENDED })).toBeVisible()
    expect(api.calls.slice(before)).toEqual([])
    // The notice lives in router state only.
    expect(page.url()).not.toContain("notice")
    await expectCleanLayout(page)
    await expectNoSeriousA11yViolations(page)

    await page.getByRole("textbox", { name: "Email" }).fill(STUB_EMAIL)
    await page.getByLabel("Password", { exact: true }).fill(STUB_PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/platform$/)
    await expect(page.getByRole("heading", { level: 1, name: "Platform overview" })).toBeVisible()
  })

  test("a reload after the session expired shows the session-ended notice", async ({ page }) => {
    const api = await stubApi(page, { signedIn: true })
    await openPlatform(page)

    api.signedIn = false
    await page.reload()

    await expect(page).toHaveURL(/\/login\?returnTo=%2Fplatform$/)
    await expect(page.getByText(SESSION_ENDED)).toBeVisible()
  })

  test("a disabled account lands on /login without returnTo and with the disabled notice", async ({ page }) => {
    await stubApi(page, { signedIn: true, meProblem: "account_disabled" })
    await page.goto("/platform")

    await expect(page).toHaveURL(/\/login$/)
    const alert = page.getByRole("alert").filter({ hasText: "This account is disabled." })
    await expect(alert).toBeVisible()
    await expectCleanLayout(page)
    await expectNoSeriousA11yViolations(page)
  })
})
