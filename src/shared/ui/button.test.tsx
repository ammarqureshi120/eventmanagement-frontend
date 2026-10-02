import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import { Button } from "./button"

describe("Button", () => {
  it("defaults to the 44px primary button", () => {
    render(<Button>Save</Button>)

    const button = screen.getByRole("button", { name: "Save" })
    expect(button).toHaveClass("bg-primary", "min-h-control")
    expect(button).not.toHaveAttribute("aria-busy")
  })

  it("gives 36px buttons an invisible 44px hit area", () => {
    render(<Button size="sm">Small</Button>)

    expect(screen.getByRole("button", { name: "Small" })).toHaveClass("min-h-control-sm", "after:absolute", "after:-inset-1")
  })

  it("loading: spinner + Working…, aria-busy, focus kept, repeated clicks ignored", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    const { rerender } = render(
      <form onSubmit={onSubmit}>
        <Button type="submit" onClick={onClick}>
          Save changes
        </Button>
      </form>,
    )
    const button = screen.getByRole("button", { name: "Save changes" })
    button.focus()

    rerender(
      <form onSubmit={onSubmit}>
        <Button type="submit" onClick={onClick} loading>
          Save changes
        </Button>
      </form>,
    )

    expect(button).toHaveAttribute("aria-busy", "true")
    expect(button).toHaveAttribute("aria-disabled", "true")
    expect(button).not.toBeDisabled()
    expect(button).toHaveFocus()
    expect(button.querySelector('[data-slot="spinner"]')).not.toBeNull()
    expect(screen.getByText("Working…")).toBeInTheDocument()

    await user.click(button)
    await user.click(button)
    await user.keyboard("{Enter}")

    expect(onClick).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it("locks the width: label and loading layers always share one grid cell", () => {
    const { rerender } = render(<Button>Go</Button>)
    const label = screen.getByText("Go")
    const loading = screen.getByText("Working…")

    // Idle: loading layer present but invisible, so the button is already as wide as "Working…".
    expect(label.closest('[data-slot="button-label"]')).not.toHaveClass("invisible")
    expect(loading.closest('[data-slot="button-loading"]')).toHaveClass("invisible", "col-start-1", "row-start-1")

    rerender(<Button loading>Go</Button>)

    expect(label.closest('[data-slot="button-label"]')).toHaveClass("invisible", "col-start-1", "row-start-1")
    expect(loading.closest('[data-slot="button-loading"]')).not.toHaveClass("invisible")
  })

  it("runs the handler when not loading", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)

    await user.click(screen.getByRole("button", { name: "Go" }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it.each(["primary", "secondary", "outline", "ghost", "destructive", "destructive-soft", "link"] as const)(
    "renders the %s variant",
    (variant) => {
      render(<Button variant={variant}>{variant}</Button>)
      expect(screen.getByRole("button", { name: variant })).toBeInTheDocument()
    },
  )

  it("renders a child element with button styling via asChild", () => {
    render(
      <Button asChild variant="link">
        <a href="/forgot-password">Forgot password?</a>
      </Button>,
    )

    const link = screen.getByRole("link", { name: "Forgot password?" })
    expect(link).toHaveAttribute("data-slot", "button")
    expect(link).toHaveClass("text-primary")
  })

  it("passes the caller's onClick through asChild to the child", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn((event: React.MouseEvent) => event.preventDefault())
    render(
      <Button asChild variant="link" onClick={onClick}>
        <a href="/forgot-password">Forgot password?</a>
      </Button>,
    )

    await user.click(screen.getByRole("link", { name: "Forgot password?" }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("swallows clicks and submits when aria-disabled is set (not loading), also via asChild", async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault())
    render(
      <>
        <form onSubmit={onSubmit}>
          <Button type="submit" aria-disabled="true" onClick={onClick}>
            Save
          </Button>
        </form>
        <Button asChild aria-disabled onClick={onClick}>
          <a href="/somewhere">Somewhere</a>
        </Button>
      </>,
    )

    const button = screen.getByRole("button", { name: "Save" })
    expect(button).toHaveAttribute("aria-disabled", "true")
    await user.click(button)
    const link = screen.getByRole("link", { name: "Somewhere" })
    expect(link).toHaveAttribute("aria-disabled", "true")
    await user.click(link)

    expect(onClick).not.toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
