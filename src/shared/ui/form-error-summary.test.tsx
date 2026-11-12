import { render, screen } from "@testing-library/react"
import { useRef } from "react"
import type { FieldErrors } from "react-hook-form"
import { describe, expect, it } from "vitest"

import { countFieldErrors, fieldsNeedALook, FormErrorSummary } from "./form-error-summary"

type Values = { first: string; second: string; third: string }

function Harness({ errors, attempt }: { errors: FieldErrors<Values>; attempt: number }) {
  const ref = useRef<HTMLFormElement>(null)
  return (
    <>
      <FormErrorSummary errors={errors} attempt={attempt} containerRef={ref} />
      <form ref={ref}>
        <input aria-label="first" aria-invalid={errors.first ? true : undefined} />
        <input aria-label="second" aria-invalid={errors.second ? true : undefined} />
        <input aria-label="third" aria-invalid={errors.third ? true : undefined} />
      </form>
    </>
  )
}

const error = (message: string) => ({ type: "custom", message })

describe("FormErrorSummary", () => {
  it("counts field messages, not the form-level root error", () => {
    expect(countFieldErrors<Values>({ first: error("a"), second: error("b"), root: error("c") } as FieldErrors<Values>)).toBe(2)
    expect(countFieldErrors<Values>({})).toBe(0)
  })

  it("uses the EXPERIENCE copy", () => {
    expect(fieldsNeedALook(2)).toBe("2 fields need a look. The messages below say what to change.")
    expect(fieldsNeedALook(1)).toBe("1 field needs a look. The messages below say what to change.")
  })

  it("shows nothing before a failed submit or with a single message", () => {
    const { rerender } = render(<Harness errors={{ first: error("a"), second: error("b") }} attempt={0} />)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()

    rerender(<Harness errors={{ second: error("b") }} attempt={1} />)
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("after a failed submit with more than one message: the alert and focus on the first invalid field in DOM order", () => {
    render(<Harness errors={{ third: error("c"), second: error("b") }} attempt={1} />)

    const alert = screen.getByRole("alert")
    expect(alert).toHaveTextContent("2 fields need a look. The messages below say what to change.")
    expect(alert).toHaveTextContent("Nothing was saved yet.")
    expect(screen.getByLabelText("second")).toHaveFocus()
  })

  it("moves focus only on a new attempt, not while the user fixes fields", () => {
    const { rerender } = render(<Harness errors={{ first: error("a"), second: error("b") }} attempt={1} />)
    expect(screen.getByLabelText("first")).toHaveFocus()

    screen.getByLabelText("third").focus()
    rerender(<Harness errors={{ second: error("b"), third: error("c") }} attempt={1} />)
    expect(screen.getByLabelText("third")).toHaveFocus()

    rerender(<Harness errors={{ second: error("b"), third: error("c") }} attempt={2} />)
    expect(screen.getByLabelText("second")).toHaveFocus()
  })
})
