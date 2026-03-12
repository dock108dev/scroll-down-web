/**
 * Centralized Eastern-timezone date utilities.
 * SSOT for all date bucketing, formatting, and range calculations.
 */

export const APP_TIMEZONE = "America/New_York";

/** Midnight today in US/Eastern. */
export function easternToday(): Date {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: APP_TIMEZONE }),
  );
  now.setHours(0, 0, 0, 0);
  return now;
}

/** Add (or subtract) days from a Date. */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

/** Format a Date as YYYY-MM-DD. */
export function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Convert an ISO datetime or YYYY-MM-DD string to an Eastern-time date string. */
export function toEasternDateStr(gameDate: string): string {
  if (gameDate.length === 10) return gameDate;
  return new Date(gameDate).toLocaleDateString("en-CA", {
    timeZone: APP_TIMEZONE,
  });
}
