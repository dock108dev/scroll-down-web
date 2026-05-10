"use client";

import Link from "next/link";
import type { GameSummary } from "@/lib/types";
import { isFinal, isLive, isPregame } from "@/lib/types";
import { findMlbTeam, teamLogoPath } from "@/lib/mlb-teams";
import { formatDate, formatTimeET } from "@/lib/utils";

interface GameRowProps {
  game: GameSummary;
  /** Hero card on the home page — bigger CTA, more prominent. */
  featured?: boolean;
  /** User has tapped through the reveal screen for this game. */
  completed?: boolean;
  /** User has saved progress but hasn't completed yet. */
  inProgress?: boolean;
}

function statusBadge(game: GameSummary): { label: string; tone: "live" | "final" | "upcoming" } {
  if (isLive(game.status, game)) return { label: "Live", tone: "live" };
  if (isFinal(game.status, game)) return { label: "Final", tone: "final" };
  if (isPregame(game.status, game)) return { label: formatTimeET(game.gameDate), tone: "upcoming" };
  return { label: "Scheduled", tone: "upcoming" };
}

export function GameRow({ game, featured = false, completed = false, inProgress = false }: GameRowProps) {
  const home = findMlbTeam(game.homeTeamAbbr);
  const away = findMlbTeam(game.awayTeamAbbr);
  const status = statusBadge(game);
  const pregame = isPregame(game.status, game);

  const cta = featured
    ? completed
      ? "Watched"
      : inProgress
        ? "Resume reconstruction"
        : "Reconstruct"
    : completed
      ? "Watched"
      : inProgress
        ? "Resume"
        : "Reconstruct";

  const teamNameClass = featured
    ? "text-base font-semibold text-[#f5f1e8]"
    : "text-sm font-medium text-[#f5f1e8]";

  const inner = (
    <>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={teamLogoPath(game.awayTeamAbbr ?? "")}
              alt=""
              width={featured ? 32 : 24}
              height={featured ? 32 : 24}
              className={featured ? "h-8 w-8 object-contain" : "h-6 w-6 object-contain"}
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
            <span className={teamNameClass}>
              {away?.name ?? game.awayTeam}
            </span>
          </div>
          <span className="text-[rgba(245,181,54,0.30)]">@</span>
          <div className="flex items-center gap-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={teamLogoPath(game.homeTeamAbbr ?? "")}
              alt=""
              width={featured ? 32 : 24}
              height={featured ? 32 : 24}
              className={featured ? "h-8 w-8 object-contain" : "h-6 w-6 object-contain"}
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
            />
            <span className={teamNameClass}>
              {home?.name ?? game.homeTeam}
            </span>
          </div>
        </div>

        <span
          className={
            status.tone === "live"
              ? "shrink-0 inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-400"
              : status.tone === "final"
                ? "shrink-0 rounded-sm border border-[rgba(245,181,54,0.22)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#9b7626]"
                : "shrink-0 rounded-sm border border-[rgba(245,181,54,0.16)] px-2 py-0.5 text-[10px] font-medium text-[#9b7626]"
          }
        >
          {status.tone === "live" && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
          )}
          {status.label}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-neutral-500">
          {formatDate(game.gameDate)}
        </span>
        {!pregame && (
          <span
            className={
              featured
                ? "inline-flex items-center gap-1 rounded-md border border-[rgba(246,196,83,0.38)] bg-[rgba(246,196,83,0.12)] px-3 py-1.5 text-xs font-semibold text-[#f6c453]"
                : completed
                  ? "text-xs text-neutral-500"
                  : "text-xs font-medium text-[#f6c453] inline-flex items-center gap-1"
            }
          >
            {cta}
            {!featured && !completed && (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </span>
        )}
      </div>
    </>
  );

  const className = featured
    ? "block rounded-lg border border-[rgba(245,181,54,0.32)] [background:linear-gradient(180deg,#1d1f24_0%,#15161a_100%)] px-5 py-5 transition hover:border-[rgba(245,181,54,0.50)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_4px_16px_rgba(0,0,0,0.45)]"
    : "block rounded-lg border border-[rgba(245,181,54,0.14)] bg-[#13141a] px-4 py-3 transition hover:border-[rgba(245,181,54,0.28)]";

  if (pregame) {
    return (
      <div data-testid={`game-row-${game.id}`} aria-disabled className={`${className} opacity-70 cursor-not-allowed`}>
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={`/catchup/${game.id}`}
      data-testid={`game-row-${game.id}`}
      data-featured={featured ? "true" : "false"}
      className={className}
    >
      {inner}
    </Link>
  );
}
