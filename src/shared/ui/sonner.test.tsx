import { act, render, screen } from "@testing-library/react"
import { toast } from "sonner"
import { afterEach, describe, expect, it, vi } from "vitest"

import { Toaster } from "./sonner"

describe("Toaster", () => {
  afterEach(() => {
    act(() => {
      toast.dismiss()
    })
  })

  it("renders toasts bottom-right in a polite live region with a tone, title, description and dismiss button", async () => {
    render(<Toaster />)

    act(() => {
      toast.success("Invite sent", { description: "We sent an invite to john.smith@example.test." })
    })

    const item = (await screen.findByText("Invite sent")).closest("[data-sonner-toast]")
    expect(item).toHaveAttribute("data-type", "success")
    expect(item).toHaveAttribute("data-y-position", "bottom")
    expect(item).toHaveAttribute("data-x-position", "right")
    expect(item).toHaveClass("border-l-3", "data-[type=success]:border-l-success")
    expect(screen.getByText(/We sent an invite/)).toHaveClass("text-muted-foreground")
    expect(screen.getByRole("button", { name: "Dismiss notification" })).toHaveClass("size-touch")
    expect(screen.getByRole("region")).toHaveAttribute("aria-live", "polite")
  })

  it("shows at most 3 toasts", async () => {
    render(<Toaster />)

    act(() => {
      for (const n of [1, 2, 3, 4]) {
        toast(`Toast ${n}`)
      }
    })

    await screen.findByText("Toast 4")
    const visible = document.querySelectorAll('[data-sonner-toast][data-visible="true"]')
    expect(visible).toHaveLength(3)
  })

  describe("pause on keyboard focus", () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    function renderWithToast() {
      vi.useFakeTimers()
      render(
        <>
          <button type="button">Outside</button>
          <Toaster />
        </>,
      )
      act(() => {
        toast("Saved", { description: "All good." })
      })
      act(() => {
        vi.advanceTimersByTime(100)
      })
      return screen.getByRole("button", { name: "Dismiss notification" })
    }

    it("stays while a toast has focus, then auto-dismisses after the duration once focus leaves", () => {
      const dismiss = renderWithToast()

      act(() => dismiss.focus())
      act(() => {
        vi.advanceTimersByTime(8000)
      })
      expect(screen.getByText("Saved")).toBeInTheDocument()

      act(() => screen.getByRole("button", { name: "Outside" }).focus())
      act(() => {
        vi.advanceTimersByTime(6500 + 1000)
      })
      expect(screen.queryByText("Saved")).not.toBeInTheDocument()
    })

    it("auto-dismisses after 6.5s when nothing is focused", () => {
      renderWithToast()

      act(() => {
        vi.advanceTimersByTime(6500 + 1000)
      })

      expect(screen.queryByText("Saved")).not.toBeInTheDocument()
    })

    it("releases the pause when the focused toast is removed", () => {
      const dismiss = renderWithToast()
      act(() => dismiss.focus())

      act(() => {
        toast.dismiss()
        vi.advanceTimersByTime(1000)
      })
      act(() => {
        toast("Next one")
      })
      act(() => {
        vi.advanceTimersByTime(6500 + 1000)
      })

      expect(screen.queryByText("Next one")).not.toBeInTheDocument()
    })
  })
})
