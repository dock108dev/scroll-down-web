"use client";

import { useRouter } from "next/navigation";
import type { GameStatus } from "@/lib/types";
import { isLive, isFinal } from "@/lib/types";
import { usePinnedGames } from "@/stores/pinned-games";
import type { PinnedGameDisplay } from "@/stores/pinned-games";
import { useReadState } from "@/stores/read-state";
import { useSettings } from "@/stores/settings";
import { useReadingPosition } from "@/stores/reading-position";

function ChipScore({ game }: { game: PinnedGameDisplay }) {
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);
  const isRead = useReadState((s) => s.isRead);
  const getPosition = useReadingPosition((s) => s.getPosition);

  const read = isRead(game.id);
  const showScore =
    (game.homeScore != null && game.awayScore != null) &&
    (scoreRevealMode === "always" || read);

  const pos = getPosition(game.id);
  const hasSavedScores = pos?.homeScore != null && pos?.awayScore != null;

  if (!showScore && !hasSavedScores) return null;

  const away = showScore ? game.awayScore : pos!.awayScore;
  const home = showScore ? game.homeScore : pos!.homeScore;

  return (
    <span className="ml-1 text-[10px] tabular-nums text-neutral-400">
      {away}–{home}
    </span>
  );
}

function StatusDot({ status }: { status: GameStatus }) {
  if (isLive(status)) {
    return (
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
      </span>
    );
  }
  if (isFinal(status)) {
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-600" />;
  }
  return null;
}

export function PinnedBar() {
  const router = useRouter();
  const pinnedIds = usePinnedGames((s) => s.pinnedIds);
  const displayData = usePinnedGames((s) => s.displayData);
  const togglePin = usePinnedGames((s) => s.togglePin);

  if (pinnedIds.size === 0) return null;

  // Build ordered list from Set iteration order
  const games: PinnedGameDisplay[] = [];
  for (const id of pinnedIds) {
    const d = displayData.get(id);
    if (d) games.push(d);
  }

  if (games.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none py-1 px-4">
      {games.map((game) => (
        <button
          key={game.id}
          onClick={() => router.push(`/game/${game.id}`)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-neutral-800 pl-2.5 pr-1.5 py-1 text-xs text-neutral-300 hover:bg-neutral-700 transition group"
        >
          <StatusDot status={game.status} />
          <span className="whitespace-nowrap">
            {game.awayTeamAbbr} – {game.homeTeamAbbr}
          </span>
          <ChipScore game={game} />
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePin(game.id);
            }}
            className="ml-0.5 rounded-full p-0.5 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-600 transition"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </span>
        </button>
      ))}
    </div>
  );
}
