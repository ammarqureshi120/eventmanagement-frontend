import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { Field } from "./field"
import { Input } from "./input"
import { PasswordInput } from "./password-input"

describe("Field", () => {
  it("labels the control and links hint + error with aria-describedby / aria-invalid / aria-required", () => {
    render(
      <Field label="Email" hint="Your work address." error="Enter your email address." required>
        <Input type="email" />
      </Field>,
    )

    const input = screen.getByRole("textbox", { name: "Email" })
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAttribute("aria-required", "true")
    expect(input).toHaveAccessibleDescription("Your work address. Enter your email address.")

    const error = screen.getByText("Enter your email address.").closest("p")
    expect(error).toHaveClass("text-destructive")
    expect(error?.querySelector("svg")).not.toBeNull()
  })

  it("is valid and undescribed without hint or error, and marks optional fields", () => {
    render(
      <Field label="Phone" optional>
        <Input type="tel" />
      </Field>,
    )

    const input = screen.getByRole("textbox", { name: "Phone (optional)" })
    expect(input).not.toHaveAttribute("aria-invalid")
    expect(input).not.toHaveAttribute("aria-required")
    expect(input).not.toHaveAttribute("aria-describedby")
  })

  it("keeps explicit props on the control", () => {
    render(
      <>
        <p id="extra">Extra help</p>
        <Field label="Name" controlId="name-field" error="Required">
          <Input aria-describedby="extra" />
        </Field>
      </>,
    )

    const input = screen.getByRole("textbox", { name: "Name" })
    expect(input).toHaveAttribute("id", "name-field")
    expect(input).toHaveAccessibleDescription("Extra help Required")
  })

  it("wires the password input and toggles visibility with an aria-pressed button", async () => {
    const user = userEvent.setup()
    render(
      <Field label="Password" error="Enter your password.">
        <PasswordInput autoComplete="current-password" />
      </Field>,
    )

    const input = screen.getByLabelText("Password")
    expect(input).toHaveAttribute("type", "password")
    expect(input).toHaveAttribute("aria-invalid", "true")
    expect(input).toHaveAccessibleDescription("Enter your password.")

    const toggle = screen.getByRole("button", { name: "Show password" })
    expect(toggle).toHaveAttribute("aria-pressed", "false")
    await user.click(toggle)

    expect(input).toHaveAttribute("type", "text")
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true")
  })
})
