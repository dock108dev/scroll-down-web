/**
 * Channel naming helpers for the realtime transport layer.
 * Channels follow the pattern: {entity}:{qualifier}:{sub}
 */

export function gameListChannel(league: string, date: string): string {
  return `games:${league || "all"}:${date}`;
}

export function gameSummaryChannel(gameId: number): string {
  return `game:${gameId}:summary`;
}

export function gamePbpChannel(gameId: number): string {
  return `game:${gameId}:pbp`;
}

export function fairbetChannel(): string {
  return `fairbet:odds`;
}
