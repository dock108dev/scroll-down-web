import { describe, it, expect } from "vitest";
import { bookAbbreviation, bookSlug } from "@/lib/theme";

describe("theme book helpers", () => {
  it("abbreviates known books and falls back", () => {
    expect(bookAbbreviation("draftkings")).toBe("DK");
    expect(bookAbbreviation("Unknown Long Name")).toBe("UNK");
    expect(bookAbbreviation(null)).toBe("");
  });

  it("slugifies names", () => {
    expect(bookSlug("Draft Kings ")).toBe("draft-kings");
    expect(bookSlug("Bet/Rival!")).toBe("betrival");
  });
});
