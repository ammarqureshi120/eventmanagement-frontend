/**
 * UX-DR11: `returnTo` is honoured only for same-origin relative paths. Anything else (absolute URLs,
 * protocol-relative `//host`, backslash tricks, control characters, `/login` itself) is ignored and the
 * caller falls back to the role home.
 */
export function safeReturnTo(value: string | null | undefined): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) {
    return null
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null
  }
  // eslint-disable-next-line no-control-regex -- rejecting control characters is the point
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return null
  }

  let url: URL
  try {
    url = new URL(value, "http://same.origin")
  } catch {
    return null
  }
  if (url.origin !== "http://same.origin") {
    return null
  }
  // Compare the path as the router will see it: decoded and case-insensitive (`/LOGIN`, `/%6Cogin`).
  let path: string
  try {
    path = decodeURIComponent(url.pathname).toLowerCase()
  } catch {
    return null
  }
  if (path === "/login" || path.startsWith("/login/")) {
    return null
  }
  return `${url.pathname}${url.search}${url.hash}`
}

/** `/login?returnTo=<path+search>` for a protected location (no `returnTo` for the root). */
export function loginPathFor(location: { pathname: string; search?: string }): string {
  const target = `${location.pathname}${location.search ?? ""}`
  const safe = safeReturnTo(target)
  return safe && safe !== "/" ? `/login?returnTo=${encodeURIComponent(safe)}` : "/login"
}
