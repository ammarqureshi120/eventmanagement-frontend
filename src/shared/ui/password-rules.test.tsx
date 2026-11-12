import { render, screen, within } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PasswordRules } from "./password-rules"

function rows() {
  return within(screen.getByRole("list", { name: "Password rules" })).getAllByRole("listitem")
}

describe("PasswordRules", () => {
  it("shows three rows, all 'not yet' for an empty password; the list itself is not live", () => {
    render(<PasswordRules id="rules" password="" />)

    const list = screen.getByRole("list", { name: "Password rules" })
    expect(list).not.toHaveAttribute("aria-live")
    expect(list.closest("[aria-live]")).toBeNull()
    expect(rows().map((row) => row.textContent)).toEqual([
      "8+ characters: not yet",
      "A letter: not yet",
      "A number: not yet",
    ])
    expect(document.getElementById("rules")).toContainElement(list)
  })

  it("ticks rules live: 'abc1' → 8+ not yet, letter done, number done", () => {
    const { rerender } = render(<PasswordRules password="abc1" />)

    expect(rows().map((row) => row.textContent)).toEqual([
      "8+ characters: not yet",
      "A letter: done",
      "A number: done",
    ])
    const [length, letter] = rows()
    expect(length).not.toHaveAttribute("data-met")
    expect(length).toHaveClass("text-muted-foreground")
    expect(letter).toHaveAttribute("data-met", "true")
    expect(letter).toHaveClass("text-success")

    rerender(<PasswordRules password="abcdefg1" />)
    expect(rows().every((row) => row.textContent?.endsWith(": done"))).toBe(true)
  })

  it("announces only the rules whose state changed, in one hidden polite region outside the described element", () => {
    const { container, rerender } = render(<PasswordRules id="rules" password="" />)
    const status = container.querySelector('[data-slot="password-rules-status"]')
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(status).toHaveClass("sr-only")
    expect(document.getElementById("rules")).not.toContainElement(status as HTMLElement)
    // Nothing on first render.
    expect(status).toHaveTextContent("")

    rerender(<PasswordRules id="rules" password="a" />)
    expect(status).toHaveTextContent(/^A letter: done$/)

    // A keystroke that changes no rule leaves the last announcement alone (no re-read).
    rerender(<PasswordRules id="rules" password="ab" />)
    expect(status).toHaveTextContent(/^A letter: done$/)

    rerender(<PasswordRules id="rules" password="abcdefg1" />)
    expect(status).toHaveTextContent(/^8\+ characters: done\. A number: done$/)

    rerender(<PasswordRules id="rules" password="abcdefg" />)
    expect(status).toHaveTextContent(/^8\+ characters: not yet\. A number: not yet$/)
  })

  it("hides the tick circles from assistive tech", () => {
    const { container } = render(<PasswordRules password="a" />)

    for (const circle of container.querySelectorAll("li > span:first-child")) {
      expect(circle).toHaveAttribute("aria-hidden", "true")
    }
  })
})
