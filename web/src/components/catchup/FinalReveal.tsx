"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { findMlbTeam, teamLogoPath } from "@/lib/mlb-teams";
import { BOX_SCORE } from "@/lib/config";
import type { CatchupSummaryResponse } from "@/lib/types";

interface FinalRevealProps {
  gameId: number;
  homeTeamAbbr: string;
  awayTeamAbbr: string;
  homeTeam: string;
  awayTeam: string;
}

/**
 * Post-tap reveal screen. Fetches /api/games/[gameId]/summary, animates the
 * final score in, renders the recap if available (or a graceful box-score
 * fallback if not), and offers the next-game CTA.
 */
export function FinalReveal({
  gameId,
  homeTeamAbbr,
  awayTeamAbbr,
  homeTeam,
  awayTeam,
}: FinalRevealProps) {
  const [data, setData] = useState<CatchupSummaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .summary(gameId)
      .then((res) => {
        if (cancelled) return;
        setData(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load result");
      });
    return () => {
      cancelled = true;
    };
  }, [gameId]);

  if (error && !data) {
    return (
      <div className="final-reveal-error">
        <p>{error}</p>
        <Link href="/" className="text-blue-400 hover:text-blue-300 text-sm">
          Back to games
        </Link>
      </div>
    );
  }

  if (!data) return <FinalRevealSkeleton awayTeam={awayTeam} homeTeam={homeTeam} />;

  const homeWon = data.winner === "home";
  const awayWon = data.winner === "away";

  return (
    <section data-testid="final-reveal" className="final-reveal">
      <div className="final-reveal-score reveal-fade-in">
        <p className="catchup-eyebrow">Final</p>
        <div className="final-reveal-score-row">
          <ScoreBlock
            abbr={awayTeamAbbr}
            name={findMlbTeam(awayTeamAbbr)?.name ?? awayTeam}
            score={data.finalScore.away}
            winner={awayWon}
          />
          <span className="final-reveal-score-sep">·</span>
          <ScoreBlock
            abbr={homeTeamAbbr}
            name={findMlbTeam(homeTeamAbbr)?.name ?? homeTeam}
            score={data.finalScore.home}
            winner={homeWon}
          />
        </div>
      </div>

      <div className="final-reveal-summary">
        <h3 className="final-reveal-summary-heading">Recap</h3>
        {data.summary?.trim() ? (
          <p className="final-reveal-summary-text">{data.summary}</p>
        ) : (
          <p className="final-reveal-summary-fallback">
            A written recap isn&rsquo;t ready yet. Head to the box score for the full breakdown.
          </p>
        )}
      </div>

      <div className="final-reveal-actions">
        <a
          href={BOX_SCORE.url(gameId)}
          target="_blank"
          rel="noopener noreferrer"
          className="final-reveal-secondary"
        >
          {BOX_SCORE.label}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 17l9.2-9.2M17 17V7H7" />
          </svg>
        </a>
        <Link href="/" className="final-reveal-primary">
          Catch up on another game
        </Link>
      </div>
    </section>
  );
}

function ScoreBlock({
  abbr,
  name,
  score,
  winner,
}: {
  abbr: string;
  name: string;
  score: number;
  winner: boolean;
}) {
  return (
    <div className={winner ? "final-reveal-team final-reveal-team-winner" : "final-reveal-team"}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={teamLogoPath(abbr)}
        alt=""
        width={48}
        height={48}
        className="h-12 w-12 object-contain"
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
      />
      <span className="final-reveal-team-score">{score}</span>
      <span className="final-reveal-team-name">{name}</span>
    </div>
  );
}

function FinalRevealSkeleton({ awayTeam, homeTeam }: { awayTeam: string; homeTeam: string }) {
  return (
    <section className="final-reveal" aria-busy>
      <p className="catchup-eyebrow">Tallying…</p>
      <p className="text-sm text-neutral-400">{awayTeam} at {homeTeam}</p>
      <div className="final-reveal-skeleton" />
    </section>
  );
}
