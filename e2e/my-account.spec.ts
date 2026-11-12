import { expect, test, type Page } from "@playwright/test"

import { STUB_EMAIL, STUB_MESSAGES, STUB_PASSWORD, stubApi } from "./fixtures/api-stub.ts"
import {
  clippedElements,
  expectNoA11yViolations,
  expectNoSeriousA11yViolations,
  horizontalOverflow,
  outsideViewport,
  smallTargets,
} from "./fixtures/checks.ts"

/**
 * Story 1.7b My account on every DEVICE_MATRIX project (6 devices × light/dark), against the API stub: opening
 * `/profile` from the sidebar/drawer and the user menu, saving (twice, no self-inflicted 409), client and server
 * validation with the summary Alert, the 409 conflict with "Reload details", the password change (OK, wrong current,
 * weak/mismatch), offline, and the matrix checks (overflow, clipping, 44px targets, keyboard covering fields, long
 * names wrapping, 200% text, axe).
 * Not emulable here (reported as not verified): real notch insets, the real on-screen keyboard, OS font scale,
 * real Safari (WebKit stands in).
 */

const isDesktop = (page: Page) => (page.viewportSize()?.width ?? 0) >= 1024
const isPhone = (page: Page) => (page.viewportSize()?.width ?? 0) < 768

const CONFLICT = "Someone else changed your details. Reload to see the latest — nothing was saved."
const MISMATCH = "This doesn't match the password above. Type it again."
const OFFLINE = "You seem to be offline. Check your connection and try again."
const NEW_PASSWORD = "Fresh-passw0rd"
/** A long Dutch-style name (spaces and a hyphenated part) to prove wrapping. */
const LONG_FIRST = "Maximiliaan-Alexander Johannes"
const LONG_LAST = "van der Westhuizen-Oosterhout tot Rijnsburg"

async function expectCleanLayout(page: Page, options: { ignoreInputs?: boolean } = {}) {
  expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
  const clipped = await clippedElements(page)
  // A text input scrolls its own value sideways by design (a long name); everything else must wrap.
  expect(options.ignoreInputs ? clipped.filter((entry) => !entry.startsWith("input ")) : clipped).toEqual([])
  expect(await smallTargets(page)).toEqual([])
}

const profile = (page: Page) => page.getByRole("region", { name: "Profile" })
const passwordCard = (page: Page) => page.getByRole("region", { name: "Change password" })
const textbox = (page: Page, name: string) => profile(page).getByRole("textbox", { name, exact: false })
const saveButton = (page: Page) => profile(page).getByRole("button", { name: "Save changes" })
const passwordField = (page: Page, label: string) => passwordCard(page).getByLabel(label, { exact: true })

async function openProfile(page: Page) {
  await page.goto("/profile")
  await expect(page.getByRole("heading", { level: 1, name: "My account" })).toBeVisible()
}

/** Sign in at `/login`, then land on My account. */
async function signInToProfile(page: Page) {
  await page.goto("/login?returnTo=%2Fprofile")
  await page.getByRole("textbox", { name: "Email" }).fill(STUB_EMAIL)
  await page.getByLabel("Password", { exact: true }).fill(STUB_PASSWORD)
  await page.getByRole("button", { name: "Sign in" }).click()
  await expect(page).toHaveURL(/\/profile$/)
}

test.describe("My account", () => {
  test("opens from the sidebar or drawer: H1 focused, both cards, read-only email/role/status, clean layout", async ({
    page,
  }) => {
    await stubApi(page, { signedIn: true, me: { phone: "+92 300 1234567" } })
    await page.goto("/platform")
    await expect(page.getByRole("heading", { level: 1, name: "Platform overview" })).toBeVisible()

    if (isDesktop(page)) {
      await page.locator("aside[data-slot=sidebar]").getByRole("link", { name: "My account" }).click()
    } else {
      await page.getByRole("button", { name: "Open menu" }).click()
      const drawer = page.getByRole("dialog", { name: "Menu" })
      await drawer.getByRole("link", { name: "My account" }).click()
      await expect(drawer).toBeHidden()
    }

    await expect(page).toHaveURL(/\/profile$/)
    const heading = page.getByRole("heading", { level: 1, name: "My account" })
    await expect(heading).toBeFocused()
    await expect(page).toHaveTitle("My account · EventHub")
    await expect(page.getByText("Your details and password.")).toBeVisible()
    await expect(profile(page)).toBeVisible()
    await expect(passwordCard(page)).toBeVisible()

    await expect(textbox(page, "First name")).toHaveValue("Sara")
    await expect(textbox(page, "Phone")).toHaveValue("+92 300 1234567")
    const email = textbox(page, "Email")
    await expect(email).toHaveValue(STUB_EMAIL)
    await expect(email).toHaveAttribute("readonly", "")
    await expect(page.getByText("Your email is your sign-in and can't be changed.")).toBeVisible()
    await expect(textbox(page, "Role")).toHaveValue("System Administrator")
    await expect(textbox(page, "Status")).toHaveValue("Active")

    // Cards stack in one column; on desktop the content stays within 880px with a 2-column field grid.
    const profileBox = (await profile(page).boundingBox())!
    const passwordBox = (await passwordCard(page).boundingBox())!
    expect(passwordBox.y).toBeGreaterThan(profileBox.y + profileBox.height - 1)
    expect(Math.round(passwordBox.x)).toBe(Math.round(profileBox.x))
    expect(profileBox.width).toBeLessThanOrEqual(880)
    const first = (await textbox(page, "First name").boundingBox())!
    const last = (await textbox(page, "Last name").boundingBox())!
    if (isPhone(page)) {
      expect(last.y).toBeGreaterThan(first.y)
    } else {
      expect(Math.round(last.y)).toBe(Math.round(first.y))
    }

    await expectCleanLayout(page)
    expect(await outsideViewport(page, "main input, main button")).toEqual([])
    await expectNoA11yViolations(page)
  })

  test("opens from the user menu", async ({ page }) => {
    await stubApi(page, { signedIn: true })
    await page.goto("/platform")
    await page.getByRole("button", { name: /Sara Admin/ }).click()
    await page.getByRole("menuitem", { name: "My account" }).click()

    await expect(page).toHaveURL(/\/profile$/)
    await expect(page.getByRole("heading", { level: 1, name: "My account" })).toBeFocused()
    await expect(page.getByRole("menu")).toBeHidden()
  })

  test("saves twice with the refetched version: toast, the user button shows the new name, no conflict", async ({
    page,
  }) => {
    const api = await stubApi(page)
    await signInToProfile(page)

    await textbox(page, "First name").fill("Sarah")
    await textbox(page, "Phone").fill("+92 (300) 123-4567")
    await saveButton(page).click()

    await expect(page.getByText("Profile saved")).toBeVisible()
    await expect(page.getByText("Your details are updated.")).toBeVisible()
    await expect(page.getByRole("button", { name: /Sarah Admin/ })).toBeVisible()
    expect(api.profileBodies).toEqual([{ firstName: "Sarah", lastName: "Admin", phone: "+92 (300) 123-4567", version: 1 }])
    await expectCleanLayout(page)
    await expectNoSeriousA11yViolations(page)

    await textbox(page, "Last name").fill("Khan")
    await saveButton(page).click()
    await expect(page.getByRole("button", { name: /Sarah Khan/ })).toBeVisible()
    expect(api.profileBodies[1]).toEqual({ firstName: "Sarah", lastName: "Khan", phone: "+92 (300) 123-4567", version: 2 })
    await expect(page.getByText(CONFLICT)).toHaveCount(0)
    expect(api.me.version).toBe(3)
  })

  test("invalid input: field messages, the summary Alert, focus on First name, no request; server validation too", async ({
    page,
  }) => {
    const api = await stubApi(page, { signedIn: true })
    await openProfile(page)

    await textbox(page, "First name").fill("")
    await textbox(page, "Phone").fill("12ab")
    await saveButton(page).click()

    const summary = profile(page).getByRole("alert")
    await expect(summary).toContainText("2 fields need a look. The messages below say what to change.")
    await expect(summary).toContainText("Nothing was saved yet.")
    await expect(page.getByText(STUB_MESSAGES.firstNameRequired)).toBeVisible()
    await expect(page.getByText(STUB_MESSAGES.phoneInvalid)).toBeVisible()
    await expect(textbox(page, "First name")).toBeFocused()
    await expect(textbox(page, "Phone")).toHaveValue("12ab")
    expect(api.profileBodies).toEqual([])
    await expectCleanLayout(page)
    await expectNoSeriousA11yViolations(page)

    // The same display for the server's `validation` (here forced, with valid-looking input).
    await textbox(page, "First name").fill("Sara")
    await textbox(page, "Phone").fill("0300 1234567")
    api.nextProfileProblem = {
      status: 400,
      code: "validation",
      errors: { lastName: [STUB_MESSAGES.lastNameRequired], phone: [STUB_MESSAGES.phoneTooLong] },
    }
    await saveButton(page).click()
    await expect(profile(page).getByRole("alert")).toContainText("2 fields need a look.")
    await expect(textbox(page, "Last name")).toBeFocused()
    await expect(textbox(page, "Phone")).toHaveValue("0300 1234567")
  })

  test("409: the conflict Alert keeps the inputs; Reload details resets to the server values", async ({ page }) => {
    const api = await stubApi(page, { signedIn: true })
    await openProfile(page)
    // Another tab saved meanwhile.
    api.me = { ...api.me, firstName: "Sally", version: 2 }

    await textbox(page, "Phone").fill("0300 1234567")
    await saveButton(page).click()

    const alert = profile(page).getByRole("alert")
    await expect(alert).toContainText(CONFLICT)
    await expect(textbox(page, "Phone")).toHaveValue("0300 1234567")
    await expect(textbox(page, "First name")).toHaveValue("Sara")
    await expectCleanLayout(page)
    await expectNoSeriousA11yViolations(page)

    await alert.getByRole("button", { name: "Reload details" }).click()
    await expect(textbox(page, "First name")).toHaveValue("Sally")
    await expect(textbox(page, "Phone")).toHaveValue("")
    await expect(page.getByText(CONFLICT)).toHaveCount(0)

    await textbox(page, "Phone").fill("0300 1234567")
    await saveButton(page).click()
    await expect(page.getByText("Profile saved")).toBeVisible()
    expect(api.profileBodies.at(-1)).toMatchObject({ firstName: "Sally", version: 2 })
  })

  test("change password: toast, fields cleared, still signed in, Me refetched", async ({ page }) => {
    const api = await stubApi(page)
    await signInToProfile(page)
    const meCallsBefore = api.calls.filter((call) => call === "GET /api/me").length

    await passwordField(page, "Current password").fill(STUB_PASSWORD)
    await passwordField(page, "New password").fill(NEW_PASSWORD)
    await passwordField(page, "Confirm new password").fill(NEW_PASSWORD)
    await passwordCard(page).getByRole("button", { name: "Change password" }).click()

    await expect(page.getByText("Password updated")).toBeVisible()
    await expect(page.getByText("Other devices were signed out.")).toBeVisible()
    for (const label of ["Current password", "New password", "Confirm new password"]) {
      await expect(passwordField(page, label)).toHaveValue("")
    }
    expect(api.passwordBodies).toEqual([{ currentPassword: STUB_PASSWORD, newPassword: NEW_PASSWORD }])
    await expect.poll(() => api.calls.filter((call) => call === "GET /api/me").length).toBeGreaterThan(meCallsBefore)
    await expectCleanLayout(page)
    await expectNoSeriousA11yViolations(page)

    // Still signed in, and the profile follows the bumped version.
    await textbox(page, "Phone").fill("0300 1234567")
    await saveButton(page).click()
    await expect(page.getByText("Profile saved")).toBeVisible()
    expect(api.profileBodies).toEqual([{ firstName: "Sara", lastName: "Admin", phone: "0300 1234567", version: 2 }])
    await page.goto("/platform")
    await expect(page.getByRole("heading", { level: 1, name: "Platform overview" })).toBeVisible()
  })

  test("wrong current password: message under Current password, nothing cleared", async ({ page }) => {
    const api = await stubApi(page, { signedIn: true })
    await openProfile(page)

    await passwordField(page, "Current password").fill("not-the-password-1")
    await passwordField(page, "New password").fill(NEW_PASSWORD)
    await passwordField(page, "Confirm new password").fill(NEW_PASSWORD)
    await passwordCard(page).getByRole("button", { name: "Change password" }).click()

    await expect(page.getByText(STUB_MESSAGES.currentWrong)).toBeVisible()
    await expect(passwordField(page, "Current password")).toHaveAttribute("aria-invalid", "true")
    await expect(passwordField(page, "Current password")).toBeFocused()
    await expect(passwordField(page, "Current password")).toHaveValue("not-the-password-1")
    await expect(passwordField(page, "New password")).toHaveValue(NEW_PASSWORD)
    expect(api.password).toBe(STUB_PASSWORD)
    await expectCleanLayout(page)
    await expectNoSeriousA11yViolations(page)
  })

  test("weak or mismatched new password: the checklist, the mismatch message, no request", async ({ page }) => {
    const api = await stubApi(page, { signedIn: true })
    await openProfile(page)

    await passwordField(page, "Current password").fill(STUB_PASSWORD)
    await passwordField(page, "New password").pressSequentially("abc")
    await expect(passwordCard(page).getByRole("list", { name: "Password rules" }).getByRole("listitem")).toHaveText([
      "8+ characters: not yet",
      "A letter: done",
      "A number: not yet",
    ])
    await passwordField(page, "Confirm new password").pressSequentially("abd")
    await expect(page.getByText(MISMATCH)).toBeVisible()
    await passwordCard(page).getByRole("button", { name: "Change password" }).click()

    await expect(passwordCard(page).getByRole("alert")).toContainText("2 fields need a look.")
    await expect(page.getByText("Use at least 8 characters.")).toBeVisible()
    await expect(passwordField(page, "New password")).toBeFocused()
    expect(api.passwordBodies).toEqual([])
    await expectCleanLayout(page)
    await expectNoSeriousA11yViolations(page)
  })

  test("offline: the offline toast, inputs kept", async ({ page }) => {
    await stubApi(page, { signedIn: true })
    await openProfile(page)
    // Registered after the stub, so it wins for these two paths.
    await page.route("**/api/me/profile", (route) => route.abort("internetdisconnected"))
    await page.route("**/api/me/change-password", (route) => route.abort("internetdisconnected"))

    await textbox(page, "Phone").fill("0300 1234567")
    await saveButton(page).click()
    await expect(page.getByText(OFFLINE)).toBeVisible()
    await expect(textbox(page, "Phone")).toHaveValue("0300 1234567")
    // On phones the full-width toast sits over the bottom of the page: dismiss it before the next tap.
    await page.getByRole("button", { name: "Dismiss notification" }).click()
    await expect(page.getByText(OFFLINE)).toHaveCount(0)

    await passwordField(page, "Current password").fill(STUB_PASSWORD)
    await passwordField(page, "New password").fill(NEW_PASSWORD)
    await passwordField(page, "Confirm new password").fill(NEW_PASSWORD)
    await passwordCard(page).getByRole("button", { name: "Change password" }).click()
    await expect(page.getByText(OFFLINE)).toBeVisible()
    await expect(passwordField(page, "New password")).toHaveValue(NEW_PASSWORD)
  })

  test("fields stay in view with the on-screen keyboard; long names wrap; nothing clips at 200% text", async ({ page }) => {
    await stubApi(page, { signedIn: true, me: { firstName: LONG_FIRST, lastName: LONG_LAST } })
    const viewport = page.viewportSize() ?? { width: 0, height: 0 }
    await openProfile(page)

    // Approximation: shrink the viewport the way an on-screen keyboard does, then focus each field.
    await page.setViewportSize({ width: viewport.width, height: Math.round(viewport.height * 0.5) })
    const fields = [
      textbox(page, "First name"),
      textbox(page, "Last name"),
      textbox(page, "Phone"),
      passwordField(page, "Current password"),
      passwordField(page, "New password"),
      passwordField(page, "Confirm new password"),
    ]
    for (const field of fields) {
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

    // The long name wraps in the user button and in the user menu.
    await expectCleanLayout(page, { ignoreInputs: true })
    const userButton = page.getByRole("button", { name: new RegExp(LONG_FIRST) })
    expect(await outsideViewport(page, "[data-slot=top-bar] button, [data-slot=top-bar] [role=radio]")).toEqual([])
    await userButton.click()
    await expect(page.getByRole("menu")).toBeVisible()
    expect(await outsideViewport(page, "[role=menu]")).toEqual([])
    await expectCleanLayout(page, { ignoreInputs: true })
    await page.keyboard.press("Escape")

    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%"
    })
    await textbox(page, "First name").fill("")
    await textbox(page, "Phone").fill("12ab")
    await saveButton(page).click()
    await expect(profile(page).getByRole("alert")).toBeVisible()
    await passwordField(page, "New password").fill("abc")
    await passwordField(page, "Confirm new password").fill("abd")
    await passwordCard(page).getByRole("button", { name: "Change password" }).click()
    await expect(page.getByText(MISMATCH)).toBeVisible()
    await expectCleanLayout(page, { ignoreInputs: true })
  })
})
