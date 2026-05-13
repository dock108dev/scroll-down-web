/**
 * Centralized Eastern-timezone date utilities.
 * SSOT for all date bucketing, formatting, and range calculations.
 *
 * MLB schedules are interpreted in US/Eastern (league convention).
 * Never mix browser-local calendar arithmetic with Eastern — use
 * `easternCalendarToday` + `addDaysCalendar` for YYYY-MM-DD ranges.
 */

export const APP_TIMEZONE = "America/New_York";

const ISO_DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Current calendar date in US/Eastern as YYYY-MM-DD. */
export function easternCalendarToday(reference = new Date()): string {
  return reference.toLocaleDateString("en-CA", { timeZone: APP_TIMEZONE });
}

/**
 * Add calendar days to a YYYY-MM-DD string (pure date math, stable across DST).
 */
export function addDaysCalendar(isoDate: string, deltaDays: number): string {
  const m = isoDate.match(ISO_DATE_ONLY);
  if (!m) throw new Error(`Invalid YYYY-MM-DD date: ${isoDate}`);
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const anchor = Date.UTC(y, mo - 1, d + deltaDays, 12, 0, 0);
  return new Date(anchor).toISOString().slice(0, 10);
}

/** Add (or subtract) days from a Date (wall-clock in the Date's own frame). */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Format a Date as YYYY-MM-DD in the environment local timezone. */
export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/**
 * Convert an ISO datetime or YYYY-MM-DD string to an Eastern calendar date (YYYY-MM-DD).
 *
 * Date-only strings are interpreted as UTC calendar dates (matches typical
 * `DATE(timestamptz)` / `(instant AT TIME ZONE 'UTC')::date` extraction); that
 * aligns bucketing when the backend truncates to UTC day before Eastern evening games.
 */
export function toEasternDateStr(gameDate: string): string {
  const s = gameDate.trim();
  if (ISO_DATE_ONLY.test(s)) {
    return new Date(`${s}T00:00:00.000Z`).toLocaleDateString("en-CA", {
      timeZone: APP_TIMEZONE,
    });
  }
  return new Date(s).toLocaleDateString("en-CA", {
    timeZone: APP_TIMEZONE,
  });
}

/** Prefer backend `localGameDate` when present; otherwise derive Eastern calendar date from `gameDate`. */
export function gameScheduleDateStr(game: {
  localGameDate?: string;
  gameDate: string;
}): string {
  const local = game.localGameDate?.trim();
  if (local) return local;
  return toEasternDateStr(game.gameDate);
}
