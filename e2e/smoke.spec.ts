import { expect, test } from "@playwright/test"

import { stubApi } from "./fixtures/api-stub.ts"
import { expectNoSeriousA11yViolations, horizontalOverflow } from "./fixtures/checks.ts"

test.describe("smoke", () => {
  test("/ sends a signed-out visitor to Sign in without overflow or serious a11y violations", async ({ page }) => {
    await stubApi(page)
    await page.goto("/")

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible()
    await expect(page).toHaveTitle("Sign in · EventHub")
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    await expectNoSeriousA11yViolations(page)
  })

  test("unknown route (signed out) shows the standalone Not found page with a 44px home link", async ({ page }) => {
    await stubApi(page)
    await page.goto("/no-such-page")

    await expect(page.getByRole("heading", { level: 2, name: "We couldn't find that" })).toBeVisible()
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeAttached()
    await expect(page.getByText("It may have been moved, or you may not have access to it.")).toBeVisible()
    await expect(page).toHaveTitle("Not found · EventHub")
    await expect(page).toHaveURL(/\/no-such-page$/)
    const link = page.getByRole("link", { name: "Go to home" })
    const box = await link.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(44)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    await expectNoSeriousA11yViolations(page)
  })
})
