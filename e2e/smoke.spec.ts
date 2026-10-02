import { AxeBuilder } from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

/** UX-DR56: no serious or critical axe violations (WCAG 2.1 AA tags). */
async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
  expect(blocking, JSON.stringify(blocking.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([])
}

/** UX-DR58: nothing scrolls sideways. */
async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe("smoke", () => {
  test("home renders without overflow or serious a11y violations", async ({ page }) => {
    await page.goto("/")

    await expect(page.getByRole("heading", { level: 1, name: "EventHub" })).toBeVisible()
    await expect(page).toHaveTitle("EventHub")
    await expectNoHorizontalOverflow(page)
    await expectNoSeriousA11yViolations(page)
  })

  test("unknown route shows the not-found page with a 44px home link", async ({ page }) => {
    await page.goto("/no-such-page")

    await expect(page.getByRole("heading", { level: 1, name: /couldn.t find that page/i })).toBeVisible()
    const link = page.getByRole("link", { name: "Go to home" })
    const box = await link.boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    await expectNoHorizontalOverflow(page)
    await expectNoSeriousA11yViolations(page)
  })
})
