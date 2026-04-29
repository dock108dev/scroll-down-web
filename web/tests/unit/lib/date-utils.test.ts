import { describe, it, expect } from "vitest";
import {
  APP_TIMEZONE,
  easternToday,
  addDays,
  fmtDate,
  toEasternDateStr,
} from "@/lib/date-utils";

describe("date-utils", () => {
  it("exports the expected app timezone", () => {
    expect(APP_TIMEZONE).toBe("America/New_York");
  });

  it("returns midnight eastern today", () => {
    const d = easternToday();
    expect(d.getHours()).toBe(0);
    expect(d.getMinutes()).toBe(0);
    expect(d.getSeconds()).toBe(0);
    expect(d.getMilliseconds()).toBe(0);
  });

  it("adds and subtracts days", () => {
    const base = new Date("2026-01-15T12:00:00.000Z");
    expect(fmtDate(addDays(base, 5))).toBe("2026-01-20");
    expect(fmtDate(addDays(base, -10))).toBe("2026-01-05");
  });

  it("formats dates as YYYY-MM-DD", () => {
    expect(fmtDate(new Date("2026-02-03T12:00:00.000Z"))).toBe("2026-02-03");
  });

  it("returns date-only strings unchanged", () => {
    expect(toEasternDateStr("2026-06-18")).toBe("2026-06-18");
  });

  it("converts ISO datetime to eastern date string", () => {
    const val = toEasternDateStr("2026-06-18T03:30:00.000Z");
    expect(val).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
