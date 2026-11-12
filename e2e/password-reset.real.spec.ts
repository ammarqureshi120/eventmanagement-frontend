import { randomBytes } from "node:crypto"

import { expect, test, type APIRequestContext } from "@playwright/test"

/**
 * Story 1.6b against the real stack (AppHost: API + Vite + Mailpit), skipped unless `E2E_REAL_API=1`:
 * forgot → the email in Mailpit → open its link → set a new password → sign in with it.
 *
 *   E2E_REAL_API=1 npx playwright test e2e/password-reset.real.spec.ts --project=desktop-light
 *
 * Env: `E2E_BASE_URL` (default http://localhost:5173), `MAILPIT_URL` (default http://localhost:8025),
 * `E2E_RESET_EMAIL` (default the dev System Administrator, sysadmin@eventhub.test).
 * It changes that account's password to a random one it never prints: run `tools/dev-checks/reset-check.ps1`
 * afterwards to restore the dev password. It runs on desktop-light only (each run uses up a reset link on the shared
 * dev account), so a run without `--project` cannot reset that account 12 times at once.
 */

const enabled = process.env.E2E_REAL_API === "1"
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:5173"
const mailpitUrl = (process.env.MAILPIT_URL ?? "http://localhost:8025").replace(/\/$/, "")
const email = process.env.E2E_RESET_EMAIL ?? "sysadmin@eventhub.test"

interface MailpitSummary {
  ID: string
  Created: string
}

/** The newest reset link Mailpit holds for `to`, from a message created after `since`. */
async function resetLinkFor(request: APIRequestContext, to: string, since: number): Promise<string | null> {
  const search = await request.get(`${mailpitUrl}/api/v1/search`, { params: { query: `to:"${to}"`, limit: "10" } })
  if (!search.ok()) {
    return null
  }
  const { messages = [] } = (await search.json()) as { messages?: MailpitSummary[] }
  const fresh = messages
    .filter((message) => Date.parse(message.Created) >= since)
    .sort((a, b) => Date.parse(b.Created) - Date.parse(a.Created))[0]
  if (!fresh) {
    return null
  }
  const message = await request.get(`${mailpitUrl}/api/v1/message/${fresh.ID}`)
  const { Text = "" } = (await message.json()) as { Text?: string }
  return /https?:\/\/\S+\/reset-password\?token=[A-Za-z0-9_-]+/.exec(Text)?.[0] ?? null
}

test.describe("forgot & reset password (real API + Mailpit)", () => {
  test.skip(!enabled, "Set E2E_REAL_API=1 with AppHost running to run against the real API and Mailpit.")
  test.describe.configure({ mode: "serial" })
  test.use({ baseURL })

  test("forgot → Mailpit email → reset link → new password → sign in", async ({ page, request }, testInfo) => {
    test.skip(
      testInfo.project.name !== "desktop-light",
      "Runs on desktop-light only: every run uses the one shared dev account and its reset link.",
    )
    const newPassword = `E2e-${randomBytes(9).toString("base64url")}7`
    // Mailpit stamps messages with second precision: allow a little clock slack.
    const since = Date.now() - 5_000

    await page.goto("/forgot-password")
    await page.getByRole("textbox", { name: "Email" }).fill(email)
    await page.getByRole("button", { name: "Send reset link" }).click()
    await expect(page.getByRole("status").filter({ hasText: `If an account exists for ${email}` })).toBeVisible()

    // The outbox relay polls every 5 s.
    let link: string | null = null
    await expect
      .poll(async () => (link = await resetLinkFor(request, email, since)), { timeout: 60_000, intervals: [1_000] })
      .not.toBeNull()
    const resetUrl = new URL(link ?? "")
    const token = resetUrl.searchParams.get("token") ?? ""
    expect(token.length).toBeGreaterThan(20)

    // Open it on this origin (the link is built from PublicBaseUrl, which is this app in dev).
    const response = await page.goto(`${resetUrl.pathname}${resetUrl.search}`)
    expect(response?.headers()["referrer-policy"]).toBe("no-referrer")
    await expect(page.getByRole("heading", { level: 1, name: "Set a new password" })).toBeVisible()
    await expect(page).toHaveURL(/\/reset-password$/)
    expect(page.url()).not.toContain(token)

    await page.getByLabel("New password", { exact: true }).fill(newPassword)
    await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword)
    await page.getByRole("button", { name: "Save new password" }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole("status").filter({ hasText: "Password updated. Sign in with your new password." })).toBeVisible()
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue(email)
    const stored = await page.evaluate(() =>
      [localStorage, sessionStorage].flatMap((storage) => Object.keys(storage).map((key) => `${key}=${storage.getItem(key)}`)),
    )
    expect(stored.join("\n")).not.toContain(token)

    await page.getByLabel("Password", { exact: true }).fill(newPassword)
    await page.getByRole("button", { name: "Sign in" }).click()
    await expect(page).toHaveURL(/\/platform$/)

    // The link works once.
    await page.goto(`${resetUrl.pathname}${resetUrl.search}`)
    await page.getByLabel("New password", { exact: true }).fill(newPassword)
    await page.getByLabel("Confirm new password", { exact: true }).fill(newPassword)
    await page.getByRole("button", { name: "Save new password" }).click()
    await expect(page.getByRole("heading", { level: 1, name: "This reset link has expired" })).toBeVisible()
  })
})
