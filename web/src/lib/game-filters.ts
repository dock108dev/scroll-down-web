import type { GameSummary } from "@/lib/types";

type TeamMatchup = Pick<GameSummary, "homeTeam" | "awayTeam">;

export function isTbdTeamName(team: string | null | undefined): boolean {
  return team?.trim().toUpperCase() === "TBD";
}

export function hasTbdMatchup(game: TeamMatchup): boolean {
  return isTbdTeamName(game.homeTeam) || isTbdTeamName(game.awayTeam);
}

export function filterOutTbdGames<T extends TeamMatchup>(games: T[]): T[] {
  return games.filter((game) => !hasTbdMatchup(game));
}
