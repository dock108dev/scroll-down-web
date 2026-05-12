import { describe, it, expect } from "vitest";
import {
  MLB_TEAMS,
  MLB_TEAM_BY_ABBR,
  findMlbTeam,
  teamLogoPath,
} from "@/lib/mlb-teams";

describe("MLB_TEAMS roster", () => {
  it("contains all 30 teams with unique abbreviations", () => {
    expect(MLB_TEAMS).toHaveLength(30);
    const abbrs = new Set(MLB_TEAMS.map((t) => t.abbr));
    expect(abbrs.size).toBe(30);
  });

  it("splits 15 AL / 15 NL with five teams per division", () => {
    const al = MLB_TEAMS.filter((t) => t.league === "AL");
    const nl = MLB_TEAMS.filter((t) => t.league === "NL");
    expect(al).toHaveLength(15);
    expect(nl).toHaveLength(15);
    for (const league of ["AL", "NL"] as const) {
      for (const division of ["East", "Central", "West"] as const) {
        const count = MLB_TEAMS.filter(
          (t) => t.league === league && t.division === division,
        ).length;
        expect(count).toBe(5);
      }
    }
  });

  it("has hex primaryColor and primaryColorDark for every team", () => {
    for (const t of MLB_TEAMS) {
      expect(t.primaryColor).toMatch(/^#[0-9A-F]{6}$/i);
      expect(t.primaryColorDark).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("MLB_TEAM_BY_ABBR has one entry per team keyed by abbr", () => {
    expect(MLB_TEAM_BY_ABBR.size).toBe(30);
    expect(MLB_TEAM_BY_ABBR.get("NYY")?.name).toBe("Yankees");
  });
});

describe("findMlbTeam", () => {
  it("returns the team for a known uppercase abbreviation", () => {
    expect(findMlbTeam("LAD")?.name).toBe("Dodgers");
  });

  it("normalizes case before lookup", () => {
    expect(findMlbTeam("lad")?.fullName).toBe("Los Angeles Dodgers");
    expect(findMlbTeam("Bos")?.name).toBe("Red Sox");
  });

  it("returns null for unknown, empty, null, or undefined inputs", () => {
    expect(findMlbTeam("XYZ")).toBeNull();
    expect(findMlbTeam("")).toBeNull();
    expect(findMlbTeam(null)).toBeNull();
    expect(findMlbTeam(undefined)).toBeNull();
  });
});

describe("teamLogoPath", () => {
  it("returns an uppercased SVG path under /teams", () => {
    expect(teamLogoPath("nyy")).toBe("/teams/NYY.svg");
    expect(teamLogoPath("LAD")).toBe("/teams/LAD.svg");
  });
});
