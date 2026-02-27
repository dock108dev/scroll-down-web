"use client";

import { useMemo } from "react";
import { useFlow } from "@/hooks/useFlow";
import { FlowBlockCard } from "./FlowBlockCard";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import type { FlowBlock, FlowPlay, SocialPostEntry } from "@/lib/types";

interface FlowContainerProps {
  gameId: number;
  socialPosts?: SocialPostEntry[];
}

/** Derive period display string for a block from its plays */
function periodDisplay(
  block: FlowBlock,
  playsById: Map<number, FlowPlay>,
): string {
  // Get plays for this block, sorted by play_index
  const blockPlays = (block.play_ids ?? [])
    .map((id) => playsById.get(id))
    .filter((p): p is FlowPlay => p != null)
    .sort((a, b) => a.play_index - b.play_index);

  const startClock = blockPlays[0]?.clock;
  const endClock = blockPlays[blockPlays.length - 1]?.clock;

  const startPeriod = `Period ${block.period_start}`;
  const endPeriod = `Period ${block.period_end}`;

  if (block.period_start === block.period_end) {
    if (startClock && endClock) {
      return `${startPeriod} · ${startClock}–${endClock}`;
    }
    return startPeriod;
  }

  // Crosses periods
  const startTime = startClock ?? "";
  const endTime = endClock ?? "";
  if (startTime && endTime) {
    return `${startPeriod} ${startTime} – ${endPeriod} ${endTime}`;
  }
  return `${startPeriod}–${endPeriod}`;
}

export function FlowContainer({ gameId, socialPosts }: FlowContainerProps) {
  const { data, loading, error } = useFlow(gameId);

  // Index plays by play_id for O(1) lookup
  const plays = data?.plays;
  const playsById = useMemo(() => {
    if (!plays) return new Map<number, FlowPlay>();
    const map = new Map<number, FlowPlay>();
    for (const p of plays) {
      map.set(p.play_id, p);
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

  if (error || !data) {
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
          {data.blocks.map((block, i) => (
            <FlowBlockCard
              key={block.block_index ?? i}
              block={block}
              periodLabel={periodDisplay(block, playsById)}
              scoreAfter={Array.isArray(block.score_after) ? block.score_after : undefined}
              homeTeam={data.home_team_abbr ?? data.home_team}
              awayTeam={data.away_team_abbr ?? data.away_team}
              homeColor={data.home_team_color_dark}
              awayColor={data.away_team_color_dark}
              isFirstBlock={i === 0}
              embeddedSocialPost={
                block.embedded_social_post_id != null
                  ? socialPostsById.get(block.embedded_social_post_id)
                  : undefined
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
