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
    ? "text-base font-semibold text-[color:var(--home-team-text)]"
    : "text-sm font-medium text-[color:var(--home-team-text)]";

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
          <span className="text-[color:var(--home-sep-color)]">@</span>
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
                ? "shrink-0 rounded-sm border border-[color:var(--home-badge-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[color:var(--home-badge-text)]"
                : "shrink-0 rounded-sm border border-[color:var(--home-badge-border-soft)] px-2 py-0.5 text-[10px] font-medium text-[color:var(--home-badge-text)]"
          }
        >
          {status.tone === "live" && (
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
          )}
          {status.label}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-[color:var(--home-badge-text)]">
          {formatDate(game.gameDate)}
        </span>
        {!pregame && (
          <span
            className={
              featured
                ? "inline-flex items-center gap-1 rounded-md border border-[color:var(--home-cta-border)] bg-[color:var(--home-cta-bg)] px-3 py-1.5 text-xs font-semibold text-[color:var(--home-cta-color)]"
                : completed
                  ? "text-xs text-[color:var(--home-badge-text)]"
                  : "text-xs font-medium text-[color:var(--home-cta-color)] inline-flex items-center gap-1"
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
    ? "block rounded-lg border border-[color:var(--home-card-border-featured)] [background:var(--home-grad-featured)] px-5 py-5 transition hover:border-[color:var(--home-card-border-featured-hover)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_4px_16px_rgba(0,0,0,0.45)]"
    : "block rounded-lg border border-[color:var(--home-card-border)] bg-[color:var(--home-card-bg)] px-4 py-3 transition hover:border-[color:var(--home-card-border-hover)]";

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
