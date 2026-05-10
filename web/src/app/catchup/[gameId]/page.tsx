"use client";

import { use, useEffect } from "react";
import { CatchupExperience } from "@/components/catchup/CatchupExperience";
import { trackEvent } from "@/lib/analytics";

export default function CatchupPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId: gameIdStr } = use(params);
  const gameId = Number(gameIdStr);

  useEffect(() => {
    trackEvent("catchup_open", { gameId: String(gameId) });
  }, [gameId]);

  if (!Number.isFinite(gameId)) {
    return (
      <div className="mx-auto max-w-md px-4 py-12 text-center">
        <p className="text-sm text-neutral-400">That game link doesn&rsquo;t look right.</p>
      </div>
    );
  }

  return <CatchupExperience gameId={gameId} />;
}
