import { expect, test, type Locator, type Page } from "@playwright/test"

import { STUB_EMAIL, STUB_PASSWORD, stubApi } from "./fixtures/api-stub.ts"
import {
  clippedElements,
  expectNoSeriousA11yViolations,
  horizontalOverflow,
  outsideViewport,
  smallTargets,
} from "./fixtures/checks.ts"

/**
 * Story 1.4b sign-in → app shell → sign-out on every DEVICE_MATRIX project (6 devices × light/dark),
 * against the stateful API stub. Drawer below 1024px, fixed sidebar at ≥1024px.
 * Not emulable here (reported as not verified): real OS font scale, on-screen keyboard, real notch insets.
 */

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024

async function expectCleanLayout(page: Page) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  expect(await clippedElements(page)).toEqual([])
  expect(await smallTargets(page)).toEqual([])
}

async function signIn(page: Page) {
  await page.getByRole("textbox", { name: "Email" }).fill(STUB_EMAIL)
  await page.getByLabel("Password", { exact: true }).fill(STUB_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
}

test.describe("sign-in, app shell and sign-out", () => {
  test("a protected route asks for sign-in, returns there, and the shell passes layout + axe", async ({ page }) => {
    const api = await stubApi(page)

    await page.goto("/platform")
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fplatform$/)
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible()

    await signIn(page)

    await expect(page).toHaveURL(/\/platform$/)
    const heading = page.getByRole("heading", { level: 1, name: "Platform overview" })
    await expect(heading).toBeVisible()
    await expect(heading).toBeFocused()
    await expect(page).toHaveTitle("Platform overview · EventHub")
    await expect(page.getByRole("heading", { level: 2, name: "Nothing to show yet" })).toBeVisible()
    await expect(page.getByText("Organizations you create will show up here.")).toBeVisible()

    const afterLogin = api.calls.slice(api.calls.indexOf("POST /api/auth/login"))
    expect(afterLogin.slice(0, 3)).toEqual(["POST /api/auth/login", "GET /api/auth/antiforgery", "GET /api/me"])

    // Top bar: sticky, at least 60px, breadcrumb, icon theme toggle, user button.
    const topBar = page.locator("[data-slot=top-bar]")
    expect((await topBar.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(60)
    await expect(topBar).toHaveCSS("position", "sticky")
    await expect(topBar.getByRole("navigation", { name: "Breadcrumb" })).toHaveText("EventHub platform")
    await expect(topBar.getByRole("radiogroup", { name: "Theme" })).toBeVisible()
    await expect(topBar.getByRole("button", { name: /Sara Admin/ })).toBeVisible()

    await expectCleanLayout(page)
    expect(await outsideViewport(page, "[data-slot=top-bar] button, [data-slot=top-bar] [role=radio]")).toEqual([])
    await expectNoSeriousA11yViolations(page)
  })

  test("desktop shows the fixed sidebar; smaller screens use the drawer (Esc, scrim, navigation)", async ({ page }) => {
    await stubApi(page, { signedIn: true })
    await page.goto("/platform")
    await expect(page.getByRole("heading", { level: 1, name: "Platform overview" })).toBeVisible()

    const sidebar = page.locator("aside[data-slot=sidebar]")
    const menuButton = page.getByRole("button", { name: "Open menu" })

    if (isDesktop(page)) {
      await expect(sidebar).toBeVisible()
      expect(Math.round((await sidebar.boundingBox())?.width ?? 0)).toBe(264)
      await expect(menuButton).toBeHidden()
      await expect(sidebar.getByRole("navigation", { name: "Main navigation" }).getByRole("link")).toHaveText([
        "Platform overview",
      ])
      await expect(sidebar.getByRole("link", { name: "Platform overview" })).toHaveAttribute("aria-current", "page")
      await expect(sidebar.getByText("EventHub platform")).toBeVisible()
      await expect(sidebar.getByText("Account", { exact: true })).toBeVisible()
      await expect(sidebar.getByRole("button", { name: "Sign out" })).toBeVisible()
      await expect(sidebar.getByRole("radio", { name: "System" })).toBeVisible()
      await expect(sidebar.getByText(/My account|Organizations/)).toHaveCount(0)
      return
    }

    await expect(sidebar).toBeHidden()
    await expect(menuButton).toBeVisible()

    // Open: focus on the current nav item, drawer 304px (max 86vw), everything inside reachable.
    await menuButton.click()
    const drawer = page.getByRole("dialog", { name: "Menu" })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByRole("link", { name: "Platform overview" })).toBeFocused()
    const viewport = page.viewportSize() ?? { width: 0, height: 0 }
    // Wait for the 240ms slide-in to finish, then check the 304px (max 86vw) panel at the left edge.
    await expect.poll(async () => Math.round((await drawer.boundingBox())?.x ?? -1)).toBe(0)
    const box = await drawer.boundingBox()
    expect(Math.round(box?.width ?? 0)).toBe(Math.min(304, Math.floor(viewport.width * 0.86)))
    await expect(drawer.getByRole("button", { name: "Close menu" })).toBeVisible()
    await expect(drawer.getByRole("button", { name: "Sign out" })).toBeInViewport()
    await expect(drawer.getByRole("radio", { name: "Dark" })).toBeInViewport()
    await expect(drawer.getByText(/My account|Organizations/)).toHaveCount(0)
    // Main content is inert behind the drawer.
    expect(await page.locator("main").evaluate((el) => el.closest("[inert]") !== null)).toBe(true)
    expect(await smallTargets(page)).toEqual([])
    expect(await clippedElements(page)).toEqual([])
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    await expectNoSeriousA11yViolations(page)

    // Esc closes; focus returns to the menu button.
    await page.keyboard.press("Escape")
    await expect(drawer).toBeHidden()
    await expect(menuButton).toBeFocused()

    // Scrim tap closes.
    await menuButton.click()
    await expect(drawer).toBeVisible()
    await page.mouse.click(viewport.width - 8, Math.round(viewport.height / 2))
    await expect(drawer).toBeHidden()
    await expect(menuButton).toBeFocused()

    // Choosing a nav item closes it.
    await menuButton.click()
    await expect(drawer).toBeVisible()
    await drawer.getByRole("link", { name: "Platform overview" }).click()
    await expect(drawer).toBeHidden()
    await expect(page).toHaveURL(/\/platform$/)

    // "Close menu" closes it.
    await menuButton.click()
    await drawer.getByRole("button", { name: "Close menu" }).click()
    await expect(drawer).toBeHidden()
    await expect(menuButton).toBeFocused()
  })

  test("the user menu shows name + role and signs out to /login with the notice", async ({ page }) => {
    const api = await stubApi(page, { signedIn: true })
    await page.goto("/platform")
    await expect(page.getByRole("heading", { level: 1, name: "Platform overview" })).toBeVisible()

    const userButton = page.getByRole("button", { name: /Sara Admin/ })
    // Name and role are visible from 640px; below that only the 34px avatar (the name stays accessible).
    const wide = (page.viewportSize()?.width ?? 0) >= 640
    const buttonWidth = (await userButton.boundingBox())?.width ?? 0
    if (wide) {
      expect(buttonWidth).toBeGreaterThan(100)
    } else {
      expect(buttonWidth).toBeLessThanOrEqual(48)
    }

    // Keyboard open puts focus on the first item (Radix focuses the menu itself on pointer open).
    await userButton.focus()
    await page.keyboard.press("Enter")
    const menu = page.getByRole("menu")
    await expect(menu).toBeVisible()
    await expect(menu.getByText("Sara Admin")).toBeVisible()
    await expect(menu.getByText("System Administrator")).toBeVisible()
    await expect(menu.getByRole("menuitem")).toHaveText(["Sign out"])
    await expect(menu.getByRole("menuitem", { name: "Sign out" })).toBeFocused()
    expect(await smallTargets(page)).toEqual([])
    expect(await outsideViewport(page, "[role=menu]")).toEqual([])
    await expectNoSeriousA11yViolations(page)

    await page.keyboard.press("Escape")
    await expect(menu).toBeHidden()
    await expect(userButton).toBeFocused()

    await userButton.click()
    await page.getByRole("menuitem", { name: "Sign out" }).click()

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole("status").filter({ hasText: "You're signed out. See you soon." })).toBeVisible()
    expect(api.calls).toContain("POST /api/auth/logout")
    // The cleared session is re-checked and a fresh XSRF token fetched for the next sign-in.
    await expect.poll(() => api.calls.filter((call: string) => call === "GET /api/auth/antiforgery").length).toBeGreaterThanOrEqual(2)
    await expectNoSeriousA11yViolations(page)

    // Signed out: the protected route asks for sign-in again.
    await page.goto("/platform")
    await expect(page).toHaveURL(/\/login\?returnTo=%2Fplatform$/)
  })

  test("Sign out and the theme toggle stay reachable; the top-bar toggle switches the theme", async ({ page }) => {
    await stubApi(page, { signedIn: true })
    await page.goto("/platform")
    await expect(page.getByRole("heading", { level: 1, name: "Platform overview" })).toBeVisible()

    const topBar = page.locator("[data-slot=top-bar]")
    await topBar.getByRole("radio", { name: "Dark" }).click()
    await expect(page.locator("html")).toHaveClass(/\bdark\b/)
    await expectNoSeriousA11yViolations(page)
    await topBar.getByRole("radio", { name: "Light" }).click()
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/)
    await expectNoSeriousA11yViolations(page)

    if (!isDesktop(page)) {
      await page.getByRole("button", { name: "Open menu" }).click()
    }
    const container = isDesktop(page) ? page.locator("aside[data-slot=sidebar]") : page.getByRole("dialog", { name: "Menu" })
    const signOut = container.getByRole("button", { name: "Sign out" })
    await signOut.scrollIntoViewIfNeeded()
    await expect(signOut).toBeInViewport()
    await expect(container.getByRole("radiogroup", { name: "Theme" })).toBeVisible()
    await signOut.click()
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByText("You're signed out. See you soon.")).toBeVisible()
  })

  test("long text wraps and nothing clips at 200% text size, drawer included", async ({ page }) => {
    await stubApi(page, { signedIn: true })
    await page.goto("/platform")
    await expect(page.getByRole("heading", { level: 1, name: "Platform overview" })).toBeVisible()

    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%"
    })
    await expectCleanLayout(page)

    if (!isDesktop(page)) {
      await page.getByRole("button", { name: "Open menu" }).click()
      const drawer = page.getByRole("dialog", { name: "Menu" })
      await expect(drawer).toBeVisible()
      // Measure after the slide-in settles.
      await expect.poll(async () => Math.round((await drawer.boundingBox())?.x ?? -1)).toBe(0)
    }
    await expectCleanLayout(page)
  })

  test("wrong credentials show the error Alert, keep the email and focus the cleared password", async ({ page }) => {
    await stubApi(page)
    await page.goto("/login")

    await page.getByRole("textbox", { name: "Email" }).fill(STUB_EMAIL)
    await page.getByLabel("Password", { exact: true }).fill("wrong-password")
    await page.getByRole("button", { name: "Sign in" }).click()

    await expect(page.getByRole("alert")).toHaveText(
      "Email or password is incorrect. Check both and try again. After 5 tries, sign-in pauses for 15 minutes.",
    )
    await expect(page.getByRole("textbox", { name: "Email" })).toHaveValue(STUB_EMAIL)
    const password = page.getByLabel("Password", { exact: true })
    await expect(password).toHaveValue("")
    await expect(password).toBeFocused()
    await expect(page).toHaveURL(/\/login$/)
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    expect(await clippedElements(page)).toEqual([])
    await expectNoSeriousA11yViolations(page)
  })

  test("signed in, / and /login go to /platform; unknown URLs show Not found inside the shell", async ({ page }) => {
    await stubApi(page, { signedIn: true })

    await page.goto("/")
    await expect(page).toHaveURL(/\/platform$/)
    await page.goto("/login")
    await expect(page).toHaveURL(/\/platform$/)

    await page.goto("/no-such-page")
    await expect(page.getByRole("heading", { level: 2, name: "We couldn't find that" })).toBeVisible()
    await expect(page.getByRole("heading", { level: 1, name: "Page not found" })).toBeAttached()
    await expect(page).toHaveTitle("Not found · EventHub")
    await expect(page.locator("[data-slot=top-bar]")).toBeVisible()
    await expectCleanLayout(page)
    await expectNoSeriousA11yViolations(page)

    await page.getByRole("link", { name: "Go to home" }).click()
    await expect(page).toHaveURL(/\/platform$/)
  })

  test("a fresh signed-in load keeps focus for the skip link: first Tab, Enter focuses main", async ({
    page,
    browserName,
  }) => {
    await stubApi(page, { signedIn: true })
    await page.goto("/platform")
    const heading = page.getByRole("heading", { level: 1, name: "Platform overview" })
    await expect(heading).toBeVisible()
    await expect(heading).not.toBeFocused()

    const skip = page.getByRole("link", { name: "Skip to content" })
    if (browserName === "webkit") {
      // WebKit skips links on Tab unless "Press Tab to highlight each item" is on; check DOM order instead.
      expect(
        await page.evaluate(
          () => document.querySelector("a[href], button, input, [tabindex]:not([tabindex='-1'])")?.textContent,
        ),
      ).toBe("Skip to content")
      await skip.focus()
    } else {
      await page.keyboard.press("Tab")
    }
    await expect(skip).toBeFocused()
    await page.keyboard.press("Enter")
    await expect(page.locator("main#main")).toBeFocused()
  })

  test("the labelled theme toggle shows its labels in the sidebar or drawer at default text size", async ({ page }) => {
    await stubApi(page, { signedIn: true })
    await page.goto("/platform")
    await expect(page.getByRole("heading", { level: 1, name: "Platform overview" })).toBeVisible()

    let container: Locator
    if (isDesktop(page)) {
      container = page.locator("aside[data-slot=sidebar]")
    } else {
      await page.getByRole("button", { name: "Open menu" }).click()
      container = page.getByRole("dialog", { name: "Menu" })
      await expect.poll(async () => Math.round((await container.boundingBox())?.x ?? -1)).toBe(0)
    }
    for (const label of ["Light", "Dark", "System"]) {
      const text = container.getByRole("radio", { name: label }).getByText(label, { exact: true })
      await expect(text).toBeVisible()
      expect(((await text.boundingBox())?.width ?? 0) > 2).toBe(true)
    }
    expect(await clippedElements(page)).toEqual([])
  })

  test("growing past 1024px closes an open drawer and nothing stays inert", async ({ page }) => {
    test.skip(isDesktop(page), "the drawer exists below 1024px only")
    await stubApi(page, { signedIn: true })
    await page.goto("/platform")
    await expect(page.getByRole("heading", { level: 1, name: "Platform overview" })).toBeVisible()

    await page.getByRole("button", { name: "Open menu" }).click()
    await expect(page.getByRole("dialog", { name: "Menu" })).toBeVisible()

    await page.setViewportSize({ width: 1280, height: 800 })

    await expect(page.getByRole("dialog", { name: "Menu" })).toBeHidden()
    expect(await page.locator("main").evaluate((el) => el.closest("[inert]") === null)).toBe(true)
    await expect(page.locator("aside[data-slot=sidebar]")).toBeVisible()
  })

  test("a failed sign-out keeps the user in place with an error toast", async ({ page }) => {
    const api = await stubApi(page, { signedIn: true })
    api.failNextLogout = 500
    await page.goto("/platform")
    await expect(page.getByRole("heading", { level: 1, name: "Platform overview" })).toBeVisible()

    await page.getByRole("button", { name: /Sara Admin/ }).click()
    await page.getByRole("menuitem", { name: "Sign out" }).click()

    await expect(page.getByText("We couldn't sign you out. Try again.")).toBeVisible()
    await expect(page).toHaveURL(/\/platform$/)
    expect(api.signedIn).toBe(true)
  })
})
