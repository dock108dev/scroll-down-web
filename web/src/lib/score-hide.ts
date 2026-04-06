import type { GameCore } from "@/stores/game-data";

function normalizeLeague(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeTeam(value: string): string {
  return value.trim().toLowerCase();
}

export function isGameHiddenByBlacklist(
  game: GameCore,
  hiddenLeagues: string[],
  hiddenTeams: string[],
): boolean {
  const leagueSet = new Set(hiddenLeagues.map(normalizeLeague));
  const teamSet = new Set(hiddenTeams.map(normalizeTeam));

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
