"use client";

import { useState, useMemo } from "react";
import type { SocialPostEntry } from "@/lib/types";
import { SocialPostCard } from "./SocialPostCard";

interface SocialSectionProps {
  posts: SocialPostEntry[];
  phase: "pregame" | "postgame";
  outcomeRevealed: boolean;
}

const PAGE_SIZE = 5;

export function SocialSection({ posts, phase, outcomeRevealed }: SocialSectionProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const phasePosts = posts.filter((p) => {
      // Must match phase
      if (p.gamePhase !== phase) return false;
      // Must have content
      if (!p.tweetText && !p.imageUrl && !p.videoUrl) return false;
      // Spoiler protection: skip "post" revealLevel unless outcome revealed
      if (p.revealLevel === "post" && !outcomeRevealed) return false;
      return true;
    });

    // Sort: pregame by likes desc, postgame by postedAt asc
    if (phase === "pregame") {
      phasePosts.sort((a, b) => (b.likesCount ?? 0) - (a.likesCount ?? 0));
    } else {
      phasePosts.sort(
        (a, b) => new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime(),
      );
    }

    return phasePosts;
  }, [posts, phase, outcomeRevealed]);

  if (filtered.length === 0) return null;

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;
  const title = phase === "pregame" ? "Pregame Buzz" : "Reactions";

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide">
          {title}
        </h3>
        <span className="text-[11px] text-neutral-600">{filtered.length}</span>
      </div>

      <div className="space-y-3">
        {visible.map((post) => (
          <SocialPostCard key={post.id} post={post} mode="standard" />
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="mt-3 w-full text-center text-xs text-neutral-400 hover:text-neutral-200 transition-colors py-2 rounded-md hover:bg-neutral-800/50"
        >
          Show more ({filtered.length - visibleCount} remaining)
        </button>
      )}
    </div>
  );
}
