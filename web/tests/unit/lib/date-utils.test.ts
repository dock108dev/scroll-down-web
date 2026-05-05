import { describe, it, expect } from "vitest";
import {
  APP_TIMEZONE,
  easternCalendarToday,
  addDaysCalendar,
  addDays,
  fmtDate,
  toEasternDateStr,
  gameScheduleDateStr,
} from "@/lib/date-utils";

describe("date-utils", () => {
  it("exports the expected app timezone", () => {
    expect(APP_TIMEZONE).toBe("America/New_York");
  });

  it("returns Eastern calendar today as YYYY-MM-DD", () => {
    const s = easternCalendarToday();
    expect(s).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("adds and subtracts calendar days", () => {
    expect(addDaysCalendar("2026-01-15", 5)).toBe("2026-01-20");
    expect(addDaysCalendar("2026-01-15", -10)).toBe("2026-01-05");
    expect(addDaysCalendar("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("adds and subtracts days on Date objects", () => {
    const base = new Date("2026-01-15T12:00:00.000Z");
    expect(fmtDate(addDays(base, 5))).toBe("2026-01-20");
    expect(fmtDate(addDays(base, -10))).toBe("2026-01-05");
  });

  it("formats dates as YYYY-MM-DD", () => {
    expect(fmtDate(new Date("2026-02-03T12:00:00.000Z"))).toBe("2026-02-03");
  });

  it("maps UTC calendar date-only strings to Eastern calendar date", () => {
    // UTC May 4 → evening May 3 in Eastern (2026 EDT)
    expect(toEasternDateStr("2026-05-04")).toBe("2026-05-03");
  });

  it("converts ISO datetime to eastern date string", () => {
    const val = toEasternDateStr("2026-06-18T03:30:00.000Z");
    expect(val).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(val).toBe("2026-06-17");
  });

  it("maps late-night NHL-style puck drop to prior Eastern calendar day", () => {
    expect(toEasternDateStr("2026-05-04T01:00:00.000Z")).toBe("2026-05-03");
  });

  it("prefers backend localGameDate over derived Eastern date", () => {
    expect(
      gameScheduleDateStr({
        localGameDate: "2026-05-03",
        gameDate: "2026-05-04T01:00:00.000Z",
      }),
    ).toBe("2026-05-03");
  });
});
