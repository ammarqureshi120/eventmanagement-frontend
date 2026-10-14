import type { FieldValues, Path, UseFormSetError } from "react-hook-form"

/**
 * AD-17: every non-2xx from the API is an `EventHubProblem` (RFC 9457) carrying a stable `code`.
 * The UI maps errors by `code` only, never by message text or status. `network` is client-only.
 */
export type ProblemCode =
  | "validation"
  | "token_invalid"
  | "invalid_credentials"
  | "account_disabled"
  | "session_expired"
  | "forbidden"
  | "not_found"
  | "duplicate"
  | "capacity_exceeded"
  | "invalid_event_state"
  | "concurrency_conflict"
  | "confirmation_required"
  | "rule_violation"
  | "server_error"
  | "network"

export interface Problem {
  /** Stable error code. Unknown server codes are kept as-is (open enum); render a neutral fallback. */
  code: ProblemCode | (string & {})
  /** HTTP status, or `null` when the request never got a response (`network`). */
  status: number | null
  /** Server trace id for support, when the server sent one. */
  traceId: string | null
  /** Field errors keyed by camelCase dot path (`attendees.3.email`), present only on `validation`. */
  errors?: Record<string, string[]>
}

type ProblemBody = { code?: unknown; traceId?: unknown; errors?: unknown }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function readErrors(value: unknown): Record<string, string[]> | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  const errors: Record<string, string[]> = {}
  for (const [key, messages] of Object.entries(value)) {
    const list = (Array.isArray(messages) ? messages : [messages]).filter(
      (message): message is string => typeof message === "string" && message.length > 0,
    )
    if (list.length > 0) {
      errors[key] = list
    }
  }
  return errors
}

/**
 * Turns whatever RTK Query (or a thrown value) reports into a `Problem`.
 * - fetch failed / timed out → `network`
 * - response body is not JSON, or JSON without a `code` → `server_error`
 * - an `EventHubProblem` body → its `code`, `traceId` and `errors`
 */
export function toProblem(error: unknown): Problem {
  if (!isRecord(error)) {
    return { code: "server_error", status: null, traceId: null }
  }

  const status = error.status
  if (status === "FETCH_ERROR" || status === "TIMEOUT_ERROR") {
    return { code: "network", status: null, traceId: null }
  }
  if (status === "PARSING_ERROR") {
    const original = typeof error.originalStatus === "number" ? error.originalStatus : null
    return { code: "server_error", status: original, traceId: null }
  }
  if (typeof status !== "number") {
    return { code: "server_error", status: null, traceId: null }
  }

  const body: ProblemBody = isRecord(error.data) ? error.data : {}
  if (typeof body.code !== "string" || body.code.length === 0) {
    return { code: "server_error", status, traceId: null }
  }

  const problem: Problem = {
    code: body.code,
    status,
    traceId: typeof body.traceId === "string" ? body.traceId : null,
  }
  const errors = readErrors(body.errors)
  if (errors) {
    problem.errors = errors
  }
  return problem
}

/** True for a `validation` problem that names at least one field. */
export function hasFieldErrors(problem: Problem): boolean {
  return problem.code === "validation" && Object.keys(problem.errors ?? {}).length > 0
}

/**
 * UX-DR15: applies server `validation` field errors to a React Hook Form (first message per field) and
 * focuses the first one. `fields` limits which keys are applied (keys the form does not own are ignored).
 * Returns whether any field error was applied, so the caller can fall back to a summary Alert.
 */
export function applyToForm<TValues extends FieldValues>(
  problem: Problem,
  setError: UseFormSetError<TValues>,
  fields?: ReadonlyArray<Path<TValues>>,
): boolean {
  if (problem.code !== "validation" || !problem.errors) {
    return false
  }

  let applied = false
  for (const [key, messages] of Object.entries(problem.errors)) {
    if (fields && !fields.includes(key as Path<TValues>)) {
      continue
    }
    setError(key as Path<TValues>, { type: "server", message: messages[0] }, { shouldFocus: !applied })
    applied = true
  }
  return applied
}
