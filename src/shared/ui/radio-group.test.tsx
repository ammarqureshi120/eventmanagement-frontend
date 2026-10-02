import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { RadioGroup, RadioGroupItem } from "./radio-group"

describe("RadioGroup", () => {
  it("chooses with a pointer and exposes radio semantics", async () => {
    const user = userEvent.setup()
    render(
      <RadioGroup aria-label="Plan" defaultValue="a">
        <RadioGroupItem value="a" aria-label="Plan A" />
        <RadioGroupItem value="b" aria-label="Plan B" />
      </RadioGroup>,
    )

    expect(screen.getByRole("radiogroup", { name: "Plan" })).toBeInTheDocument()
    expect(screen.getByRole("radio", { name: "Plan A" })).toBeChecked()
    await user.click(screen.getByRole("radio", { name: "Plan B" }))
    expect(screen.getByRole("radio", { name: "Plan B" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "Plan B" })).toHaveClass("after:-inset-3")
  })
})
