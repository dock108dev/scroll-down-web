"use client";

import { forwardRef, useEffect, useMemo } from "react";
import type {
  BaseballBaseState,
  BatterLine,
  PitcherLine,
  PlayCardData,
  RunnerNames,
} from "@/lib/types";
import { formatOutsAsIP } from "@/lib/catchup-cards";
import { findMlbTeam, teamLogoPath } from "@/lib/mlb-teams";
import { BRIDGE_MS, getPhaseMilestones, getPhaseSchedule, usePlayPhase } from "@/lib/play-phases";
import { resultChipLabel } from "@/lib/result-chip";
import { buildRunnerMovements, totalRunnersDurationMs } from "@/lib/runner-paths";
import { logValidationWarnings, validatePlayCard } from "@/lib/play-validation";
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
 *   │ AT BAT  Seager        vs        PITCHING  Rodón      │
 *   │ ◆ DURAN 2B   ◆ NIMMO 1B                3-1           │
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
  const overrides = (runnersOverride !== undefined || bridgeOverride !== undefined)
    ? {
        ...(runnersOverride !== undefined ? { runners: runnersOverride } : {}),
        ...(bridgeOverride !== undefined ? { bridge: bridgeOverride } : {}),
      }
    : undefined;

  const { phase, runId } = usePlayPhase(isActive, card.animationProfile, overrides);
  const milestones = getPhaseMilestones(card.animationProfile, overrides);
  const schedule = getPhaseSchedule(card.animationProfile, overrides);

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
  const runnersBefore = describeRunnerSlots(baseStateBefore, card.runnerNamesBefore);
  const runnersAfter = describeRunnerSlots(baseStateAfter, card.runnerNamesAfter);
  const runnersPrior = priorAfter
    ? describeRunnerSlots(priorAfter.baseState, priorAfter.runnerNames)
    : runnersBefore;

  // Score progression — scoreBefore is shown until settle (the result lock
  // beat). Showing scoreAfter sooner would spoil scoring plays. CSS pulses
  // whichever team's number went up at the moment data-flash flips true.
  const showAfter = phase === "settle" || phase === "reveal";
  const score = showAfter ? card.scoreAfter : card.scoreBefore;
  const homeIncreased = card.scoreAfter.home > card.scoreBefore.home;
  const awayIncreased = card.scoreAfter.away > card.scoreBefore.away;
  const chip = resultChipLabel(card);
  const showChip = phase === "settle" || phase === "reveal";

  // Internal-consistency check — catches state we shouldn't be rendering
  // (score delta with no runner home, strikeout without out increment,
  // batter on the wrong base, etc.). Dev-only console.warn; production
  // is guarded upstream by the chip + advance constraints.
  const validation = useMemo(() => validatePlayCard(card), [card]);
  useEffect(() => {
    logValidationWarnings(validation);
  }, [validation]);

  const battingTeamName = battingTeam?.name ?? card.battingTeamAbbr ?? null;
  const hasCount =
    typeof situation.balls === "number" && typeof situation.strikes === "number";
  const showOnBaseRow = runnersPrior.length > 0 || runnersBefore.length > 0 || runnersAfter.length > 0 || hasCount;

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
      data-validation-warnings={validation.warnings.join(",") || undefined}
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

        {(situation.batterName || situation.pitcherName) && (
          <div
            className="catchup-card-matchup"
            data-testid="matchup-row"
            data-team-abbr={card.battingTeamAbbr ?? ""}
          >
            {situation.batterName && (
              <span className="catchup-card-matchup-side catchup-card-matchup-batter">
                <span className="catchup-card-matchup-eyebrow">AT BAT</span>
                <span className="catchup-card-batter-row">
                  {card.battingTeamAbbr && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={teamLogoPath(card.battingTeamAbbr)}
                      alt=""
                      width={14}
                      height={14}
                      className="catchup-card-matchup-logo"
                      onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
                    />
                  )}
                  <span className="catchup-card-batter">{situation.batterName.toUpperCase()}</span>
                </span>
                {situation.batterLine && (
                  <span className="catchup-card-stat-line" data-testid="batter-line">
                    {formatBatterLine(situation.batterLine)}
                  </span>
                )}
              </span>
            )}
            {situation.batterName && situation.pitcherName && (
              <span className="catchup-card-vs" aria-hidden>vs</span>
            )}
            {situation.pitcherName && (
              <span className="catchup-card-matchup-side catchup-card-matchup-pitcher">
                <span className="catchup-card-matchup-eyebrow">PITCHING</span>
                <span className="catchup-card-pitcher">{situation.pitcherName.toUpperCase()}</span>
                {situation.pitcherLine && (
                  <span className="catchup-card-stat-line" data-testid="pitcher-line">
                    {formatPitcherLine(situation.pitcherLine)}
                  </span>
                )}
              </span>
            )}
          </div>
        )}

        {showOnBaseRow && (
          <div className="catchup-card-onbase-row" data-testid="bases-summary">
            <RunnerPills
              prior={hasMeaningfulBridge ? runnersPrior : undefined}
              before={runnersBefore}
              after={runnersAfter}
            />
            {hasCount && (
              <span className="catchup-card-count">
                {situation.balls}-{situation.strikes}
              </span>
            )}
          </div>
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
      </div>

      <ResultChip
        primary={chip.primary}
        secondary={chip.secondary}
        visible={showChip}
      />

      <div className="catchup-card-body" data-testid="play-narration-panel">
        <CardNarrative
          text={card.narrative ?? card.description}
          isActive={phase === "reveal"}
        />
      </div>

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
  visible,
}: {
  primary: string;
  secondary?: string;
  visible: boolean;
}) {
  return (
    <div
      className="catchup-result-chip"
      data-testid="result-badge"
      data-primary={primary}
      data-secondary={secondary ?? ""}
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

type RunnerSlot = { base: "1B" | "2B" | "3B"; name: string | null };

/** Pill row that visualizes who's on base. Same cross-fade lifecycle as the
 *  retired text band — the cells inherit `.catchup-cell-pre/post/prior`
 *  classes so the runners-phase opacity animation continues to work. */
function RunnerPills({
  prior,
  before,
  after,
}: {
  prior?: RunnerSlot[];
  before: RunnerSlot[];
  after: RunnerSlot[];
}) {
  const beforeKey = serializeSlots(before);
  const afterKey = serializeSlots(after);
  const priorKey = prior !== undefined ? serializeSlots(prior) : undefined;
  const hasBridge = priorKey !== undefined && priorKey !== beforeKey;
  const hasPlay = beforeKey !== afterKey;

  if (!hasBridge && !hasPlay) {
    return (
      <div
        className="catchup-card-runners-band"
        data-bases={afterKey || "EMPTY"}
      >
        {renderPills(after)}
      </div>
    );
  }

  return (
    <div
      className="catchup-card-runners-band catchup-card-runners-band-changing"
      data-bases-prior={priorKey ?? ""}
      data-bases-before={beforeKey}
      data-bases-after={afterKey}
      data-has-bridge={hasBridge ? "true" : "false"}
      data-has-play={hasPlay ? "true" : "false"}
    >
      {hasBridge && (
        <span className="catchup-cell catchup-cell-prior">
          {renderPills(prior!)}
        </span>
      )}
      <span className="catchup-cell catchup-cell-pre">
        {renderPills(before)}
      </span>
      {hasPlay && (
        <span className="catchup-cell catchup-cell-post">
          {renderPills(after)}
        </span>
      )}
    </div>
  );
}

function renderPills(slots: RunnerSlot[]) {
  if (slots.length === 0) {
    return <span className="catchup-card-onbase-empty">BASES EMPTY</span>;
  }
  return slots.map((s) => (
    <span key={s.base} className="catchup-card-onbase-pill" data-base={s.base}>
      <span className="catchup-card-onbase-glyph" aria-hidden>◆</span>
      {s.name && (
        <span className="catchup-card-onbase-name">{lastNameOnly(s.name).toUpperCase()}</span>
      )}
      <span className="catchup-card-onbase-base">{s.base}</span>
    </span>
  ));
}

function serializeSlots(slots: RunnerSlot[]): string {
  // Stable key for diffing: `1B:Nimmo|3B:Osuna`. Used to decide whether
  // before/after differ and whether a cross-fade should run.
  return slots.map((s) => `${s.base}:${s.name ?? ""}`).join("|");
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

/** Last word of a player's name — shown in the situation rail to keep the
 *  line compact ("Clemens on 3rd" vs the full "Kody Clemens on 3rd"). */
function lastNameOnly(full: string): string {
  const trimmed = full.trim();
  if (!trimmed) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  if (/^(Jr\.?|Sr\.?|II|III|IV)$/.test(last) && parts.length >= 2) {
    return `${parts[parts.length - 2]} ${last}`;
  }
  return last;
}

function describeRunnerSlots(
  state: BaseballBaseState,
  names: RunnerNames | undefined,
): RunnerSlot[] {
  const slots: RunnerSlot[] = [];
  if (state.first)  slots.push({ base: "1B", name: names?.first ?? null });
  if (state.second) slots.push({ base: "2B", name: names?.second ?? null });
  if (state.third)  slots.push({ base: "3B", name: names?.third ?? null });
  return slots;
}

/** Compact MLB-style batter line: "1-3, BB, K, HR".
 *  Empty (first PA): null — caller hides the slot. */
function formatBatterLine(line: BatterLine): string | null {
  if (line.atBats === 0 && line.baseOnBalls === 0 && line.strikeOuts === 0) {
    return null;
  }
  const parts: string[] = [`${line.hits}-${line.atBats}`];
  if (line.homeRuns > 0) parts.push(line.homeRuns === 1 ? "HR" : `${line.homeRuns}HR`);
  if (line.baseOnBalls > 0) parts.push(line.baseOnBalls === 1 ? "BB" : `${line.baseOnBalls}BB`);
  if (line.strikeOuts > 0) parts.push(line.strikeOuts === 1 ? "K" : `${line.strikeOuts}K`);
  if (line.rbi > 0) parts.push(line.rbi === 1 ? "1 RBI" : `${line.rbi} RBI`);
  return parts.join(", ");
}

/** Pitcher line, scoreboard convention: "5.1 IP  6H 5R 3BB 3K". */
function formatPitcherLine(line: PitcherLine): string | null {
  // Hide on the very first batter the pitcher faces — nothing to report yet.
  if (line.outs === 0 && line.hits === 0 && line.baseOnBalls === 0 &&
      line.strikeOuts === 0 && line.runs === 0) {
    return null;
  }
  return `${formatOutsAsIP(line.outs)} IP · ${line.hits}H ${line.runs}R ${line.baseOnBalls}BB ${line.strikeOuts}K`;
}
