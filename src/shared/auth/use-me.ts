import { useGetMeQuery, type MeResponse } from "@/api/generated/me"
import { toProblem, type ProblemCode } from "@/shared/lib/problem"

export type MeStatus = "loading" | "signedIn" | "signedOut" | "error"

export interface UseMeResult {
  me: MeResponse | undefined
  status: MeStatus
  /** Problem code of the last failure (`network`, `server_error`, …), or `null`. */
  problemCode: ProblemCode | (string & {}) | null
  refetch: () => void
}

/**
 * A lost or refused session: any 401 (also when its body is not JSON) and `account_disabled`.
 * These send the user to sign in instead of showing an error with a retry that can never succeed.
 */
function isSignedOutError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false
  }
  const { status, originalStatus } = error as { status?: unknown; originalStatus?: unknown }
  if (status === 401 || (status === "PARSING_ERROR" && originalStatus === 401)) {
    return true
  }
  return toProblem(error).code === "account_disabled"
}

/**
 * The signed-in user from `GET /api/me` (AD-9). Signed-in, role and nav areas are derived from this
 * query only, never stored in a slice (AD-2). `signedOut` means the API answered 401 (or `account_disabled`).
 */
export function useMe(): UseMeResult {
  const { data, error, isLoading, isFetching, refetch } = useGetMeQuery()

  let status: MeStatus
  if (error) {
    status = isSignedOutError(error) ? "signedOut" : "error"
  } else if (data) {
    status = "signedIn"
  } else {
    status = "loading"
  }
  // A refetch after an error keeps the error until it settles; show loading meanwhile.
  if (status === "error" && isFetching) {
    status = "loading"
  }
  if (isLoading) {
    status = "loading"
  }

  return { me: data, status, problemCode: error ? toProblem(error).code : null, refetch }
}

/** "Sara Admin" → "SA" for the avatar. */
export function initialsOf(me: Pick<MeResponse, "firstName" | "lastName" | "email">): string {
  const letters = [me.firstName, me.lastName]
    .map((part) => part.trim().charAt(0))
    .filter(Boolean)
    .join("")
  return (letters || me.email.charAt(0)).toUpperCase()
}

export function fullNameOf(me: Pick<MeResponse, "firstName" | "lastName" | "email">): string {
  return [me.firstName, me.lastName].map((part) => part.trim()).filter(Boolean).join(" ") || me.email
}
