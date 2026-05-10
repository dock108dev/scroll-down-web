import { describe, it, expect } from "vitest";
import {
  cn,
  resolveTeamColor,
  teamColorStyle,
  cardDisplayName,
} from "@/lib/utils";

describe("utils classnames", () => {
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
  it("returns pro nicknames", () => {
    expect(cardDisplayName("Los Angeles Dodgers", "mlb")).toBe("Dodgers");
    expect(cardDisplayName("New York Yankees", "mlb")).toBe("Yankees");
  });
});
