import { describe, it, expect } from "vitest";
import {
  resolveStatValue,
  formatStatValue,
  getGroupsForSport,
  buildGroupsFromNormalized,
  buildGroupsFromRaw,
} from "@/lib/team-stats-config";
import type { NormalizedStat } from "@/lib/types";

describe("team-stats-config base helpers", () => {
  it("resolves first numeric alias and formats values", () => {
    expect(resolveStatValue({ a: "x", b: "5.5" }, ["a", "b"])).toBeUndefined();
    expect(resolveStatValue({ a: null, b: "5.5" }, ["a", "b"])).toBe(5.5);
    expect(resolveStatValue({ a: null }, ["a", "b"])).toBeUndefined();
    expect(formatStatValue(undefined)).toBe("-");
    expect(formatStatValue(55, true)).toBe("55.0%");
    expect(formatStatValue(0.552, true)).toBe("55.2%");
    expect(formatStatValue(12)).toBe("12");
    expect(formatStatValue(12.34)).toBe("12.3");
  });

  it("returns sport-specific groups", () => {
    expect(getGroupsForSport("nba")[0]?.title).toBe("Overview");
    expect(getGroupsForSport("mlb")[0]?.title).toBe("Batting");
    expect(getGroupsForSport("nhl")[0]?.title).toBe("Offense");
    expect(getGroupsForSport("unknown")[0]?.title).toBe("Overview");
  });
});

describe("team-stats-config normalized/raw builders", () => {
  it("builds normalized groups in expected order and filters score rows", () => {
    const home: NormalizedStat[] = [
      { key: "points", value: 100, displayLabel: "PTS", group: "scoring", formatType: "num" },
      { key: "fg_pct", value: 0.51, displayLabel: "FG%", group: "shooting", formatType: "pct" },
      { key: "turnovers", value: 12, displayLabel: "TO", group: "playmaking", formatType: "num" },
      { key: "custom_metric", value: "7", displayLabel: "Custom", group: "other", formatType: "num" },
    ];
    const away: NormalizedStat[] = [
      { key: "fg_pct", value: 0.47, displayLabel: "FG%", group: "shooting", formatType: "pct" },
      { key: "turnovers", value: 10, displayLabel: "TO", group: "playmaking", formatType: "num" },
      { key: "custom_metric", value: 9, displayLabel: "Custom", group: "other", formatType: "num" },
    ];

    const groups = buildGroupsFromNormalized(home, away);
    expect(groups.map((g) => g.title)).toEqual(["Shooting", "Playmaking", "Other"]);
    expect(groups[0].rows[0].isPercentage).toBe(true);
    expect(groups[1].rows[0].lowerIsBetter).toBe(true);
    expect(groups.flatMap((g) => g.rows).some((r) => r.key === "points")).toBe(false);
  });

  it("builds fallback raw groups and omits empty rows", () => {
    const groups = buildGroupsFromRaw(
      { rebounds: 44, assists: 22, fgPct: 0.5, turnovers: 14 },
      { rebounds: 40, assists: 19, fgPct: 0.47 },
      "nba",
    );
    const overview = groups.find((g) => g.title === "Overview");
    const shooting = groups.find((g) => g.title === "Shooting");
    expect(overview?.rows.some((r) => r.key === "reb")).toBe(true);
    expect(overview?.rows.some((r) => r.key === "to")).toBe(true);
    expect(shooting?.rows.some((r) => r.key === "fgPct" && r.isPercentage)).toBe(true);
  });
});
