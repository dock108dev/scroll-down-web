/**
 * Section definitions for the game detail page.
 * Determines which sections to show and their default expansion state
 * based on game status and available data.
 */

import type { GameDetailResponse, GameStatus } from "@/lib/types";
import { isFinal, isLive, isPregame } from "@/lib/types";

/** Build the ordered list of sections to display based on game status and data. */
export function getSections(data: GameDetailResponse): string[] {
  const status = data.game.status;
  const game = data.game;

  const hasPregamePosts = data.socialPosts?.some(
    (p) =>
      p.gamePhase === "pregame" &&
      (p.tweetText || p.imageUrl || p.videoUrl) &&
      p.revealLevel !== "post",
  );
  const hasBuzz = !!hasPregamePosts;
  const hasTimeline = (data.plays?.length ?? 0) > 0;
  const hasPlayerStats =
    (data.playerStats?.length ?? 0) > 0 ||
    (data.nhlSkaters?.length ?? 0) > 0 ||
    (data.nhlGoalies?.length ?? 0) > 0 ||
    (data.mlbBatters?.length ?? 0) > 0 ||
    (data.mlbPitchers?.length ?? 0) > 0;
  const hasTeamStats = (data.teamStats?.length ?? 0) > 0;
  const hasAdvanced =
    (data.mlbAdvancedStats?.length ?? 0) > 0 ||
    (data.mlbAdvancedPlayerStats?.length ?? 0) > 0;
  const hasOdds = (data.odds?.length ?? 0) > 0;
  const hasFlow = data.game.hasFlow;
  const hasPostgamePosts = data.socialPosts?.some(
    (p) => p.gamePhase === "postgame",
  );
  const hasWrapUp =
    (data.derivedMetrics != null && Object.keys(data.derivedMetrics).length > 0) ||
    hasOdds ||
    hasPostgamePosts;

  if (isPregame(status, game)) {
    const s: string[] = [];
    if (hasBuzz) s.push("Pregame Buzz");
    if (hasOdds) s.push("Odds");
    return s;
  }

  if (isLive(status, game)) {
    const s: string[] = [];
    if (hasTimeline) s.push("Timeline");
    if (hasPlayerStats) s.push("Player Stats");
    if (hasTeamStats) s.push("Team Stats");
    if (hasAdvanced) s.push("Advanced Stats");
    if (hasOdds) s.push("Odds");
    return s;
  }

  if (isFinal(status, game)) {
    const s: string[] = [];
    if (hasBuzz) s.push("Pregame Buzz");
    if (hasFlow) s.push("Flow");
    if (hasTimeline) s.push("Timeline");
    if (hasPlayerStats) s.push("Player Stats");
    if (hasTeamStats) s.push("Team Stats");
    if (hasAdvanced) s.push("Advanced Stats");
    if (hasOdds) s.push("Odds");
    if (hasWrapUp) s.push("Wrap-Up");
    return s;
  }

  // Fallback (scheduled, etc.)
  const s: string[] = [];
  if (hasBuzz) s.push("Pregame Buzz");
  if (hasOdds) s.push("Odds");
  return s;
}

/** First section in the list, used as initial active section. */
export function getDefaultSection(sections: string[]): string {
  return sections[0] ?? "Pregame Buzz";
}

/** Whether a section should be expanded by default on first visit. */
export function getDefaultExpanded(
  section: string,
  hasFlow: boolean,
  status: GameStatus,
  isGameRead: boolean,
): boolean {
  switch (section) {
    case "Pregame Buzz":
      return isPregame(status);
    case "Flow":
      return true;
    case "Timeline":
      return !hasFlow;
    case "Player Stats":
    case "Team Stats":
    case "Advanced Stats":
      return false;
    case "Odds":
      return false;
    case "Wrap-Up":
      return isGameRead;
    default:
      return false;
  }
}
