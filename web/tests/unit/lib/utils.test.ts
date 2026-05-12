import { describe, it, expect } from "vitest";
import {
  cn,
  formatTimeET,
  formatDate,
  resolveTeamColor,
  teamColorStyle,
  cardDisplayName,
} from "@/lib/utils";

describe("utils classnames", () => {
  it("joins truthy class names only", () => {
    expect(cn("base", false, undefined, "active", null)).toBe("base active");
  });
});

describe("utils date formatters (Eastern)", () => {
  it("formatTimeET appends ET to a wall-clock time", () => {
    // 23:05 UTC = 19:05 ET on 2026-04-15 (EDT)
    expect(formatTimeET("2026-04-15T23:05:00Z")).toMatch(/7:05.*ET$/);
  });

  it("formatDate renders short weekday + month + day in Eastern", () => {
    expect(formatDate("2026-04-15T23:05:00Z")).toBe("Wed, Apr 15");
  });
});

describe("utils 3-digit hex parsing", () => {
  it("expands #RGB shorthand to a #RRGGBB-equivalent color before luminance checks", () => {
    document.documentElement.classList.remove("dark");
    // #fff in light mode is too bright — should be darkened, not returned as-is.
    expect(resolveTeamColor("#fff", undefined, "#000")).not.toBe("#fff");
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
  it("returns pro nicknames", () => {
    expect(cardDisplayName("Los Angeles Dodgers", "mlb")).toBe("Dodgers");
    expect(cardDisplayName("New York Yankees", "mlb")).toBe("Yankees");
  });

  it("preserves multi-word pro nicknames", () => {
    expect(cardDisplayName("Toronto Blue Jays", "mlb")).toBe("Blue Jays");
    expect(cardDisplayName("Chicago White Sox", "mlb")).toBe("White Sox");
    expect(cardDisplayName("Vegas Golden Knights", "nhl")).toBe("Golden Knights");
  });

  it("strips mascot from college names", () => {
    // Single-word mascot — drop the last token
    expect(cardDisplayName("Duke Blue Devils", "ncaab")).toBe("Duke");
    expect(cardDisplayName("Kentucky Wildcats", "ncaab")).toBe("Kentucky");
  });

  it("handles multi-word college mascot overrides", () => {
    expect(cardDisplayName("North Carolina Tar Heels", "ncaab")).toBe("North Carolina");
    expect(cardDisplayName("Alabama Crimson Tide", "ncaaf")).toBe("Alabama");
    expect(cardDisplayName("Notre Dame Fighting Irish", "ncaaf")).toBe("Notre Dame");
  });

  it("respects multi-word school names that collide with mascot prefixes", () => {
    // "Bowling Green" school + "Falcons" mascot — would otherwise eat "Green"
    expect(cardDisplayName("Bowling Green Falcons", "ncaaf")).toBe("Bowling Green");
    expect(cardDisplayName("Boston College Eagles", "ncaab")).toBe("Boston College");
  });

  it("uses the mascot-prefix heuristic for two-word mascots", () => {
    expect(cardDisplayName("Oakland Golden Grizzlies", "ncaab")).toBe("Oakland");
  });

  it("falls back to abbr when display name exceeds 15 chars", () => {
    expect(cardDisplayName("South Carolina Upstate Spartans", "ncaab", "USCU")).toBe("USCU");
  });

  it("returns the full name when a college team has only one word", () => {
    expect(cardDisplayName("Stanford", "ncaab")).toBe("Stanford");
  });
});

describe("ensureMaxLuminance / ensureMinLuminance edge cases", () => {
  it("leaves a dark color unchanged in light mode", () => {
    document.documentElement.classList.remove("dark");
    // #000000 already below the max-luminance threshold — passes through.
    expect(resolveTeamColor("#000000", undefined, "#888")).toBe("#000000");
  });

  it("leaves a light color unchanged in dark mode", () => {
    document.documentElement.classList.add("dark");
    // #ffffff already above min-luminance threshold — passes through.
    expect(resolveTeamColor(undefined, "#ffffff", "#888")).toBe("#ffffff");
    document.documentElement.classList.remove("dark");
  });

  it("uses the fallback when both colors are missing", () => {
    document.documentElement.classList.remove("dark");
    expect(resolveTeamColor(undefined, undefined, "#000000")).toBe("#000000");
  });
});
