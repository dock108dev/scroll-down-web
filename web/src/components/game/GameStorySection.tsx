"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { STORY_QUALITY_GATE } from "@/lib/config";
import type { GameDetailResponse } from "@/lib/types";
import type { BoxScoreInput } from "@/lib/salient-events";

interface Props {
  gameId: number;
  data: GameDetailResponse;
}

interface StoryState {
  text: string;
  storyId: string;
}

export function GameStorySection({ gameId, data }: Props) {
  const [story, setStory] = useState<StoryState | null>(null);
  const [voted, setVoted] = useState<"up" | "down" | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (STORY_QUALITY_GATE || fetchedRef.current) return;
    fetchedRef.current = true;

    const game = data.game;
    const input: BoxScoreInput = {
      sport: game.leagueCode.toUpperCase(),
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      homeScore: game.homeScore ?? 0,
      awayScore: game.awayScore ?? 0,
      plays: data.plays ?? undefined,
      playerStats: data.playerStats ?? undefined,
      mlbBatters: data.mlbBatters ?? undefined,
      mlbPitchers: data.mlbPitchers ?? undefined,
    };

    fetch("/api/ai/story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((result: { story?: string } | null) => {
        if (result?.story) {
          setStory({
            text: result.story,
            storyId: `${gameId}-${Date.now()}`,
          });
        }
      })
      .catch(() => {});
  }, [gameId, data]);

  const handleVote = useCallback(
    (vote: "up" | "down") => {
      if (!story || voted !== null) return;
      setVoted(vote);
      fetch("/api/story-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: story.storyId, vote }),
      }).catch(() => {});
    },
    [story, voted],
  );

  if (STORY_QUALITY_GATE || !story) return null;

  if (voted) {
    return (
      <div
        data-testid="game-story-section"
        className="px-4 py-3 space-y-3"
      >
        <p className="text-sm font-light leading-relaxed text-neutral-400">
          {story.text}
        </p>
        <p className="text-xs text-neutral-600">Thanks for the feedback!</p>
      </div>
    );
  }

  return (
    <div data-testid="game-story-section" className="px-4 py-3 space-y-3">
      <p className="text-sm font-light leading-relaxed text-neutral-400">
        {story.text}
      </p>
      <div className="flex items-center gap-3">
        <span className="text-xs text-neutral-600">Was this useful?</span>
        <button
          data-testid="story-feedback-up"
          onClick={() => handleVote("up")}
          aria-label="Yes, this was useful"
          className="px-3 py-1.5 min-h-[44px] min-w-[44px] rounded-lg bg-neutral-800 text-neutral-400 hover:text-emerald-400 hover:bg-neutral-700 transition text-sm"
        >
          +1
        </button>
        <button
          data-testid="story-feedback-down"
          onClick={() => handleVote("down")}
          aria-label="No, this was not useful"
          className="px-3 py-1.5 min-h-[44px] min-w-[44px] rounded-lg bg-neutral-800 text-neutral-400 hover:text-rose-400 hover:bg-neutral-700 transition text-sm"
        >
          -1
        </button>
      </div>
    </div>
  );
}
