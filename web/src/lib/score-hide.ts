import type { GameCore } from "@/stores/game-data";

function normalizeLeague(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeTeam(value: string): string {
  return value.trim().toLowerCase();
}

let cachedLeaguesRef: string[] | null = null;
let cachedTeamsRef: string[] | null = null;
let cachedLeaguesSet = new Set<string>();
let cachedTeamsSet = new Set<string>();

function getNormalizedHiddenSets(hiddenLeagues: string[], hiddenTeams: string[]) {
  if (hiddenLeagues !== cachedLeaguesRef) {
    cachedLeaguesRef = hiddenLeagues;
    cachedLeaguesSet = new Set(hiddenLeagues.map(normalizeLeague));
  }
  if (hiddenTeams !== cachedTeamsRef) {
    cachedTeamsRef = hiddenTeams;
    cachedTeamsSet = new Set(hiddenTeams.map(normalizeTeam));
  }
  return { leagueSet: cachedLeaguesSet, teamSet: cachedTeamsSet };
}

export function isGameHiddenByBlacklist(
  game: GameCore,
  hiddenLeagues: string[],
  hiddenTeams: string[],
): boolean {
  const { leagueSet, teamSet } = getNormalizedHiddenSets(
    hiddenLeagues,
    hiddenTeams,
  );

  if (leagueSet.has(normalizeLeague(game.leagueCode))) return true;

  const teamCandidates = [
    game.homeTeam,
    game.awayTeam,
    game.homeTeamAbbr ?? "",
    game.awayTeamAbbr ?? "",
  ]
    .map(normalizeTeam)
    .filter(Boolean);

  return teamCandidates.some((candidate) => teamSet.has(candidate));
}
