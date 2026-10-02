import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Provider } from "react-redux"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createStore } from "@/app/store"

import { ThemeToggle } from "./theme-toggle"

function renderToggle(variant?: "labelled" | "icon") {
  return render(
    <Provider store={createStore()}>
      <ThemeToggle variant={variant} />
    </Provider>,
  )
}

describe("ThemeToggle", () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove("dark")
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    )
  })
  afterEach(() => vi.unstubAllGlobals())

  it("is a labelled radio group with Light, Dark and System, System checked by default", () => {
    renderToggle()

    expect(screen.getByRole("radiogroup", { name: "Theme" })).toBeInTheDocument()
    expect(screen.getAllByRole("radio").map((r) => r.textContent)).toEqual(["Light", "Dark", "System"])
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked()
  })

  it("keeps screen-reader labels when icon-only", () => {
    renderToggle("icon")

    for (const name of ["Light", "Dark", "System"]) {
      expect(screen.getByRole("radio", { name })).toBeInTheDocument()
      expect(screen.getByText(name)).toHaveClass("sr-only")
    }
  })

  it("chooses with a pointer: applies and saves", async () => {
    const user = userEvent.setup()
    renderToggle()

    await user.click(screen.getByRole("radio", { name: "Dark" }))

    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked()
    expect(document.documentElement).toHaveClass("dark")
    expect(localStorage.getItem("eventhub-theme")).toBe("dark")
  })

  /** Press and hold, then release: Radix checks the segment that receives focus while the arrow key is down. */
  async function arrow(user: ReturnType<typeof userEvent.setup>, key: "ArrowLeft" | "ArrowRight") {
    await user.keyboard(`{${key}>}`)
    await user.keyboard(`{/${key}}`)
  }

  it("moves and chooses with arrow keys (roving focus, wraps around)", async () => {
    const user = userEvent.setup()
    renderToggle("icon")

    await user.tab()
    expect(screen.getByRole("radio", { name: "System" })).toHaveFocus()

    await arrow(user, "ArrowLeft")
    expect(screen.getByRole("radio", { name: "Dark" })).toHaveFocus()
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked()
    expect(document.documentElement).toHaveClass("dark")

    await arrow(user, "ArrowLeft")
    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked()
    expect(localStorage.getItem("eventhub-theme")).toBe("light")
    expect(document.documentElement).not.toHaveClass("dark")

    await arrow(user, "ArrowLeft")
    expect(screen.getByRole("radio", { name: "System" })).toBeChecked()
  })

  it("ignores arrow keys with modifiers", async () => {
    const user = userEvent.setup()
    renderToggle("icon")

    await user.tab()
    for (const combo of ["{Alt>}{ArrowLeft}{/Alt}", "{Control>}{ArrowLeft}{/Control}", "{Meta>}{ArrowLeft}{/Meta}", "{Shift>}{ArrowLeft}{/Shift}"]) {
      await user.keyboard(combo)
    }

    expect(screen.getByRole("radio", { name: "System" })).toBeChecked()
    expect(localStorage.getItem("eventhub-theme")).toBeNull()
  })

  it("ignores arrow keys from an element that is not a segment", () => {
    renderToggle("icon")
    const group = screen.getByRole("radiogroup", { name: "Theme" })

    fireEvent.keyDown(group, { key: "ArrowRight" })

    expect(screen.getByRole("radio", { name: "System" })).toBeChecked()
    expect(localStorage.getItem("eventhub-theme")).toBeNull()
  })

  it("applies an arrow press once (no repeat dispatch of the same value)", async () => {
    const user = userEvent.setup()
    const setItem = vi.spyOn(Storage.prototype, "setItem")
    renderToggle("icon")

    await user.tab()
    await arrow(user, "ArrowRight")

    expect(screen.getByRole("radio", { name: "Light" })).toBeChecked()
    expect(setItem.mock.calls.filter(([key]) => key === "eventhub-theme")).toEqual([["eventhub-theme", "light"]])
  })
})
