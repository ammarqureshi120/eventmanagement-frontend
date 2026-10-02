import { TZDate } from "@date-fns/tz"
import { format } from "date-fns"

/**
 * AD-12: the only place the UI converts instants into a zone. Wire values are UTC ISO strings
 * with `Z`; Event-scoped values render in the Event's IANA zone, others in the browser zone.
 * Story 1.x adds the zone label helpers on top of this.
 */
export function formatInZone(instant: string | Date, timeZoneId: string, pattern = "d MMM yyyy, HH:mm"): string {
  const date = typeof instant === "string" ? new Date(instant) : instant
  return format(new TZDate(date, timeZoneId), pattern)
}
