import { describe, it, expect } from "vitest";
import {
  cn,
  formatTimeET,
  formatDate,
  resolveTeamColor,
  teamColorStyle,
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
