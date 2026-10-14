import { describe, expect, it, vi } from "vitest"

import { applyToForm, hasFieldErrors, toProblem, type Problem } from "./problem"

describe("toProblem", () => {
  it("maps an EventHubProblem body by code, with traceId and field errors", () => {
    const problem = toProblem({
      status: 400,
      data: { code: "validation", traceId: "00-abc-00", errors: { email: ["Enter your email address."], password: [] } },
    })

    expect(problem).toEqual({
      code: "validation",
      status: 400,
      traceId: "00-abc-00",
      errors: { email: ["Enter your email address."] },
    })
    expect(hasFieldErrors(problem)).toBe(true)
  })

  it("keeps unknown server codes (open enum) and omits missing errors", () => {
    expect(toProblem({ status: 409, data: { code: "something_new" } })).toEqual({
      code: "something_new",
      status: 409,
      traceId: null,
    })
  })

  it.each([
    [{ status: "FETCH_ERROR", error: "TypeError: Failed to fetch" }],
    [{ status: "TIMEOUT_ERROR", error: "timeout" }],
  ])("maps a failed fetch to network: %j", (error) => {
    expect(toProblem(error)).toEqual({ code: "network", status: null, traceId: null })
  })

  it("maps a non-JSON body to server_error with the original status", () => {
    expect(toProblem({ status: "PARSING_ERROR", originalStatus: 502, data: "<html>", error: "SyntaxError" })).toEqual({
      code: "server_error",
      status: 502,
      traceId: null,
    })
  })

  it.each([[{ status: 500, data: null }], [{ status: 500, data: { title: "no code" } }], [new Error("boom")], [undefined], ["text"]])(
    "maps anything without a code to server_error: %j",
    (error) => {
      expect(toProblem(error).code).toBe("server_error")
    },
  )
})

describe("applyToForm", () => {
  const validation: Problem = {
    code: "validation",
    status: 400,
    traceId: null,
    errors: { email: ["Enter an email like name@company.com."], password: ["Enter your password."], other: ["x"] },
  }

  it("sets the first message per field, focuses only the first field, and reports a match", () => {
    const setError = vi.fn()

    expect(applyToForm(validation, setError, ["email", "password"])).toBe(true)

    expect(setError).toHaveBeenCalledTimes(2)
    expect(setError).toHaveBeenNthCalledWith(
      1,
      "email",
      { type: "server", message: "Enter an email like name@company.com." },
      { shouldFocus: true },
    )
    expect(setError).toHaveBeenNthCalledWith(2, "password", { type: "server", message: "Enter your password." }, { shouldFocus: false })
  })

  it("returns false when no listed field matches or the problem has no field errors", () => {
    const setError = vi.fn()

    expect(applyToForm({ ...validation, errors: { other: ["x"] } }, setError, ["email"])).toBe(false)
    expect(applyToForm({ code: "validation", status: 400, traceId: null }, setError)).toBe(false)
    expect(applyToForm({ code: "invalid_credentials", status: 401, traceId: null }, setError)).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })
})
