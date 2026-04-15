"use client";

import { useRouter } from "next/navigation";
import type { GameStatus } from "@/lib/types";
import { isLive, isFinal } from "@/lib/types";
import { usePinnedGames } from "@/stores/pinned-games";
import { useGameData } from "@/stores/game-data";
import { useSpoilerGate } from "@/hooks/useSpoilerGate";

function ChipScore({ gameId }: { gameId: number }) {
  const gate = useSpoilerGate(gameId);

  if (!gate?.revealed) return null;

  return (
    <span
      role="button"
      onClick={(e) => {
        e.stopPropagation();
        if (gate.hasUpdate) gate.acceptUpdate();
      }}
      className={`ml-1 text-[10px] tabular-nums ${gate.hasUpdate ? "text-amber-400" : "text-neutral-400"}`}
    >
      {gate.awayScore}&ndash;{gate.homeScore}
    </span>
  );
}

function StatusDot({ status, game }: { status?: GameStatus; game?: { isLive?: boolean; isFinal?: boolean } }) {
  if (!status) return null;
  if (isLive(status, game)) {
    return (
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
      </span>
    );
  }
  if (isFinal(status, game)) {
    return <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-600" />;
  }
  return null;
}

export function PinnedBar() {
  const router = useRouter();
  const pinnedIds = usePinnedGames((s) => s.pinnedIds);
  const pinMeta = usePinnedGames((s) => s.pinMeta);
  const togglePin = usePinnedGames((s) => s.togglePin);
  const games = useGameData((s) => s.games);

  if (pinnedIds.size === 0) return null;

  const chips: { id: number; awayTeamAbbr: string; homeTeamAbbr: string; status?: GameStatus; isLive?: boolean; isFinal?: boolean }[] = [];
  for (const id of pinnedIds) {
    const entry = games.get(id);
    if (entry) {
      chips.push({
        id,
        awayTeamAbbr: entry.core.awayTeamAbbr ?? "AWY",
        homeTeamAbbr: entry.core.homeTeamAbbr ?? "HME",
        status: entry.core.status,
        isLive: entry.core.isLive,
        isFinal: entry.core.isFinal,
      });
    } else {
      const meta = pinMeta.get(id);
      if (meta) {
        chips.push({
          id,
          awayTeamAbbr: meta.awayTeamAbbr,
          homeTeamAbbr: meta.homeTeamAbbr,
        });
      }
    }
  }

  if (chips.length === 0) return null;

  return (
    <div data-testid="pinned-bar" className="flex gap-2 overflow-x-auto scrollbar-none py-1 px-4">
      {chips.map((chip) => (
        <button
          key={chip.id}
          data-testid="pinned-chip"
          onClick={() => router.push(`/game/${chip.id}`)}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-neutral-800 pl-2.5 pr-1.5 py-1 text-xs text-neutral-300 hover:bg-neutral-700 transition group"
        >
          <StatusDot status={chip.status} game={chip} />
          <span className="whitespace-nowrap">
            {chip.awayTeamAbbr} &ndash; {chip.homeTeamAbbr}
          </span>
          <ChipScore gameId={chip.id} />
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              togglePin(chip.id);
            }}
            className="ml-0.5 rounded-full p-2 -mr-1 text-neutral-500 hover:text-neutral-200 hover:bg-neutral-600 transition"
            aria-label={`Unpin ${chip.awayTeamAbbr} vs ${chip.homeTeamAbbr}`}
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
