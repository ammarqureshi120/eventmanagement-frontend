import { act, renderHook } from "@testing-library/react"
import type { ReactNode } from "react"
import { Provider } from "react-redux"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { createStore } from "@/app/store"

import { useTheme } from "./use-theme"
import { useThemeSync } from "./use-theme-sync"

/** A controllable `prefers-color-scheme: dark` media query. */
function installMatchMedia(initiallyDark: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>()
  const query = {
    matches: initiallyDark,
    media: "(prefers-color-scheme: dark)",
    addEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) => listeners.add(listener)),
    removeEventListener: vi.fn((_type: string, listener: (event: MediaQueryListEvent) => void) =>
      listeners.delete(listener),
    ),
  }
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query),
  )
  return {
    query,
    listenerCount: () => listeners.size,
    flip(dark: boolean) {
      query.matches = dark
      listeners.forEach((listener) => listener({ matches: dark } as MediaQueryListEvent))
    },
  }
}

function renderTheme() {
  const store = createStore()
  const wrapper = ({ children }: { children: ReactNode }) => <Provider store={store}>{children}</Provider>
  const hook = renderHook(
    () => {
      useThemeSync()
      return useTheme()
    },
    { wrapper },
  )
  return { store, ...hook }
}

const html = () => document.documentElement

describe("theme slice + hooks", () => {
  beforeEach(() => {
    localStorage.clear()
    html().classList.remove("dark")
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("is registered in the app store and starts from the stored preference", () => {
    localStorage.setItem("eventhub-theme", "dark")
    installMatchMedia(false)

    const { store, result } = renderTheme()

    expect(store.getState().theme.preference).toBe("dark")
    expect(result.current.preference).toBe("dark")
    expect(html()).toHaveClass("dark")
  })

  it("applies instantly and persists the choice", () => {
    installMatchMedia(false)
    const { result } = renderTheme()

    act(() => result.current.setPreference("dark"))
    expect(html()).toHaveClass("dark")
    expect(localStorage.getItem("eventhub-theme")).toBe("dark")

    act(() => result.current.setPreference("light"))
    expect(html()).not.toHaveClass("dark")
    expect(localStorage.getItem("eventhub-theme")).toBe("light")
  })

  it("follows the OS live while on system, and stops listening otherwise", () => {
    const media = installMatchMedia(false)
    const { result } = renderTheme()
    expect(result.current.preference).toBe("system")
    expect(html()).not.toHaveClass("dark")

    act(() => media.flip(true))
    expect(html()).toHaveClass("dark")
    act(() => media.flip(false))
    expect(html()).not.toHaveClass("dark")

    act(() => result.current.setPreference("light"))
    expect(media.listenerCount()).toBe(0)
    act(() => media.flip(true))
    expect(html()).not.toHaveClass("dark")
  })

  it("treats an unknown stored value as system", () => {
    localStorage.setItem("eventhub-theme", "blue")
    installMatchMedia(true)

    const { result } = renderTheme()

    expect(result.current.preference).toBe("system")
    expect(html()).toHaveClass("dark")
  })

  it("still switches for the session when storage throws, without console errors", () => {
    installMatchMedia(true)
    const blocked = () => {
      throw new DOMException("blocked", "SecurityError")
    }
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked)
    const consoleError = vi.spyOn(console, "error")

    const { result } = renderTheme()
    expect(result.current.preference).toBe("system")
    expect(html()).toHaveClass("dark")

    act(() => result.current.setPreference("light"))
    expect(result.current.preference).toBe("light")
    expect(html()).not.toHaveClass("dark")
    expect(consoleError).not.toHaveBeenCalled()
  })
})
