/**
 * Helpers to normalize GameSummary and Game objects into a unified GameCore shape.
 * Extracted from game-data store to keep the store focused on state management.
 */

import type { GameSummary, Game, PlayEntry } from "@/lib/types";
import type { GameCore } from "./game-data";

type ApiLocalDate = { localGameDate?: string; local_game_date?: string };

function pickLocalGameDate(g: ApiLocalDate): string | undefined {
  return g.localGameDate ?? g.local_game_date;
}

export function coreFromSummary(g: GameSummary): GameCore {
  const periodLabel = g.liveSnapshot?.periodLabel ?? g.currentPeriodLabel;
  const rawClock = g.liveSnapshot?.gameClock ?? g.liveSnapshot?.timeLabel ?? g.gameClock;
  // MLB has no running clock — timeLabel duplicates the inning label, so suppress it
  const gameClock = rawClock && rawClock === periodLabel ? undefined : rawClock;
  // Backend sends scores as nested { score: { home, away } } both at the
  // top level and under liveSnapshot. Flat homeScore/awayScore is kept as a
  // fallback for older fixtures and tests.
  const home =
    g.score?.home ??
    g.liveSnapshot?.score?.home ??
    g.homeScore ??
    g.liveSnapshot?.homeScore ??
    null;
  const away =
    g.score?.away ??
    g.liveSnapshot?.score?.away ??
    g.awayScore ??
    g.liveSnapshot?.awayScore ??
    null;
  return {
    id: g.id,
    leagueCode: g.leagueCode,
    gameDate: g.gameDate,
    localGameDate: pickLocalGameDate(g as GameSummary & ApiLocalDate),
    status: g.status,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    homeScore: home,
    awayScore: away,
    currentPeriod: g.currentPeriod,
    gameClock,
    currentPeriodLabel: periodLabel,
    homeTeamAbbr: g.homeTeamAbbr,
    awayTeamAbbr: g.awayTeamAbbr,
    homeTeamColorLight: g.homeTeamColorLight,
    homeTeamColorDark: g.homeTeamColorDark,
    awayTeamColorLight: g.awayTeamColorLight,
    awayTeamColorDark: g.awayTeamColorDark,
    hasBoxscore: g.hasBoxscore,
    hasPlayerStats: g.hasPlayerStats,
    hasOdds: g.hasOdds,
    hasSocial: g.hasSocial,
    hasPbp: g.hasPbp,
    hasFlow: g.hasFlow,
    hasAdvancedStats: g.hasAdvancedStats,
    playCount: g.playCount,
    socialPostCount: g.socialPostCount,
    hasRequiredData: g.hasRequiredData,
    isLive: g.isLive,
    isFinal: g.isFinal,
    isPregame: g.isPregame,
    isTrulyCompleted: g.isTrulyCompleted,
    readEligible: g.readEligible,
    dateSection: g.dateSection,
    liveSnapshot: g.liveSnapshot,
  };
}

export function coreFromGame(
  g: Game,
  plays?: Pick<PlayEntry, "homeScore" | "awayScore" | "gameClock" | "timeLabel" | "periodLabel">[],
): GameCore {
  const lastPlay = plays?.length ? plays[plays.length - 1] : null;
  const clockFromPlay = lastPlay?.gameClock ?? lastPlay?.timeLabel;
  const periodFromPlay = lastPlay?.periodLabel;
  const periodLabel = g.liveSnapshot?.periodLabel ?? periodFromPlay ?? g.currentPeriodLabel;
  const rawClock = g.liveSnapshot?.gameClock ?? g.liveSnapshot?.timeLabel ?? clockFromPlay ?? g.gameClock;
  // MLB has no running clock — timeLabel duplicates the inning label, so suppress it
  const gameClock = rawClock && rawClock === periodLabel ? undefined : rawClock;
  // Priority: last play (PBP is authoritative for live) → nested g.score →
  // nested liveSnapshot.score → flat fallbacks.
  const home =
    lastPlay?.homeScore ??
    g.score?.home ??
    g.liveSnapshot?.score?.home ??
    g.homeScore ??
    g.liveSnapshot?.homeScore ??
    null;
  const away =
    lastPlay?.awayScore ??
    g.score?.away ??
    g.liveSnapshot?.score?.away ??
    g.awayScore ??
    g.liveSnapshot?.awayScore ??
    null;
  return {
    id: g.id,
    leagueCode: g.leagueCode,
    gameDate: g.gameDate,
    localGameDate: pickLocalGameDate(g as Game & ApiLocalDate),
    status: g.status,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    homeScore: home,
    awayScore: away,
    currentPeriod: g.currentPeriod,
    gameClock,
    currentPeriodLabel: periodLabel,
    homeTeamAbbr: g.homeTeamAbbr,
    awayTeamAbbr: g.awayTeamAbbr,
    homeTeamColorLight: g.homeTeamColorLight,
    homeTeamColorDark: g.homeTeamColorDark,
    awayTeamColorLight: g.awayTeamColorLight,
    awayTeamColorDark: g.awayTeamColorDark,
    hasBoxscore: g.hasBoxscore,
    hasPlayerStats: g.hasPlayerStats,
    hasOdds: g.hasOdds,
    hasSocial: g.hasSocial,
    hasPbp: g.hasPbp,
    hasFlow: g.hasFlow,
    hasAdvancedStats: g.hasAdvancedStats,
    playCount: g.playCount,
    socialPostCount: g.socialPostCount,
    isLive: g.isLive,
    isFinal: g.isFinal,
    isPregame: g.isPregame,
    isTrulyCompleted: g.isTrulyCompleted,
    readEligible: g.readEligible,
    dateSection: g.dateSection,
    liveSnapshot: g.liveSnapshot,
    season: g.season,
    seasonType: g.seasonType,
    scrapeVersion: g.scrapeVersion,
    lastScrapedAt: g.lastScrapedAt,
    lastIngestedAt: g.lastIngestedAt,
    lastPbpAt: g.lastPbpAt,
    lastSocialAt: g.lastSocialAt,
    lastOddsAt: g.lastOddsAt,
    homeTeamXHandle: g.homeTeamXHandle,
    awayTeamXHandle: g.awayTeamXHandle,
  };
}
