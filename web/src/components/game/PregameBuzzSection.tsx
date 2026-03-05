"use client";

import type { GameDetailResponse } from "@/lib/types";
import { SocialSection } from "./SocialSection";

interface PregameBuzzSectionProps {
  data: GameDetailResponse;
}

export function PregameBuzzSection({ data }: PregameBuzzSectionProps) {
  return (
    <div className="px-4">
      <SocialSection posts={data.socialPosts} phase="pregame" outcomeRevealed={false} />
    </div>
  );
}
