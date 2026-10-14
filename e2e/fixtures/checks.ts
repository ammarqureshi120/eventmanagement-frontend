import { AxeBuilder } from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"

/** UX-DR56: no serious or critical axe violations (WCAG 2.1 AA tags). */
export async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
  const blocking = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical")
  expect(blocking, JSON.stringify(blocking.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })), null, 2)).toEqual(
    [],
  )
}

/** UX-DR58: nothing scrolls sideways. */
export async function horizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

/**
 * Clipped content: text wider than its box (no wrap), or a control whose content is taller than the
 * control. Glyph ink above a heading's line box is not clipping, so text is checked sideways only.
 */
export async function clippedElements(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("h1, h2, p, label, a, button, input, [role=radio], [role=menuitem]")]
      .filter((el) => el.getClientRects().length > 0 && !el.closest(".sr-only") && !el.classList.contains("sr-only"))
      .filter((el) => {
        const isControl = el.matches("a, button, input, [role=radio], [role=menuitem]")
        return el.scrollWidth > el.clientWidth + 1 || (isControl && el.scrollHeight > el.clientHeight + 1)
      })
      .map((el) => `${el.tagName.toLowerCase()} "${(el.getAttribute("aria-label") ?? el.textContent)?.trim().slice(0, 40)}"`),
  )
}

/** Visible interactive targets smaller than 44×44 (sr-only skip link excluded until focused). */
export async function smallTargets(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("a[href], button, input, [role=radio], [role=menuitem]")]
      .filter((el) => !el.classList.contains("sr-only"))
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && box.height > 0)
      .filter(({ box }) => box.width < 44 || box.height < 44)
      .map(
        ({ el, box }) =>
          `${el.tagName.toLowerCase()} "${el.getAttribute("aria-label") ?? el.textContent?.trim()}" ${Math.round(box.width)}x${Math.round(box.height)}`,
      ),
  )
}

/** Elements (by selector) whose box leaves the viewport sideways. */
export async function outsideViewport(page: Page, selector: string) {
  return page.evaluate((sel) => {
    const width = document.documentElement.clientWidth
    return [...document.querySelectorAll<HTMLElement>(sel)]
      .map((el) => ({ el, box: el.getBoundingClientRect() }))
      .filter(({ box }) => box.width > 0 && (box.left < -1 || box.right > width + 1))
      .map(({ el, box }) => `${el.tagName.toLowerCase()} ${Math.round(box.left)}..${Math.round(box.right)}`)
  }, selector)
}
