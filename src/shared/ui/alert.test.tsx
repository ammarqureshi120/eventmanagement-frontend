import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { Alert } from "./alert"

describe("Alert", () => {
  it("announces error summaries with role=alert", () => {
    render(<Alert tone="error" title="2 fields need a look">Nothing was saved yet.</Alert>)

    expect(screen.getByRole("alert")).toHaveTextContent("2 fields need a look")
  })

  it("announces success notices with role=status", () => {
    render(<Alert tone="success">Password updated.</Alert>)

    expect(screen.getByRole("status")).toHaveTextContent("Password updated.")
  })

  it.each(["info", "warning", "neutral"] as const)("renders the %s tone without a live role", (tone) => {
    const { container } = render(<Alert tone={tone}>Notice</Alert>)

    const alert = container.querySelector('[data-slot="alert"]')
    expect(alert).toHaveAttribute("data-tone", tone)
    expect(alert).not.toHaveAttribute("role")
    expect(alert?.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  })
})
