import { expect, test, type Page } from "@playwright/test"

import { STUB_EMAIL, STUB_RESET_TOKEN, stubApi } from "./fixtures/api-stub.ts"
import {
  clippedElements,
  expectNoA11yViolations,
  expectNoSeriousA11yViolations,
  horizontalOverflow,
  smallTargets,
} from "./fixtures/checks.ts"

/**
 * Story 1.6b forgot & reset password on every DEVICE_MATRIX project (6 devices × light/dark), against the API stub:
 * the forgot confirmation, the reset page (token stripped from the URL, live Password rules, Confirm mismatch,
 * server policy error, success → /login notice with the email prefilled), the expired-link card (token_invalid and
 * no token), the no-referrer header and meta, and the matrix checks (overflow, clipping, 44px targets, keyboard,
 * 200% text, axe).
 * Not emulable here (reported as not verified): real notch insets, the real on-screen keyboard, OS font scale.
 */

const CONFIRMATION = (email: string) =>
  `Check your inbox. If an account exists for ${email}, we've sent a reset link. It works once and expires in 1 hour.`
const MISMATCH = "This doesn't match the password above. Type it again."
const NEW_PASSWORD = "Fresh-passw0rd"
const LONG_EMAIL = "a.rather.long.mailbox.name.for.wrapping@events-department.example.test"

async function expectCleanLayout(page: Page) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  expect(await clippedElements(page)).toEqual([])
  expect(await smallTargets(page)).toEqual([])
}

/** Every console message of the page, to prove the token is never logged. */
function captureConsole(page: Page) {
  const lines: string[] = []
  page.on("console", (message) => lines.push(message.text()))
  return lines
}

const newPassword = (page: Page) => page.getByLabel("New password", { exact: true })
const confirmPassword = (page: Page) => page.getByLabel("Confirm new password", { exact: true })

function ruleRows(page: Page) {
  return page.getByRole("list", { name: "Password rules" }).getByRole("listitem")
}

test.describe("forgot & reset password", () => {
  test("the auth routes are served with Referrer-Policy: no-referrer and the document carries the meta", async ({ page }) => {
    await stubApi(page)
    for (const path of ["/login", "/forgot-password", `/reset-password?token=${STUB_RESET_TOKEN}`]) {
      const response = await page.goto(path)
      expect(response?.headers()["referrer-policy"], path).toBe("no-referrer")
    }
    await expect(page.locator('meta[name="referrer"]')).toHaveAttribute("content", "no-referrer")

    const home = await page.goto("/platform")
    expect(home?.headers()["referrer-policy"]).toBeUndefined()
  })

  test("forgot: client check, then one fixed confirmation that wraps a long email", async ({ page }) => {
    const api = await stubApi(page)
    await page.goto("/login")
    await page.getByRole("link", { name: "Forgot password?" }).click()

    await expect(page).toHaveURL(/\/forgot-password$/)
    await expect(page.getByRole("heading", { level: 1, name: "Forgot your password?" })).toBeVisible()
    await expect(page.getByRole("heading", { level: 1, name: "Forgot your password?" })).toBeFocused()
    await expect(page).toHaveTitle("Forgot password · EventHub")
    await expectCleanLayout(page)
    await expectNoA11yViolations(page)

    // Client check first (the sign-in email rule): nothing is sent.
    const email = page.getByRole("textbox", { name: "Email" })
    await page.getByRole("button", { name: "Send reset link" }).click()
    await expect(email).toHaveAttribute("aria-invalid", "true")
    await expect(email).toBeFocused()
    await expect(page.getByText("Enter your email address.")).toBeVisible()
    expect(api.forgotBodies).toEqual([])
    await expectCleanLayout(page)
    await expectNoSeriousA11yViolations(page)

    await email.fill(LONG_EMAIL)
    await page.getByRole("button", { name: "Send reset link" }).click()

    await expect(page.getByRole("status").filter({ hasText: CONFIRMATION(LONG_EMAIL) })).toBeVisible()
    expect(api.forgotBodies).toEqual([{ email: LONG_EMAIL }])
    await expect(email).toHaveCount(0)
    await expectCleanLayout(page)
    await expectNoA11yViolations(page)

    await page.getByRole("link", { name: "Back to sign in" }).click()
    await expect(page).toHaveURL(/\/login$/)
  })

  test("reset: the token leaves the URL, rules tick live, Confirm mismatch shows, success lands on /login prefilled", async ({
    page,
  }) => {
    const api = await stubApi(page)
    const consoleLines = captureConsole(page)
    await page.goto(`/reset-password?token=${STUB_RESET_TOKEN}`)

    await expect(page.getByRole("heading", { level: 1, name: "Set a new password" })).toBeVisible()
    await expect(page.getByText("Other devices will be signed out.")).toBeVisible()
    await expect(page).toHaveURL(/\/reset-password$/)
    expect(await page.evaluate(() => location.search)).toBe("")
    await expectCleanLayout(page)
    await expectNoA11yViolations(page)

    // Rules tick as the user types: "abc1" → 8+ not yet, letter done, number done.
    await newPassword(page).pressSequentially("abc1")
    await expect(ruleRows(page)).toHaveText(["8+ characters: not yet", "A letter: done", "A number: done"])

    // Confirm validates once it is as long as the first field.
    await newPassword(page).fill(NEW_PASSWORD)
    await expect(ruleRows(page)).toHaveText(["8+ characters: done", "A letter: done", "A number: done"])
    await confirmPassword(page).pressSequentially("Fresh-pass")
    await expect(page.getByText(MISMATCH)).toHaveCount(0)
    await confirmPassword(page).pressSequentially("w0rX")
    await expect(page.getByText(MISMATCH)).toBeVisible()
    await expect(confirmPassword(page)).toHaveAttribute("aria-invalid", "true")
    await expectCleanLayout(page)
    await expectNoSeriousA11yViolations(page)

    // A mismatch blocks the submit.
    await page.getByRole("button", { name: "Save new password" }).click()
    expect(api.resetBodies).toEqual([])

    await confirmPassword(page).fill(NEW_PASSWORD)
    await expect(page.getByText(MISMATCH)).toHaveCount(0)
    await page.getByRole("button", { name: "Save new password" }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole("status").filter({ hasText: "Password updated. Sign in with your new password." })).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue(STUB_EMAIL)
    expect(api.resetBodies).toEqual([{ token: STUB_RESET_TOKEN, newPassword: NEW_PASSWORD }])
    await expectCleanLayout(page)
    await expectNoSeriousA11yViolations(page)

    // The token was never stored, logged or kept in the URL.
    const stored = await page.evaluate(() =>
      [localStorage, sessionStorage].flatMap((storage) => Object.keys(storage).map((key) => `${key}=${storage.getItem(key)}`)),
    )
    expect(stored.join("\n")).not.toContain(STUB_RESET_TOKEN)
    expect(consoleLines.join("\n")).not.toContain(STUB_RESET_TOKEN)
    expect(page.url()).not.toContain(STUB_RESET_TOKEN)

    // The new password signs in.
    await page.getByLabel("Password", { exact: true }).fill(NEW_PASSWORD)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/platform$/)
  })

  test("reset: a server policy error shows under New password and the token still works", async ({ page }) => {
    const api = await stubApi(page)
    await page.goto(`/reset-password?token=${STUB_RESET_TOKEN}`)
    api.nextResetProblem = { status: 400, code: "validation", errors: { newPassword: ["Include at least one number."] } }

    await newPassword(page).fill(NEW_PASSWORD)
    await confirmPassword(page).fill(NEW_PASSWORD)
    await page.getByRole("button", { name: "Save new password" }).click()

    await expect(page.getByText("Include at least one number.")).toBeVisible()
    await expect(newPassword(page)).toHaveAttribute("aria-invalid", "true")
    await expect(newPassword(page)).toBeFocused()
    await expectCleanLayout(page)
    await expectNoSeriousA11yViolations(page)

    await page.getByRole("button", { name: "Save new password" }).click()
    await expect(page).toHaveURL(/\/login$/)
    expect(api.resetBodies).toHaveLength(2)
  })

  test("reset: token_invalid shows the expired-link card, whose action opens /forgot-password", async ({ page }) => {
    await stubApi(page)
    await page.goto("/reset-password?token=not-the-stub-token")
    await expect(page).toHaveURL(/\/reset-password$/)

    await newPassword(page).fill(NEW_PASSWORD)
    await confirmPassword(page).fill(NEW_PASSWORD)
    await page.getByRole("button", { name: "Save new password" }).click()

    const title = page.getByRole("heading", { level: 1, name: "This reset link has expired" })
    await expect(title).toBeVisible()
    await expect(title).toBeFocused()
    await expect(page.getByText("Reset links work once and expire after 1 hour.")).toBeVisible()
    await expect(newPassword(page)).toHaveCount(0)
    await expectCleanLayout(page)
    await expectNoA11yViolations(page)

    await page.getByRole("link", { name: "Get a new link" }).click()
    await expect(page).toHaveURL(/\/forgot-password$/)
    await expect(page.getByRole("heading", { level: 1, name: "Forgot your password?" })).toBeVisible()
  })

  test("reset: no token (or a reload after the strip) shows the card with no request, signed in too", async ({ page }) => {
    const api = await stubApi(page, { signedIn: true })
    await page.goto(`/reset-password?token=${STUB_RESET_TOKEN}`)
    await expect(page.getByRole("heading", { level: 1, name: "Set a new password" })).toBeVisible()
    await expect(page).toHaveURL(/\/reset-password$/)

    await page.reload()

    await expect(page.getByRole("heading", { level: 1, name: "This reset link has expired" })).toBeVisible()
    await expect(page).toHaveURL(/\/reset-password$/)
    await expect(page).toHaveTitle("Reset link expired · EventHub")
    expect(api.resetBodies).toEqual([])
    // A signed-in user is never redirected away, and the page never asks /api/me.
    expect(api.calls.filter((call) => call === "GET /api/me")).toEqual([])
    await expectCleanLayout(page)
    await expectNoA11yViolations(page)
  })

  test("reset: password fields stay in view with the on-screen keyboard and nothing clips at 200% text", async ({ page }) => {
    await stubApi(page)
    const viewport = page.viewportSize() ?? { width: 0, height: 0 }
    await page.goto(`/reset-password?token=${STUB_RESET_TOKEN}`)
    await expect(page.getByRole("heading", { level: 1, name: "Set a new password" })).toBeVisible()

    // Approximation: shrink the viewport the way an on-screen keyboard does, then focus each field.
    await page.setViewportSize({ width: viewport.width, height: Math.round(viewport.height * 0.5) })
    for (const field of [newPassword(page), confirmPassword(page)]) {
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
    await page.setViewportSize(viewport)

    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%"
    })
    await newPassword(page).fill("abc")
    await confirmPassword(page).fill("abd")
    await page.getByRole("button", { name: "Save new password" }).click()
    await expect(page.getByText(MISMATCH)).toBeVisible()
    await expectCleanLayout(page)

    // The forgot page and the expired-link card wrap too (rem sizes double; the inline style survives client navigation).
    await page.getByRole("link", { name: "Back to sign in" }).click()
    await page.getByRole("link", { name: "Forgot password?" }).click()
    await page.getByRole("button", { name: "Send reset link" }).click()
    await expect(page.getByText("Enter your email address.")).toBeVisible()
    await expectCleanLayout(page)
    await page.goto("/reset-password")
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%"
    })
    await expect(page.getByRole("heading", { level: 1, name: "This reset link has expired" })).toBeVisible()
    await expectCleanLayout(page)
  })

  test("keyboard: every Tab stop on the reset form shows a visible focus indicator", async ({ page, browserName }) => {
    await stubApi(page)
    await page.goto(`/reset-password?token=${STUB_RESET_TOKEN}`)
    await expect(page.getByRole("heading", { level: 1, name: "Set a new password" })).toBeVisible()

    const stops = [
      newPassword(page),
      page.getByRole("button", { name: "Show password" }).first(),
      confirmPassword(page),
      page.getByRole("button", { name: "Show password" }).nth(1),
      page.getByRole("button", { name: "Save new password" }),
      page.getByRole("link", { name: "Back to sign in" }),
    ]
    await page.getByRole("radio", { name: "System" }).focus()
    for (const stop of stops) {
      if (browserName === "webkit") {
        // WebKit skips links and buttons on Tab by default; keyboard modality first, then focus directly.
        await page.keyboard.press("Shift")
        await stop.focus()
      } else {
        await page.keyboard.press("Tab")
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
      expect(indicator.visible).toBe(true)
      expect(indicator.outline || indicator.halo).toBe(true)
    }
  })
})
