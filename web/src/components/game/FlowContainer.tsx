"use client";

import { useMemo } from "react";
import { useFlow } from "@/hooks/useFlow";
import { FlowBlockCard } from "./FlowBlockCard";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import type { FlowBlock, FlowPlay, FlowMoment, SocialPostEntry } from "@/lib/types";

interface FlowContainerProps {
  gameId: number;
  socialPosts?: SocialPostEntry[];
}

/** Map a period number to a sport-appropriate label */
function periodLabel(period: number, league?: string): string {
  const lc = league?.toLowerCase() ?? "";

  // NCAAB: 2 halves, then OT
  if (lc === "ncaab") {
    if (period <= 2) return `Half ${period}`;
    return period === 3 ? "OT" : `${period - 2}OT`;
  }

  // NBA: 4 quarters, then OT
  if (lc === "nba") {
    if (period <= 4) return `Q${period}`;
    return period === 5 ? "OT" : `${period - 4}OT`;
  }

  // NFL / NCAAF: 4 quarters, then OT
  if (lc === "nfl" || lc === "ncaaf") {
    if (period <= 4) return `Q${period}`;
    return period === 5 ? "OT" : `${period - 4}OT`;
  }

  // NHL: 3 periods, then OT / SO
  if (lc === "nhl") {
    if (period <= 3) return `Period ${period}`;
    if (period === 4) return "OT";
    return "SO";
  }

  // MLB: innings
  if (lc === "mlb") {
    return `Inning ${period}`;
  }

  // Fallback
  return `Period ${period}`;
}

/** Derive period display string for a block, falling back to plays/moments */
function periodDisplay(
  block: FlowBlock,
  playsById: Map<number, FlowPlay>,
  moments?: FlowMoment[],
  leagueCode?: string,
): string {
  // Get plays for this block, sorted by playIndex
  const blockPlays = (block.playIds ?? [])
    .map((id) => playsById.get(id))
    .filter((p): p is FlowPlay => p != null)
    .sort((a, b) => a.playIndex - b.playIndex);

  const startClock = blockPlays[0]?.clock;
  const endClock = blockPlays[blockPlays.length - 1]?.clock;

  // Resolve period: block fields → plays → moments
  let periodStart = block.periodStart;
  let periodEnd = block.periodEnd;

  if (periodStart == null && blockPlays.length > 0) {
    periodStart = blockPlays[0].period;
    periodEnd = blockPlays[blockPlays.length - 1].period;
  }

  if (periodStart == null && moments && block.momentIndices?.length > 0) {
    const firstMoment = moments[block.momentIndices[0]];
    const lastMoment = moments[block.momentIndices[block.momentIndices.length - 1]];
    if (firstMoment) periodStart = firstMoment.period;
    if (lastMoment) periodEnd = lastMoment.period;
  }

  if (periodStart == null) return "";

  periodEnd = periodEnd ?? periodStart;

  const startLabel = periodLabel(periodStart, leagueCode);
  const endLabel = periodLabel(periodEnd, leagueCode);

  if (periodStart === periodEnd) {
    if (startClock && endClock) return `${startLabel} · ${startClock}–${endClock}`;
    return startLabel;
  }

  const startTime = startClock ?? "";
  const endTime = endClock ?? "";
  if (startTime && endTime) return `${startLabel} ${startTime} – ${endLabel} ${endTime}`;
  return `${startLabel}–${endLabel}`;
}

/** Get score_after for a block, falling back to moments data */
function resolveScoreAfter(
  block: FlowBlock,
  moments?: FlowMoment[],
): number[] | undefined {
  if (Array.isArray(block.scoreAfter) && block.scoreAfter.length >= 2) {
    return block.scoreAfter;
  }
  // Fall back to last moment's score_after
  if (moments && block.momentIndices?.length > 0) {
    const lastIdx = block.momentIndices[block.momentIndices.length - 1];
    const lastMoment = moments[lastIdx];
    if (lastMoment && Array.isArray(lastMoment.scoreAfter) && lastMoment.scoreAfter.length >= 2) {
      return lastMoment.scoreAfter;
    }
  }
  return undefined;
}

export function FlowContainer({ gameId, socialPosts }: FlowContainerProps) {
  const { data, loading, error } = useFlow(gameId);

  // Index plays by play_id for O(1) lookup
  const plays = data?.plays;
  const playsById = useMemo(() => {
    if (!plays) return new Map<number, FlowPlay>();
    const map = new Map<number, FlowPlay>();
    for (const p of plays) {
      map.set(p.playId, p);
    }
    return map;
  }, [plays]);

  // Index social posts by id for embedded lookup
  const socialPostsById = useMemo(() => {
    if (!socialPosts) return new Map<number, SocialPostEntry>();
    return new Map(socialPosts.map((p) => [p.id, p]));
  }, [socialPosts]);

  if (loading) {
    return (
      <div className="px-4 space-y-3">
        <LoadingSkeleton count={3} className="h-32" />
      </div>
    );
  }

  // Resolve blocks/moments from either nested `flow` or top-level fields
  const blocks = data?.flow?.blocks ?? data?.blocks;
  const moments = data?.flow?.moments ?? data?.moments;

  if (error || !data || !blocks || blocks.length === 0) {
    return (
      <div className="px-4 py-4 text-sm text-neutral-500">
        {error ?? "No flow data available"}
      </div>
    );
  }

  return (
    <div className="px-4 space-y-0">
      <div className="relative">
        <div className="absolute left-6 top-0 bottom-0 w-px bg-neutral-800" />
        <div className="space-y-4 relative">
          {blocks.map((block, i) => (
            <FlowBlockCard
              key={block.blockIndex ?? i}
              block={block}
              periodLabel={periodDisplay(block, playsById, moments, data.leagueCode)}
              scoreAfter={resolveScoreAfter(block, moments)}
              homeTeam={data.homeTeamAbbr ?? data.homeTeam}
              awayTeam={data.awayTeamAbbr ?? data.awayTeam}
              homeColor={data.homeTeamColorDark}
              awayColor={data.awayTeamColorDark}
              isFirstBlock={i === 0}
              embeddedSocialPost={
                block.embeddedSocialPostId != null
                  ? socialPostsById.get(block.embeddedSocialPostId)
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
