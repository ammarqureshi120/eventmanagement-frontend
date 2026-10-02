import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createStore } from "@/app/store"

import { LoginPage } from "./login-page"

function renderLogin() {
  const router = createMemoryRouter([{ path: "/login", Component: LoginPage }], { initialEntries: ["/login"] })
  return render(
    <Provider store={createStore()}>
      <RouterProvider router={router} />
    </Provider>,
  )
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    localStorage.clear()
    document.documentElement.classList.remove("dark")
  })

  it("restores the previous document title on unmount", async () => {
    document.title = "Before"
    const { unmount } = renderLogin()
    await screen.findByRole("heading", { level: 1, name: "Sign in" })
    expect(document.title).toBe("Sign in · EventHub")

    unmount()

    expect(document.title).toBe("Before")
  })

  it("renders the Auth card: one H1, fields, forgot link, sign-in button, skip link first, title", async () => {
    renderLogin()

    expect(await screen.findByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument()
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(document.title).toBe("Sign in · EventHub")
    expect(screen.getByText("EventHub")).toBeInTheDocument()

    const email = screen.getByRole("textbox", { name: "Email" })
    expect(email).toHaveAttribute("type", "email")
    expect(email).toHaveAttribute("autocomplete", "email")
    const password = screen.getByLabelText("Password")
    expect(password).toHaveAttribute("type", "password")
    expect(password).toHaveAttribute("autocomplete", "current-password")

    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password")
    expect(screen.getByRole("button", { name: "Sign in" })).toHaveAttribute("type", "submit")
    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument()

    const user = userEvent.setup()
    await user.tab()
    expect(screen.getByRole("link", { name: "Skip to content" })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(screen.getByRole("main")).toHaveFocus()
  })

  it("shows inline errors for empty fields and focuses the first invalid field", async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(await screen.findByRole("button", { name: "Sign in" }))

    const email = screen.getByRole("textbox", { name: "Email" })
    expect(email).toHaveAttribute("aria-invalid", "true")
    expect(email).toHaveAccessibleDescription("Enter your email address.")
    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription("Enter your password.")
    expect(email).toHaveFocus()
  })

  it("rejects a malformed email", async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(await screen.findByRole("textbox", { name: "Email" }), "sara@")
    await user.type(screen.getByLabelText("Password"), "secret")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    expect(screen.getByRole("textbox", { name: "Email" })).toHaveAccessibleDescription(
      "Enter an email like name@company.com.",
    )
    expect(screen.getByLabelText("Password")).not.toHaveAttribute("aria-invalid")
  })

  it("does nothing visible (and calls no API) for valid input", async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(await screen.findByRole("textbox", { name: "Email" }), "sara@example.test")
    await user.type(screen.getByLabelText("Password"), "secret")
    await user.click(screen.getByRole("button", { name: "Sign in" }))

    // MSW fails the test on any unhandled request, so reaching here proves no API call was made.
    expect(screen.queryByText(/^Enter /)).not.toBeInTheDocument()
    expect(screen.getByRole("textbox", { name: "Email" })).not.toHaveAttribute("aria-invalid")
  })
})
