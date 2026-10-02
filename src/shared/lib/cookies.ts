/** Reads a cookie value by name from `document.cookie`, or `null` when absent. */
export function readCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null
  }

  const prefix = `${name}=`
  for (const part of document.cookie.split(";")) {
    const cookie = part.trim()
    if (cookie.startsWith(prefix)) {
      const raw = cookie.slice(prefix.length)
      try {
        return decodeURIComponent(raw)
      } catch {
        // Malformed percent sequence: hand back the value as stored.
        return raw
      }
    }
  }

  return null
}
