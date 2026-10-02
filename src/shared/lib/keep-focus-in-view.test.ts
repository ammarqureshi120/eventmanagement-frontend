import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { keepFocusedFieldInView } from "./keep-focus-in-view"

describe("keepFocusedFieldInView", () => {
  let cleanup: (() => void) | undefined
  const scrollIntoView = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    Element.prototype.scrollIntoView = scrollIntoView
    scrollIntoView.mockClear()
  })
  afterEach(() => {
    cleanup?.()
    cleanup = undefined
    vi.unstubAllGlobals()
    vi.useRealTimers()
    document.body.innerHTML = ""
  })

  function install() {
    cleanup = keepFocusedFieldInView()
  }

  /** Renders `html`, makes its first element report the given rect and focuses it. */
  function focusFieldAt(top: number, bottom: number, html = "<input />") {
    document.body.innerHTML = html
    const el = document.body.firstElementChild as HTMLElement
    el.getBoundingClientRect = () => ({ top, bottom }) as DOMRect
    el.focus()
    vi.advanceTimersByTime(400)
    return el
  }

  it("scrolls a focused field below the visible area into view", () => {
    install()
    focusFieldAt(window.innerHeight + 10, window.innerHeight + 54)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", inline: "nearest" })
  })

  it("leaves a visible field alone", () => {
    install()
    focusFieldAt(100, 144)
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it.each(["<button>Go</button>", '<input type="submit" />', '<input type="file" />', '<input type="range" />'])(
    "ignores button-like controls: %s",
    (html) => {
      install()
      focusFieldAt(window.innerHeight + 10, window.innerHeight + 54, html)
      expect(scrollIntoView).not.toHaveBeenCalled()
    },
  )

  it("re-reveals the focused field when the viewport resizes", () => {
    const visualViewport = Object.assign(new EventTarget(), { offsetTop: 0, height: window.innerHeight })
    vi.stubGlobal("visualViewport", visualViewport)
    install()
    const el = focusFieldAt(100, 144)
    expect(scrollIntoView).not.toHaveBeenCalled()

    // Keyboard opens: window resize, the field now ends up below the visible band.
    el.getBoundingClientRect = () => ({ top: window.innerHeight + 10, bottom: window.innerHeight + 54 }) as DOMRect
    window.dispatchEvent(new Event("resize"))
    vi.advanceTimersByTime(400)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", inline: "nearest" })

    // iOS pans the visual viewport down: a field above the panned band is covered too.
    scrollIntoView.mockClear()
    visualViewport.offsetTop = 300
    visualViewport.height = 200
    el.getBoundingClientRect = () => ({ top: 100, bottom: 144 }) as DOMRect
    visualViewport.dispatchEvent(new Event("resize"))
    vi.advanceTimersByTime(400)
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "center", inline: "nearest" })

    // Inside the panned band: nothing to do.
    scrollIntoView.mockClear()
    el.getBoundingClientRect = () => ({ top: 320, bottom: 364 }) as DOMRect
    visualViewport.dispatchEvent(new Event("resize"))
    vi.advanceTimersByTime(400)
    expect(scrollIntoView).not.toHaveBeenCalled()
  })

  it("cancels pending checks on cleanup", () => {
    install()
    document.body.innerHTML = "<input />"
    const el = document.body.firstElementChild as HTMLElement
    el.getBoundingClientRect = () => ({ top: window.innerHeight + 10, bottom: window.innerHeight + 54 }) as DOMRect
    el.focus()

    cleanup?.()
    cleanup = undefined
    vi.advanceTimersByTime(400)

    expect(scrollIntoView).not.toHaveBeenCalled()
  })
})
