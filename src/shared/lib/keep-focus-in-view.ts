/**
 * UX-DR58 / EXPERIENCE Forms: the on-screen keyboard never covers the focused field.
 * When a text field gains focus, or the viewport resizes (keyboard opening), the focused
 * field is scrolled into the visible area. Browsers mostly do this themselves; this makes it reliable everywhere.
 * Returns a cleanup function.
 */
const BUTTON_LIKE_TYPES = ["reset", "image", "file", "range", "color", "hidden", "submit", "button", "checkbox", "radio"]

const FIELD_SELECTOR = [
  `input${BUTTON_LIKE_TYPES.map((type) => `:not([type=${type}])`).join("")}`,
  "textarea",
  "select",
].join(", ")

/** Re-check once the keyboard animation / blur validation of the previous field (an error row above) settles. */
const SETTLE_MS = 350

function revealFocusedField() {
  const el = document.activeElement
  if (!(el instanceof HTMLElement) || !el.matches(FIELD_SELECTOR)) {
    return
  }
  // The visible band in layout-viewport coordinates: iOS pans the visual viewport (offsetTop) for the keyboard.
  const viewport = window.visualViewport
  const top = viewport?.offsetTop ?? 0
  const bottom = top + (viewport?.height ?? window.innerHeight)
  const rect = el.getBoundingClientRect()
  if (rect.top < top || rect.bottom > bottom) {
    el.scrollIntoView({ block: "center", inline: "nearest" })
  }
}

export function keepFocusedFieldInView(): () => void {
  let frame: number | undefined
  let timer: number | undefined

  const cancel = () => {
    if (frame !== undefined) {
      cancelAnimationFrame(frame)
      frame = undefined
    }
    if (timer !== undefined) {
      window.clearTimeout(timer)
      timer = undefined
    }
  }

  const schedule = () => {
    cancel()
    frame = requestAnimationFrame(() => {
      frame = undefined
      revealFocusedField()
    })
    timer = window.setTimeout(() => {
      timer = undefined
      revealFocusedField()
    }, SETTLE_MS)
  }

  const viewport = window.visualViewport
  document.addEventListener("focusin", schedule)
  viewport?.addEventListener("resize", schedule)
  window.addEventListener("resize", schedule)
  return () => {
    cancel()
    document.removeEventListener("focusin", schedule)
    viewport?.removeEventListener("resize", schedule)
    window.removeEventListener("resize", schedule)
  }
}
