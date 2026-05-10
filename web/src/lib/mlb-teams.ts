/**
 * Static roster of all 30 MLB teams. Used by the first-visit team picker and
 * the favorite-team setting. Logos live under `/public/teams/<abbr>.svg`.
 *
 * Colors are the team's primary, suitable for tinted backgrounds in the picker
 * and on hero cards. Light/dark variants follow the same convention as
 * `resolveTeamColor` in lib/utils.ts.
 */

export interface MlbTeam {
  abbr: string;
  name: string;
  fullName: string;
  league: "AL" | "NL";
  division: "East" | "Central" | "West";
  primaryColor: string;
  primaryColorDark: string;
}

export const MLB_TEAMS: readonly MlbTeam[] = [
  // AL East
  { abbr: "BAL", name: "Orioles", fullName: "Baltimore Orioles", league: "AL", division: "East", primaryColor: "#DF4601", primaryColorDark: "#FF6F1F" },
  { abbr: "BOS", name: "Red Sox", fullName: "Boston Red Sox", league: "AL", division: "East", primaryColor: "#BD3039", primaryColorDark: "#E84B54" },
  { abbr: "NYY", name: "Yankees", fullName: "New York Yankees", league: "AL", division: "East", primaryColor: "#0C2340", primaryColorDark: "#5A8AC6" },
  { abbr: "TB",  name: "Rays",    fullName: "Tampa Bay Rays", league: "AL", division: "East", primaryColor: "#092C5C", primaryColorDark: "#5DADE2" },
  { abbr: "TOR", name: "Blue Jays", fullName: "Toronto Blue Jays", league: "AL", division: "East", primaryColor: "#134A8E", primaryColorDark: "#5A8AC6" },
  // AL Central
  { abbr: "CWS", name: "White Sox", fullName: "Chicago White Sox", league: "AL", division: "Central", primaryColor: "#27251F", primaryColorDark: "#C4CED4" },
  { abbr: "CLE", name: "Guardians", fullName: "Cleveland Guardians", league: "AL", division: "Central", primaryColor: "#0C2340", primaryColorDark: "#E50022" },
  { abbr: "DET", name: "Tigers", fullName: "Detroit Tigers", league: "AL", division: "Central", primaryColor: "#0C2340", primaryColorDark: "#FA4616" },
  { abbr: "KC",  name: "Royals", fullName: "Kansas City Royals", league: "AL", division: "Central", primaryColor: "#004687", primaryColorDark: "#5A8AC6" },
  { abbr: "MIN", name: "Twins", fullName: "Minnesota Twins", league: "AL", division: "Central", primaryColor: "#002B5C", primaryColorDark: "#D31145" },
  // AL West
  { abbr: "HOU", name: "Astros", fullName: "Houston Astros", league: "AL", division: "West", primaryColor: "#002D62", primaryColorDark: "#EB6E1F" },
  { abbr: "LAA", name: "Angels", fullName: "Los Angeles Angels", league: "AL", division: "West", primaryColor: "#BA0021", primaryColorDark: "#E84B54" },
  { abbr: "OAK", name: "Athletics", fullName: "Oakland Athletics", league: "AL", division: "West", primaryColor: "#003831", primaryColorDark: "#EFB21E" },
  { abbr: "SEA", name: "Mariners", fullName: "Seattle Mariners", league: "AL", division: "West", primaryColor: "#0C2C56", primaryColorDark: "#005C5C" },
  { abbr: "TEX", name: "Rangers", fullName: "Texas Rangers", league: "AL", division: "West", primaryColor: "#003278", primaryColorDark: "#C0111F" },
  // NL East
  { abbr: "ATL", name: "Braves", fullName: "Atlanta Braves", league: "NL", division: "East", primaryColor: "#CE1141", primaryColorDark: "#E84B54" },
  { abbr: "MIA", name: "Marlins", fullName: "Miami Marlins", league: "NL", division: "East", primaryColor: "#00A3E0", primaryColorDark: "#FF6600" },
  { abbr: "NYM", name: "Mets", fullName: "New York Mets", league: "NL", division: "East", primaryColor: "#002D72", primaryColorDark: "#FF5910" },
  { abbr: "PHI", name: "Phillies", fullName: "Philadelphia Phillies", league: "NL", division: "East", primaryColor: "#E81828", primaryColorDark: "#E84B54" },
  { abbr: "WSH", name: "Nationals", fullName: "Washington Nationals", league: "NL", division: "East", primaryColor: "#AB0003", primaryColorDark: "#E84B54" },
  // NL Central
  { abbr: "CHC", name: "Cubs", fullName: "Chicago Cubs", league: "NL", division: "Central", primaryColor: "#0E3386", primaryColorDark: "#CC3433" },
  { abbr: "CIN", name: "Reds", fullName: "Cincinnati Reds", league: "NL", division: "Central", primaryColor: "#C6011F", primaryColorDark: "#E84B54" },
  { abbr: "MIL", name: "Brewers", fullName: "Milwaukee Brewers", league: "NL", division: "Central", primaryColor: "#12284B", primaryColorDark: "#FFC52F" },
  { abbr: "PIT", name: "Pirates", fullName: "Pittsburgh Pirates", league: "NL", division: "Central", primaryColor: "#27251F", primaryColorDark: "#FDB827" },
  { abbr: "STL", name: "Cardinals", fullName: "St. Louis Cardinals", league: "NL", division: "Central", primaryColor: "#C41E3A", primaryColorDark: "#E84B54" },
  // NL West
  { abbr: "ARI", name: "Diamondbacks", fullName: "Arizona Diamondbacks", league: "NL", division: "West", primaryColor: "#A71930", primaryColorDark: "#E3D4AD" },
  { abbr: "COL", name: "Rockies", fullName: "Colorado Rockies", league: "NL", division: "West", primaryColor: "#33006F", primaryColorDark: "#A0A0A0" },
  { abbr: "LAD", name: "Dodgers", fullName: "Los Angeles Dodgers", league: "NL", division: "West", primaryColor: "#005A9C", primaryColorDark: "#5A8AC6" },
  { abbr: "SD",  name: "Padres", fullName: "San Diego Padres", league: "NL", division: "West", primaryColor: "#2F241D", primaryColorDark: "#FFC425" },
  { abbr: "SF",  name: "Giants", fullName: "San Francisco Giants", league: "NL", division: "West", primaryColor: "#27251F", primaryColorDark: "#FD5A1E" },
] as const;

export const MLB_TEAM_BY_ABBR: ReadonlyMap<string, MlbTeam> = new Map(
  MLB_TEAMS.map((t) => [t.abbr, t]),
);

export function findMlbTeam(abbr: string | null | undefined): MlbTeam | null {
  if (!abbr) return null;
  return MLB_TEAM_BY_ABBR.get(abbr.toUpperCase()) ?? null;
}

export function teamLogoPath(abbr: string): string {
  return `/teams/${abbr.toUpperCase()}.svg`;
}
