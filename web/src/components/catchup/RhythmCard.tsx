"use client";

import type {
  InningTransitionCard as InningTransitionCardData,
  RhythmCard as RhythmCardData,
} from "@/lib/types";

interface RhythmCardProps {
  card: InningTransitionCardData | RhythmCardData;
  isActive: boolean;
}

/**
 * Pacing card slipped between play cards by the rhythm planner. Covers
 * inning-transition (END 3RD), quiet-stretch (compressed dead innings),
 * late-game (entering the pressure phase), and final-setup (last beat
 * before the climactic play). Pure pacing beat — no animation timeline
 * beyond a fade-in once active. Reads as the device taking a breath.
 *
 * Different `kind` values get a small eyebrow label change so the user
 * subconsciously reads which sort of pacing beat they just hit.
 */
export function RhythmCard({ card, isActive }: RhythmCardProps) {
  const eyebrow = eyebrowFor(card.kind);
  return (
    <article
      data-testid={`${card.kind}-card`}
      data-active={isActive ? "true" : "false"}
      data-card-id={card.cardId}
      data-rhythm-kind={card.kind}
      className={`catchup-card-snap rhythm-card rhythm-card-${card.kind}`}
    >
      <div className="rhythm-card-inner">
        <p className="rhythm-card-eyebrow">{eyebrow}</p>
        <h2 className="rhythm-card-label">{card.label}</h2>
        <div className="rhythm-card-score">
          <ScoreLine abbr={card.awayTeamAbbr} value={card.score.away} />
          <span className="rhythm-card-score-sep" aria-hidden>—</span>
          <ScoreLine abbr={card.homeTeamAbbr} value={card.score.home} />
        </div>
        {card.subtitle && (
          <p className="rhythm-card-subtitle">{card.subtitle}</p>
        )}
      </div>
      <footer className="catchup-card-footer" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </footer>
    </article>
  );
}

function eyebrowFor(kind: RhythmCardProps["card"]["kind"]): string {
  switch (kind) {
    case "inning-transition": return "INNING";
    case "quiet-stretch":     return "BREATH";
    case "late-game":         return "PRESSURE";
    case "final-setup":       return "STAGE SET";
  }
}

function ScoreLine({ abbr, value }: { abbr: string; value: number }) {
  return (
    <span className="rhythm-card-score-line">
      <span className="rhythm-card-score-abbr">{abbr}</span>
      <span className="rhythm-card-score-num">{value}</span>
    </span>
  );
}
