import { describe, it, expect } from "vitest";
import {
  formatOdds,
  cn,
  resolveTeamColor,
  teamColorStyle,
  cardDisplayName,
} from "@/lib/utils";

describe("utils odds and classnames", () => {
  it("formats odds in all supported formats", () => {
    expect(formatOdds(120, "american")).toBe("+120");
    expect(formatOdds(-110, "american")).toBe("-110");
    expect(formatOdds(120, "decimal")).toBe("2.20");
    expect(formatOdds(-110, "decimal")).toBe("1.91");
    expect(formatOdds(150, "fractional")).toBe("3/2");
    expect(formatOdds(-200, "fractional")).toBe("1/2");
  });

  it("joins truthy class names only", () => {
    expect(cn("base", false, undefined, "active", null)).toBe("base active");
  });
});

describe("utils team color resolution", () => {
  it("resolves dark mode color and styles", () => {
    document.documentElement.classList.add("dark");
    const color = resolveTeamColor("#111111", "#222222", "#888");
    expect(color).not.toBe("#888");
    const style = teamColorStyle("#111111", "#222222", "#888");
    expect(style.color).toBe(color);
    expect(style.textShadow).toBe("var(--ds-team-text-outline)");
    document.documentElement.classList.remove("dark");
  });

  it("resolves light mode color and invalid fallback inputs", () => {
    document.documentElement.classList.remove("dark");
    expect(resolveTeamColor("#eeeeee", "#111111", "#888")).toMatch(/^#/);
    expect(resolveTeamColor("not-a-color", undefined, "#123456")).toBe("not-a-color");
  });
});

describe("utils card display names", () => {
  it("returns pro nicknames and college school names", () => {
    expect(cardDisplayName("Portland Trail Blazers", "nba")).toBe("Trail Blazers");
    expect(cardDisplayName("North Carolina Tar Heels", "ncaab")).toBe("North Carolina");
    expect(cardDisplayName("Oakland Golden Grizzlies", "ncaab")).toBe("Oakland");
  });

  it("falls back to abbreviation for long derived names", () => {
    expect(cardDisplayName("University of Texas Rio Grande Valley Vaqueros", "ncaab", "UTRGV")).toBe("UTRGV");
  });
});
