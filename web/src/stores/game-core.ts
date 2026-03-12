/**
 * Helpers to normalize GameSummary and Game objects into a unified GameCore shape.
 * Extracted from game-data store to keep the store focused on state management.
 */

import type { GameSummary, Game, PlayEntry } from "@/lib/types";
import type { GameCore } from "./game-data";

export function coreFromSummary(g: GameSummary): GameCore {
  return {
    id: g.id,
    leagueCode: g.leagueCode,
    gameDate: g.gameDate,
    status: g.status,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    homeScore: g.homeScore ?? null,
    awayScore: g.awayScore ?? null,
    currentPeriod: g.currentPeriod,
    gameClock: g.liveSnapshot?.gameClock ?? g.liveSnapshot?.timeLabel ?? g.gameClock,
    currentPeriodLabel: g.liveSnapshot?.periodLabel ?? g.currentPeriodLabel,
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
  return {
    id: g.id,
    leagueCode: g.leagueCode,
    gameDate: g.gameDate,
    status: g.status,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    homeScore: lastPlay?.homeScore ?? g.homeScore ?? null,
    awayScore: lastPlay?.awayScore ?? g.awayScore ?? null,
    currentPeriod: g.currentPeriod,
    gameClock: g.liveSnapshot?.gameClock ?? g.liveSnapshot?.timeLabel ?? clockFromPlay ?? g.gameClock,
    currentPeriodLabel: g.liveSnapshot?.periodLabel ?? periodFromPlay ?? g.currentPeriodLabel,
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
