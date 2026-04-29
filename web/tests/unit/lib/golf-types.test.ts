import { describe, it, expect } from "vitest";
import { formatDateRange } from "@/lib/golf-types";

describe("golf-types formatDateRange", () => {
  it("formats a range with optional year", () => {
    const s = formatDateRange("2026-04-01", "2026-04-04", false);
    expect(s).toContain("–");
    const y = formatDateRange("2026-04-01", "2026-04-04", true);
    expect(y).toMatch(/2026/);
  });
});
