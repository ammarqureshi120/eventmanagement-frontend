import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { useZodForm } from "./forms"

const nameSchema = z.object({
  firstName: z.string().trim().min(1, "Enter a first name.").max(100),
})

function NameForm({ onValid }: { onValid: (values: z.output<typeof nameSchema>) => void }) {
  const form = useZodForm(nameSchema, { defaultValues: { firstName: "" } })
  const error = form.formState.errors.firstName?.message
  return (
    <form onSubmit={form.handleSubmit(onValid)} noValidate>
      <label htmlFor="firstName">First name</label>
      <input id="firstName" aria-describedby={error ? "firstName-error" : undefined} {...form.register("firstName")} />
      {error ? <p id="firstName-error">{error}</p> : null}
      <button type="submit">Save</button>
    </form>
  )
}

describe("useZodForm", () => {
  it("blocks submit and shows the Zod message when invalid", async () => {
    const onValid = vi.fn()
    render(<NameForm onValid={onValid} />)

    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(await screen.findByText("Enter a first name.")).toBeInTheDocument()
    expect(onValid).not.toHaveBeenCalled()
  })

  it("validates on blur before any submit (mode onTouched)", async () => {
    const onValid = vi.fn()
    render(<NameForm onValid={onValid} />)

    await userEvent.click(screen.getByLabelText("First name"))
    await userEvent.tab()

    expect(await screen.findByText("Enter a first name.")).toBeInTheDocument()
    expect(onValid).not.toHaveBeenCalled()
  })

  it("submits parsed values when valid", async () => {
    const onValid = vi.fn()
    render(<NameForm onValid={onValid} />)

    await userEvent.type(screen.getByLabelText("First name"), "  Ali ")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))

    expect(onValid).toHaveBeenCalledWith({ firstName: "Ali" }, expect.anything())
  })
})
