"use client";

import { forwardRef, useMemo } from "react";
import type {
  BaseballBaseState,
  PlayCardData,
} from "@/lib/types";
import { findMlbTeam } from "@/lib/mlb-teams";
import {
  inningZone,
  leverageBand,
  leverageWeightMap,
  NARRATIVE_REVEAL_DUR_MS,
  NARRATIVE_SETTLE_BONUS_MS,
} from "@/lib/leverage";
import {
  BRIDGE_MS,
  getPhaseMilestones,
  getPhaseSchedule,
  usePlayPhase,
  usePrefersReducedMotion,
} from "@/lib/play-phases";
import { resultChipTier, type ChipTier } from "@/lib/result-chip";
import { buildRunnerMovements, totalRunnersDurationMs } from "@/lib/runner-paths";
import { BaseballLightField } from "./BaseballLightField";
import { CardNarrative } from "./CardNarrative";

interface CatchupCardProps {
  card: PlayCardData;
  homeTeamAbbr: string;
  awayTeamAbbr: string;
  isActive: boolean;
}

/**
 * Single play card. Driven by a phase machine (see lib/play-phases.ts):
 *   setup → pitch → trigger → ball → runners → settle → reveal
 *
 * Header layout:
 *   ┌─────────────────────────────────────────────────────┐
 *   │ TOP 1ST · ●●○                       TEX 0 — NYY 0    │
 *   │            SEAGER vs RODÓN · 3-1                     │
 *   ├─────────────────────────────────────────────────────┤
 *   │            animated baseball field                   │
 *   ├─────────────────────────────────────────────────────┤
 *   │ Description (hidden until reveal phase)              │
 *   │             scroll cue (after ready)                 │
 *   └─────────────────────────────────────────────────────┘
 *
 * Score holds at scoreBefore through every phase up to settle (the result
 * lock). At settle the chip clicks in, scoreAfter swaps in with a brief
 * pulse on whichever team's number went up, and the outs dot resolves.
 * Sentence + chevron come in at reveal.
 */
export const CatchupCard = forwardRef<HTMLDivElement, CatchupCardProps>(function CatchupCard(
  { card, homeTeamAbbr, awayTeamAbbr, isActive },
  ref,
) {
  const battingTeam = findMlbTeam(card.battingTeamAbbr);
  const accent = battingTeam?.primaryColorDark ?? "#5a8ac6";

  // Runner movement plan: ordered, staggered, with per-runner duration
  // proportional to basepath segment count. Lead runner moves first; HR
  // batter goes last so all runners arrive in order.
  const movements = useMemo(
    () => buildRunnerMovements(card.runnerAdvances ?? [], card.eventType),
    [card.runnerAdvances, card.eventType],
  );

  // The runners phase needs at least as much time as the longest movement
  // (begin + dur). For a 3-run HR that's ~2.2s; the default schedule's
  // 1.1s would chop runners mid-stride.
  const longest = totalRunnersDurationMs(movements);
  const baseSchedule = getPhaseSchedule(card.animationProfile);
  const runnersOverride = longest > baseSchedule.runners
    ? Math.max(baseSchedule.runners, longest + 120)
    : undefined;
  // Bridge phase is enabled when this card has a priorAfter snapshot — it
  // visually inherits the previous card's ending state on mount, then
  // transitions to this card's situationBefore by the time setup begins.
  const bridgeOverride = card.priorAfter ? BRIDGE_MS : undefined;
  // Leverage tier comes from the backend deck DTO (`card.leverageTier`).
  // Drives extra settle before narrative reveal + typography weight. Falls
  // back to 0 (routine) when the backend doesn't ship a tier — unrealistic
  // in practice but typed-safe for legacy data paths.
  const leverageTier: 0 | 1 | 2 = card.leverageTier ?? 0;
  const settleBonus = NARRATIVE_SETTLE_BONUS_MS[leverageTier];
  const settleOverride = settleBonus > 0
    ? baseSchedule.settle + settleBonus
    : undefined;
  const overrides =
    runnersOverride !== undefined ||
    bridgeOverride !== undefined ||
    settleOverride !== undefined
      ? {
          ...(runnersOverride !== undefined ? { runners: runnersOverride } : {}),
          ...(bridgeOverride !== undefined ? { bridge: bridgeOverride } : {}),
          ...(settleOverride !== undefined ? { settle: settleOverride } : {}),
        }
      : undefined;

  const { phase, runId } = usePlayPhase(isActive, card.animationProfile, overrides);
  const milestones = getPhaseMilestones(card.animationProfile, overrides);
  const schedule = getPhaseSchedule(card.animationProfile, overrides);
  const reduceMotion = usePrefersReducedMotion();
  const narrativeRevealDur = reduceMotion ? 0 : NARRATIVE_REVEAL_DUR_MS[leverageTier];

  const situation = card.situationBefore;
  const outsBefore = situation.outs ?? 0;
  const outsAfter = card.outsAfter;
  const baseStateBefore = situation.baseState;
  const baseStateAfter = card.baseStateAfter;
  const priorAfter = card.priorAfter;
  // Bridging beat is meaningful only when the prior state actually differs
  // from this card's beforeState. Otherwise mounting straight into setup
  // looks identical and skipping the beat tightens the pacing.
  const hasMeaningfulBridge = useMemo(
    () => priorAfter !== undefined && bridgingHasDelta(priorAfter, baseStateBefore, outsBefore),
    [priorAfter, baseStateBefore, outsBefore],
  );

  // Score progression — scoreBefore is shown until settle (the result lock
  // beat). Showing scoreAfter sooner would spoil scoring plays. CSS pulses
  // whichever team's number went up at the moment data-flash flips true.
  const showAfter = phase === "settle" || phase === "reveal";
  const score = showAfter ? card.scoreAfter : card.scoreBefore;
  const homeIncreased = card.scoreAfter.home > card.scoreBefore.home;
  const awayIncreased = card.scoreAfter.away > card.scoreBefore.away;
  // Chip text is precomputed by the backend (PlayPayload.label /
  // PlayPayload.subLabel). The tier is a frontend-only visual classifier
  // derived from already-decided data — kept here, not deck logic.
  const chip = {
    primary: card.chipPrimary ?? "PLAY",
    secondary: card.chipSecondary,
  };
  const chipTier = resultChipTier(card);
  const showChip = phase === "settle" || phase === "reveal";

  // The narration panel coexists with the ResultChip beat: settle locks the
  // result, reveal is the terminal state. The reveal branch is required for
  // reduced-motion mode — usePlayPhase collapses straight to reveal at 1ms,
  // skipping settle entirely. A whitespace-only description renders no
  // panel at all so we never paint an empty bordered box. The empty-string
  // fallback below is intentional: missing narration is non-actionable for
  // the user and upstream feed gaps are tracked by validatePlayCard's
  // dev-only warnings. See docs/audits/error-handling-report.md §G4.
  const narrativeText = (card.narrative ?? card.description ?? "").trim();
  const narrativeVisible = phase === "settle" || phase === "reveal";

  // Validation moved to the backend in Phase 3. The deck endpoint runs
  // play-card validation server-side and surfaces findings via
  // `validationWarnings` on the response. Dev-only frontend assertion is
  // no longer the source of truth.

  const battingTeamName = battingTeam?.name ?? card.battingTeamAbbr ?? null;
  const hasCount =
    typeof situation.balls === "number" && typeof situation.strikes === "number";

  // Leverage context — drives ambient visual weight (glow radius, amber
  // intensity, border opacity) so late-inning close games feel hotter.
  const scoreMargin = Math.abs(card.scoreBefore.home - card.scoreBefore.away);
  const clampedMargin = Math.min(9, scoreMargin);
  const zone = inningZone(card.inning);
  const band = leverageBand(card.inning, scoreMargin);

  // Phase milestone CSS variables cascade to all descendants — outs dots,
  // runners cell, score-flash, etc. all key off the same schedule.
  const phaseVars: Record<string, string> = {
    "--field-accent": accent,
    "--ms-bridge":  `${milestones.bridge}ms`,
    "--ms-setup":   `${milestones.setup}ms`,
    "--ms-pitch":   `${milestones.pitch}ms`,
    "--ms-trigger": `${milestones.trigger}ms`,
    "--ms-ball":    `${milestones.ball}ms`,
    "--ms-runners": `${milestones.runners}ms`,
    "--ms-settle":  `${milestones.settle}ms`,
    "--ms-reveal":  `${milestones.reveal}ms`,
    "--ms-ready":   `${milestones.ready}ms`,
    "--d-bridge":   `${schedule.bridge}ms`,
    "--d-pitch":    `${schedule.pitch}ms`,
    "--d-trigger":  `${schedule.trigger}ms`,
    "--d-ball":     `${schedule.ball}ms`,
    "--d-runners":  `${schedule.runners}ms`,
    "--leverage-weight": `${leverageWeightMap[band]}`,
    "--inning-heat":     `${Math.min(1, Math.max(0, (card.inning - 1) / 8))}`,
    "--score-urgency":   `${Math.max(0, 1 - scoreMargin / 5)}`,
  };

  return (
    <article
      ref={ref}
      data-testid="play-card"
      data-card-id={card.cardId}
      data-play-id={card.playIndex}
      data-event-type={card.eventType ?? "other"}
      data-active={isActive ? "true" : "false"}
      data-phase={phase}
      data-has-bridge={hasMeaningfulBridge ? "true" : "false"}
      data-inning={card.inning}
      data-inning-half={card.inningHalf}
      data-inning-zone={zone}
      data-leverage-band={band}
      data-leverage-tier={leverageTier}
      data-score-margin={clampedMargin}
      className="catchup-card-snap"
      style={phaseVars as React.CSSProperties}
    >
      <header className="catchup-card-header" data-testid="score-panel">
        <div className="catchup-card-meta-row">
          <div className="catchup-card-meta-left">
            <span
              className="catchup-card-inning"
              data-testid="inning-state"
              data-inning={card.inning}
              data-half={card.inningHalf}
              title={battingTeamName ? `${battingTeamName} batting` : undefined}
            >
              {card.inningLabel.toUpperCase()}
            </span>
            <span className="catchup-card-meta-sep" aria-hidden>·</span>
            <OutsDots
              prior={hasMeaningfulBridge && priorAfter ? priorAfter.outs : undefined}
              before={outsBefore}
              after={outsAfter}
            />
          </div>
          <div className="catchup-card-score" data-testid="score-display">
            <ScoreSegment
              abbr={awayTeamAbbr}
              value={score.away}
              flash={awayIncreased && showAfter}
              side="away"
              batting={card.inningHalf === "top"}
            />
            <span className="catchup-card-score-sep" aria-hidden>—</span>
            <ScoreSegment
              abbr={homeTeamAbbr}
              value={score.home}
              flash={homeIncreased && showAfter}
              side="home"
              batting={card.inningHalf === "bottom"}
            />
          </div>
        </div>

        {(situation.batterName || situation.pitcherName || hasCount) && (
          <div
            className="catchup-card-matchup"
            data-team-abbr={card.battingTeamAbbr ?? ""}
          >
            {situation.batterName && (
              <span className="catchup-card-batter" title={situation.batterName}>
                {situation.batterName.trim().toUpperCase()}
              </span>
            )}
            {situation.batterName && situation.pitcherName && (
              <span className="catchup-card-vs" aria-hidden>vs</span>
            )}
            {situation.pitcherName && (
              <span className="catchup-card-pitcher" title={situation.pitcherName}>
                {situation.pitcherName.trim().toUpperCase()}
              </span>
            )}
            {hasCount && (
              <span
                className="catchup-card-count"
                data-visible={showAfter ? "true" : "false"}
                aria-hidden={!showAfter}
              >
                {(situation.batterName || situation.pitcherName) && (
                  <span className="catchup-card-count-sep" aria-hidden>·</span>
                )}
                <span className="catchup-card-count-value">
                  {situation.balls}-{situation.strikes}
                </span>
              </span>
            )}
          </div>
        )}

        {situation.pitcherStatLine && (
          <p
            className="catchup-card-pitcher-line"
            data-testid="pitcher-stat-line"
            data-visible={showAfter ? "true" : "false"}
            aria-hidden={!showAfter}
          >
            {situation.pitcherStatLine}
          </p>
        )}
      </header>

      <div className="catchup-card-field">
        <BaseballLightField
          key={runId}
          baseStatePrior={hasMeaningfulBridge ? priorAfter?.baseState : undefined}
          runnerNamesPrior={hasMeaningfulBridge ? priorAfter?.runnerNames : undefined}
          baseStateBefore={baseStateBefore}
          baseStateAfter={baseStateAfter}
          runnerNamesBefore={card.runnerNamesBefore}
          runnerNamesAfter={card.runnerNamesAfter}
          runnerMovements={movements}
          runnersBeginMs={milestones.runners}
          ballPath={card.ballPath}
          eventType={card.eventType}
          animationProfile={card.animationProfile}
          scoreBefore={card.scoreBefore}
          scoreAfter={card.scoreAfter}
          batterLabel={situation.batterName}
          accentColor={accent}
          isActive={isActive}
        />
        {narrativeText && (
          <div
            className="catchup-card-body catchup-card-body--overlay"
            data-visible={narrativeVisible ? "true" : "false"}
            data-testid="play-narration-panel"
          >
            <CardNarrative
              text={narrativeText}
              isActive={narrativeVisible}
              leverage={leverageTier}
              revealDur={narrativeRevealDur}
            />
          </div>
        )}
      </div>

      <ResultChip
        primary={chip.primary}
        secondary={chip.secondary}
        tier={chipTier}
        visible={showChip}
      />

      <footer className="catchup-card-footer" aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </footer>
    </article>
  );
});

// ── Subcomponents ─────────────────────────────────────────

/** Bold device-style result chip — clicks in at the settle (result_lock)
 *  beat, sits between the field and the long-form description. */
function ResultChip({
  primary,
  secondary,
  tier,
  visible,
}: {
  primary: string;
  secondary?: string;
  tier: ChipTier;
  visible: boolean;
}) {
  return (
    <div
      className="catchup-result-chip"
      data-testid="result-badge"
      data-primary={primary}
      data-secondary={secondary ?? ""}
      data-tier={tier}
      data-visible={visible ? "true" : "false"}
      role="status"
      aria-live="polite"
    >
      <span className="catchup-result-chip-primary">{primary}</span>
      {secondary && (
        <span className="catchup-result-chip-secondary">{secondary}</span>
      )}
    </div>
  );
}

function ScoreSegment({
  abbr,
  value,
  flash,
  side,
  batting,
}: {
  abbr: string;
  value: number;
  flash: boolean;
  side: "home" | "away";
  batting?: boolean;
}) {
  return (
    <span
      className="catchup-card-score-line"
      data-side={side}
      data-batting={batting ? "true" : "false"}
    >
      <span className="catchup-card-score-abbr">{abbr}</span>
      <span
        className="catchup-card-score-num"
        data-testid={`score-${side}`}
        data-flash={flash ? "true" : "false"}
      >
        {value}
      </span>
    </span>
  );
}

/** Three LED-style dots. Lit dots represent outs; the dot that lights up
 *  during this play animates a brief pop at the runner-advance phase. When
 *  `prior` is supplied (this card has a bridge beat), dots that need to
 *  light during the BRIDGE phase get a separate lifecycle so the bridge
 *  stage advances the dots from prior → before before the play starts. */
function OutsDots({
  prior,
  before,
  after,
}: {
  prior?: number;
  before: number;
  after: number;
}) {
  const hasBridge = prior !== undefined && prior !== before;
  return (
    <span
      className="outs-dots"
      data-testid="outs-state"
      data-outs-prior={prior ?? ""}
      data-outs-before={before}
      data-outs-after={after}
      data-has-bridge={hasBridge ? "true" : "false"}
      aria-label={`${after} ${after === 1 ? "out" : "outs"}`}
    >
      {[1, 2, 3].map((i) => {
        const wasPrior = prior !== undefined ? i <= prior : i <= before;
        const wasBefore = i <= before;
        const isAfter = i <= after;
        // Compose a lifecycle that captures the dot's history across the
        // three checkpoints (prior → before → after). The CSS keys off the
        // distinct labels to drive the bridge / runners-phase animations.
        const lifecycle =
          wasPrior && wasBefore && isAfter
            ? "on"
            : !wasPrior && wasBefore && isAfter
            ? "bridge-lighting"
            : !wasPrior && !wasBefore && isAfter
            ? "lighting"
            : wasPrior && !wasBefore && isAfter
            ? "bridge-fading-then-on" // unusual: prior had a fake out — keep on after
            : wasBefore && !isAfter
            ? "fading"
            : "off";
        return <span key={i} className="outs-dot" data-state={lifecycle} />;
      })}
      <span className="outs-dots-label">{after === 1 ? "OUT" : "OUTS"}</span>
    </span>
  );
}

/** True when the priorAfter snapshot disagrees with this card's situation
 *  before — i.e. one or more plays slipped in between sampled cards. */
function bridgingHasDelta(
  prior: { baseState: BaseballBaseState; outs: number },
  before: BaseballBaseState,
  outsBefore: number,
): boolean {
  return (
    prior.outs !== outsBefore ||
    prior.baseState.first !== before.first ||
    prior.baseState.second !== before.second ||
    prior.baseState.third !== before.third
  );
}
