/**
 * Dates in the studio's own time zone (New York), so the server render, the browser render and the
 * printed pack all show the same day. Without a fixed zone the server formats in UTC and a browser in
 * New York formats in local time: after 8 PM the two disagree, and React reports a hydration mismatch.
 */
export const STUDIO_TZ = "America/New_York";

/** "05 Oct 2026" style, in studio time. */
export function fmtDate(d: Date | string | number, opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" }): string {
  return new Date(d).toLocaleDateString("en-GB", { timeZone: STUDIO_TZ, ...opts });
}

/** YYYY-MM-DD for the given instant (default now), in studio time. */
export function studioDay(d: Date | string | number = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STUDIO_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
}
