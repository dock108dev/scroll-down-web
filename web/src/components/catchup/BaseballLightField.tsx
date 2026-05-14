"use client";

import { Fragment, useId } from "react";
import type {
  BallPath,
  BaseballBaseState,
  PlayAnimationProfile,
  PlayEventType,
  RunnerNames,
} from "@/lib/types";
import { formatRunnerLabel } from "@/lib/base-bulb-lifecycle";
import {
  FIELDER_POS,
  FIELD_POINTS,
  FOUL_LEFT,
  FOUL_RIGHT,
  HOME_TO_MOUND_DIRT_WIDTH,
  INFIELD_DIRT_RADIUS,
  WALL_RADIUS,
} from "@/lib/field-geometry";
import { basepathLength, basepathSvgPath, type RunnerMovement } from "@/lib/runner-paths";
import type { RunnerMovementStyle } from "@/lib/types";
import { getPhaseMilestones, getPhaseSchedule } from "@/lib/play-phases";
import { buildTrajectory } from "@/lib/trajectory";

/**
 * Mattel-style electronic baseball field. SVG + CSS animations driven by a
 * per-profile schedule (lib/play-phases.ts). Each card walks through:
 *   setup → pitch → trigger → ball → runners → settle → reveal
 *
 * All field geometry comes from lib/field-geometry — there are no
 * hand-tuned coordinates in this file. Runner dots animate along multi-
 * segment basepaths using SVG <animateMotion>; safe runners always travel
 * forward through the diamond (a HR batter goes home → 1 → 2 → 3 → home).
 *
 * The parent (CatchupCard) remounts this subtree by passing key={runId} on
 * every activation, so SMIL animations begin fresh.
 */

interface BaseballLightFieldProps {
  /** The single explicit base snapshot to render right now. Preview passes
   *  pre-pitch state; revealed passes post-play state. The field does not
   *  derive or blend runner occupancy. */
  visibleBaseState: BaseballBaseState;
  visibleRunnerNames?: RunnerNames;
  /** Animation plan — path + timing per runner. Required for runner dots. */
  runnerMovements?: RunnerMovement[];
  ballPath?: BallPath;
  eventType?: PlayEventType;
  animationProfile?: PlayAnimationProfile;
  scoreBefore?: { home: number; away: number };
  scoreAfter?: { home: number; away: number };
  /** ms after mount when the runners phase starts — used to offset SMIL
   *  begin times. Comes from CatchupCard's milestones.runners. */
  runnersBeginMs?: number;
  /** Hex (or any CSS color) for the active accent — usually the batting team. */
  accentColor?: string;
  /** Drives the animation timeline. */
  isActive: boolean;
  /** Backend-authoritative suppression of the batted-ball overlay. When
   *  true the trajectory path is not drawn even if `ballPath` is a
   *  zone-style value — upstream has decided this play has no confident
   *  batted-ball path (caught stealing, wild pitch, throwing error, etc.). */
  suppressMovementLines?: boolean;
}

const POS = FIELD_POINTS;

// All ball trails come from the canonical trajectory grammar — there are
// no hand-tuned curves in this file. See lib/trajectory.ts for the rules.
const TRAIL_LENGTH = 800;

// ── Per-profile fade/glow timing ──────────────────────────

// Tightened across all profiles (Nov 2026) so the ball trail clears the
// stage before runners begin moving. Combined with the
// BALL_TO_RUNNERS_LEAD_IN_MS beat in play-phases.ts, this means the
// "ball flight → ball gone → runners" sequence stages cleanly. Home
// runs keep some lingering glow because the linger IS the moment.
const PROFILE_GLOW: Record<PlayAnimationProfile, { fadeMs: number; fadeDelayMs: number; glow: number }> = {
  home_run:             { fadeMs: 700, fadeDelayMs: 500, glow: 2.0 },
  deep_fly:             { fadeMs: 240, fadeDelayMs: 80,  glow: 1.4 },
  shallow_fly:          { fadeMs: 180, fadeDelayMs: 40,  glow: 1.0 },
  popup:                { fadeMs: 160, fadeDelayMs: 40,  glow: 0.8 },
  line_drive:           { fadeMs: 180, fadeDelayMs: 40,  glow: 1.2 },
  routine_grounder:     { fadeMs: 140, fadeDelayMs: 30,  glow: 0.7 },
  hard_grounder:        { fadeMs: 160, fadeDelayMs: 30,  glow: 1.0 },
  foul:                 { fadeMs: 160, fadeDelayMs: 60,  glow: 0.6 },
  walk:                 { fadeMs: 0,   fadeDelayMs: 0,   glow: 0   },
  strikeout:            { fadeMs: 0,   fadeDelayMs: 0,   glow: 0   },
  stolen_base:          { fadeMs: 0,   fadeDelayMs: 0,   glow: 0   },
  wild_pitch:           { fadeMs: 160, fadeDelayMs: 60,  glow: 0.8 },
  double_play_grounder: { fadeMs: 180, fadeDelayMs: 40,  glow: 1.0 },
  double_play_fly:      { fadeMs: 220, fadeDelayMs: 80,  glow: 1.2 },
  sacrifice_fly:        { fadeMs: 220, fadeDelayMs: 80,  glow: 1.0 },
  rundown:              { fadeMs: 0,   fadeDelayMs: 0,   glow: 0   },
  other:                { fadeMs: 200, fadeDelayMs: 60,  glow: 1.0 },
};

// ── Per-style runner dot weighting ────────────────────────
// Drives the emotional grammar: scoring runners bloom and linger, routine
// advances stay quiet, double-play outs feel mechanical. The render layer
// maps these values onto SMIL <animate> elements and CSS class hooks so
// each style reads with a different visual weight at every frame.

const DOT_RADIUS: Record<RunnerMovementStyle, number> = {
  score:        7,
  advance:      5,
  steal:        6,
  walk_shuffle: 5,
  double_play:  6,
  forced_out:   6,
  tagged_out:   6,
  in_place_out: 0,
};

const DOT_OPACITY: Record<RunnerMovementStyle, number> = {
  // Lowered across the board so the ball dot reads as the dominant
  // moving actor on the field (per BRAINDUMP: "ball must become the
  // protagonist"). Scoring + retirement events keep more brightness
  // because they're the narrative anchors of the play.
  score:        0.92,
  advance:      0.55,
  steal:        0.72,
  walk_shuffle: 0.50,
  double_play:  0.85,
  forced_out:   0.82,
  tagged_out:   0.82,
  in_place_out: 0,
};

const TRAIL_WIDTH: Record<RunnerMovementStyle, number> = {
  // Reduced ~30% from the previous values. The ball trail is 3px wide
  // with a 5px halo — runner trails now sit clearly under that visual
  // weight, so a multi-runner play reads as ball-then-runners rather
  // than a wash of equally-weighted lines.
  score:        1.6,
  advance:      0.9,
  steal:        1.3,
  walk_shuffle: 0.8,
  double_play:  1.2,
  forced_out:   1.0,
  tagged_out:   1.0,
  in_place_out: 0,
};

const STYLE_DOT_CLASS: Record<RunnerMovementStyle, string> = {
  score:        "field-runner-score",
  advance:      "field-runner-advance",
  steal:        "field-runner-steal",
  walk_shuffle: "field-runner-walk-shuffle",
  double_play:  "field-runner-double-play",
  forced_out:   "field-runner-forced-out",
  tagged_out:   "field-runner-tagged-out",
  in_place_out: "",
};

// ── Extra trails (chained memory-trail system) ────────────
// Generalizes the old single-slot SECONDARY_TRAILS map into an array per
// profile. Each entry is a self-contained throw segment with its own
// timing window (offset from runnersStart, duration, fade tail). Rendering
// iterates the array — adding a profile here requires no changes to the
// JSX render loop, only data.

interface ExtraTrailDef {
  /** SVG path d-string. May use M, L, Q, C. */
  path: string;
  /** ms offset from runnersStart when the dot appears and motion begins. */
  beginOffsetMs: number;
  /** ms to traverse the full path (SMIL dur). */
  durationMs: number;
  /** ms between motion end and dot fade. */
  fadeTailMs: number;
  /** Optional glow intensity multiplier for the trail line. Defaults to 1.0. */
  glowScale?: number;
}

// Outfielder-to-home throw arcs for sacrifice flies, keyed by ball path.
// Direction varies by fielder: LF arcs through the third-base side, RF
// through the first-base side, CF straight over the mound.
const SAC_FLY_RELAY_PATHS: Partial<Record<BallPath, string>> = {
  fly_lf:  `M${FIELDER_POS.lf.x} ${FIELDER_POS.lf.y} Q${POS.third.x} ${POS.third.y} ${POS.home.x} ${POS.home.y}`,
  fly_lcf: `M${FIELDER_POS.lcf.x} ${FIELDER_POS.lcf.y} Q${POS.third.x + 12} ${POS.third.y - 8} ${POS.home.x} ${POS.home.y}`,
  fly_cf:  `M${FIELDER_POS.cf.x} ${FIELDER_POS.cf.y} Q${POS.mound.x} ${POS.mound.y + 20} ${POS.home.x} ${POS.home.y}`,
  fly_rcf: `M${FIELDER_POS.rcf.x} ${FIELDER_POS.rcf.y} Q${POS.first.x - 10} ${POS.first.y - 12} ${POS.home.x} ${POS.home.y}`,
  fly_rf:  `M${FIELDER_POS.rf.x} ${FIELDER_POS.rf.y} Q${POS.first.x} ${POS.first.y} ${POS.home.x} ${POS.home.y}`,
};

const EXTRA_TRAILS: Partial<Record<PlayAnimationProfile, ExtraTrailDef[]>> = {
  // SS pivot to first base on a 6-4-3 / 6-3 turn.
  double_play_grounder: [
    {
      path: `M${FIELDER_POS.shortstop.x} ${FIELDER_POS.shortstop.y} L${FIELDER_POS.first_base.x} ${FIELDER_POS.first_base.y}`,
      beginOffsetMs: 240,
      durationMs: 360,
      fadeTailMs: 80,
      glowScale: 1.0,
    },
  ],
  // CF tag-up relay back to home on a fly-DP.
  double_play_fly: [
    {
      path: `M${FIELDER_POS.cf.x} ${FIELDER_POS.cf.y} Q${POS.mound.x} ${POS.mound.y + 20} ${POS.home.x} ${POS.home.y}`,
      beginOffsetMs: 240,
      durationMs: 360,
      fadeTailMs: 80,
      glowScale: 1.1,
    },
  ],
  // Rundown: three-throw sequence between 1B and home, ending at the tag
  // point partway up the line. Canonical 1B–home geometry; alternate
  // base-pair rundowns can be encoded later when the data calls for them.
  rundown: [
    {
      path: `M${POS.first.x} ${POS.first.y} Q${POS.mound.x + 25} ${POS.mound.y + 30} ${POS.home.x} ${POS.home.y}`,
      beginOffsetMs: 120,
      durationMs: 280,
      fadeTailMs: 40,
      glowScale: 0.8,
    },
    {
      path: `M${POS.home.x} ${POS.home.y} Q${POS.mound.x + 25} ${POS.mound.y + 30} ${POS.first.x} ${POS.first.y}`,
      beginOffsetMs: 500,
      durationMs: 280,
      fadeTailMs: 40,
      glowScale: 0.8,
    },
    {
      path: `M${POS.first.x} ${POS.first.y} L${(POS.first.x + POS.home.x) / 2} ${(POS.first.y + POS.home.y) / 2}`,
      beginOffsetMs: 880,
      durationMs: 180,
      fadeTailMs: 120,
      glowScale: 1.2,
    },
  ],
};

/** Resolve extra defensive throw trails only when the profile explicitly
 *  supports them. Generic hits should not invent relay/cutoff geometry. */
function resolveExtraTrails(
  profile: PlayAnimationProfile,
  ballPath: BallPath,
): ExtraTrailDef[] {
  const base = EXTRA_TRAILS[profile];
  if (base) return base;
  if (profile === "sacrifice_fly") {
    const path = SAC_FLY_RELAY_PATHS[ballPath];
    if (path) {
      return [{ path, beginOffsetMs: 180, durationMs: 340, fadeTailMs: 80, glowScale: 0.9 }];
    }
  }
  // Do not infer relay/cutoff throws from generic deep_fly or line_drive
  // profiles. Those profiles often represent doubles/singles where the feed
  // lacks explicit throw data; drawing OF→home lines there lies to the user.
  // Keep throw overlays limited to profile-specific defensive events above.
  return [];
}

export function hasConfidentBattedBallPath(
  ballPath: BallPath,
  profile: PlayAnimationProfile,
): boolean {
  if (ballPath === "none" || ballPath === "pitch") return false;
  if (profile === "walk" || profile === "strikeout" || profile === "stolen_base") return false;
  return (
    ballPath === "popup" ||
    ballPath.startsWith("ground_") ||
    ballPath.startsWith("line_") ||
    ballPath.startsWith("fly_") ||
    ballPath.startsWith("foul") ||
    ballPath.startsWith("home_run_")
  );
}

/**
 * Post-reveal overlay gate for the batted-ball trajectory:
 *   1. authoritative: backend may explicitly suppress via `suppressMovementLines`
 *   2. value-based: `ballPath`/`animationProfile` must read as a real hit
 *
 * Returning false means "render no overlay" — per the product rule, no
 * overlay is always preferable to a wrong one. The pre-reveal gate lives
 * upstream in `CatchupCard` (it hardwires `ballPath` to `"none"` until
 * the user reveals).
 */
export function shouldShowBattedBallOverlay(
  ballPath: BallPath,
  profile: PlayAnimationProfile,
  suppressMovementLines?: boolean,
): boolean {
  if (suppressMovementLines === true) return false;
  return hasConfidentBattedBallPath(ballPath, profile);
}


// ── Component ─────────────────────────────────────────────

export function BaseballLightField({
  visibleBaseState,
  visibleRunnerNames,
  runnerMovements,
  ballPath = "pitch",
  eventType = "other",
  animationProfile = "other",
  scoreBefore,
  scoreAfter,
  runnersBeginMs,
  accentColor = "#5a8ac6",
  isActive,
  suppressMovementLines,
}: BaseballLightFieldProps) {
  const trail = buildTrajectory(ballPath);
  const hasBattedBallOverlay = shouldShowBattedBallOverlay(
    ballPath,
    animationProfile,
    suppressMovementLines,
  );
  // Per-mount unique IDs so the ball dot's <animateMotion><mpath>
  // references the right trail path. SVG IDs are document-scoped and
  // multiple cards can be in the DOM at once (offscreen); these IDs
  // keep them isolated.
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const trailPathId = `${reactId}-trail`;
  const ballGlowFilterId = `${reactId}-ball-glow`;
  // The schedule used by the field MUST agree with what CatchupCard passed
  // as runnersBeginMs — fall back to the profile default when unset.
  const milestones = getPhaseMilestones(animationProfile);
  const schedule = getPhaseSchedule(animationProfile);
  // PROFILE_GLOW is `Record<PlayAnimationProfile, ...>` so the lookup is
  // always defined under TS — the `?? other` is a runtime guard for a
  // string that bypassed the type system (e.g. stale persisted data).
  // See docs/audits/error-handling-report.md §G2.
  const glow = PROFILE_GLOW[animationProfile] ?? PROFILE_GLOW.other;
  const extraTrails = resolveExtraTrails(animationProfile, ballPath);
  const runnersStart = runnersBeginMs ?? milestones.runners;

  // Profile-scaled bloom radii for the ball dot SVG filter. The floors
  // (0.3 / 0.5) keep the corona perceptible on low-glow profiles like
  // routine grounders without making fouls bloom out of proportion.
  const g = glow.glow;
  const ballSd1 = (1.5 * Math.max(0.3, g)).toFixed(1);
  const ballSd2 = (4.0 * Math.max(0.3, g)).toFixed(1);
  const ballSd3 = (9.0 * Math.max(0.5, g)).toFixed(1);

  // Timing for the traveling ball dot. The primary dot appears at the
  // contact moment and rides the trajectory over the same `schedule.ball`
  // window the trail uses to draw — start times match so the trail's
  // leading edge tracks the dot exactly.
  const ballAppearMs = milestones.trigger;
  const ballMoveMs = milestones.ball;
  const ballFadeMs = milestones.ball + schedule.ball + glow.fadeDelayMs;

  const showContact =
    eventType !== "strikeout" &&
    eventType !== "walk" &&
    eventType !== "hit_by_pitch" &&
    eventType !== "stolen_base" &&
    eventType !== "caught_stealing" &&
    eventType !== "pickoff" &&
    eventType !== "balk" &&
    eventType !== "wild_pitch" &&
    eventType !== "passed_ball" &&
    eventType !== "catcher_interference" &&
    hasBattedBallOverlay;

  const showPitch =
    eventType !== "stolen_base" &&
    eventType !== "caught_stealing" &&
    eventType !== "pickoff" &&
    eventType !== "balk";

  const homer = eventType === "home_run";
  const isHbp = eventType === "hit_by_pitch";

  const runs = scoreBefore && scoreAfter
    ? Math.max(0, (scoreAfter.home - scoreBefore.home) + (scoreAfter.away - scoreBefore.away))
    : 0;
  const isRunScoring = runs > 0;

  return (
    <div
      data-testid="baseball-field"
      data-playing={isActive ? "true" : "false"}
      data-event-kind={eventType}
      data-profile={animationProfile}
      data-homer={homer ? "true" : "false"}
      data-hbp={isHbp ? "true" : "false"}
      data-scoring={isRunScoring ? "true" : "false"}
      data-contact={showContact ? "true" : "false"}
      className="field-shell"
      style={{
        ["--field-accent" as string]: accentColor,
        ["--ms-pitch" as string]: `${milestones.pitch}ms`,
        ["--ms-trigger" as string]: `${milestones.trigger}ms`,
        ["--ms-ball" as string]: `${milestones.ball}ms`,
        ["--ms-runners" as string]: `${runnersStart}ms`,
        ["--ms-settle" as string]: `${milestones.settle}ms`,
        ["--ms-reveal" as string]: `${milestones.reveal}ms`,
        ["--ms-ready" as string]: `${milestones.ready}ms`,
        ["--d-setup" as string]: `${schedule.setup}ms`,
        ["--d-pitch" as string]: `${schedule.pitch}ms`,
        ["--d-trigger" as string]: `${schedule.trigger}ms`,
        ["--d-ball" as string]: `${schedule.ball}ms`,
        ["--d-runners" as string]: `${schedule.runners}ms`,
        ["--trail-draw-ms" as string]: `${schedule.ball}ms`,
        ["--trail-fade-ms" as string]: `${glow.fadeMs}ms`,
        ["--trail-fade-delay-ms" as string]: `${glow.fadeDelayMs}ms`,
        ["--trail-glow" as string]: String(glow.glow),
      }}
    >
      <div className="field-stadium-glow" aria-hidden />
      <svg
        data-testid="field-diamond"
        viewBox="0 0 320 320"
        width="100%"
        height="100%"
        className="field-svg"
        shapeRendering="geometricPrecision"
        aria-hidden="true"
      >
        {/* Mattel-handheld grammar: a single kelly-green fair-territory
            pentagon with a black dirt zone over the mound + the alley to
            home, white-filled bases and home plate, white foul lines.
            No basepath chalk runs between 1B↔2B or 2B↔3B — those are
            dirt on a real diamond and were reading as a UI border on
            the field. The defs block keeps the ball-glow filter and the
            home-run afterglow gradient; the analog wobble filter is
            also retained so the white foul lines pick up a faint
            phosphor jitter. */}
        <defs>
          <radialGradient id="field-homer-glow" cx="50%" cy="40%" r="60%">
            <stop offset="0%"   stopColor="rgba(251, 191, 36, 0.45)" />
            <stop offset="100%" stopColor="rgba(251, 191, 36, 0)" />
          </radialGradient>
          {/* Subtle phosphor displacement on basepath + foul lines only.
              Gated on isActive so the filter id is not in the DOM on
              inactive scroll-snap cards — iOS WebKit otherwise evaluates
              feTurbulence for any element referencing a defined id, which
              causes scroll jank. With the id undefined on inactive cards,
              browsers skip filter evaluation entirely. */}
          {/* Three-layer Gaussian bloom for the traveling ball dot. The
              wide blur is the atmospheric corona that bleeds into adjacent
              geometry; the mid blur is the visible halo; the tight blur
              lifts the apparent core brightness past flat white. Together
              they simulate the overexposure of an LED pushed past its
              rated current — what a single CSS drop-shadow can't do. */}
          <filter
            id={ballGlowFilterId}
            x="-150%"
            y="-150%"
            width="400%"
            height="400%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation={ballSd3} result="blur-wide" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={ballSd2} result="blur-mid" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={ballSd1} result="blur-tight" />
            <feMerge>
              <feMergeNode in="blur-wide" />
              <feMergeNode in="blur-mid" />
              <feMergeNode in="blur-tight" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {isActive && (
            <filter
              id="field-displace-subtle"
              x="-2%"
              y="-2%"
              width="104%"
              height="104%"
              colorInterpolationFilters="linearRGB"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.016"
                numOctaves={2}
                seed={42}
                result="noise"
              />
              <feDisplacementMap
                in="SourceGraphic"
                in2="noise"
                scale={1.8}
                xChannelSelector="R"
                yChannelSelector="G"
              />
            </filter>
          )}
        </defs>

        {/* ── Fair-territory grass — kelly-green fan ─────────
            One single green fill spans the whole fair-territory
            pentagon: home → foul-left wall point → outer arc →
            foul-right wall point → home. Sits at the bottom of the
            paint stack so every white line, dirt patch, base, and
            moving object lands on top of it. */}
        <path
          className="field-grass"
          d={`M${POS.home.x},${POS.home.y}
              L${FOUL_LEFT.x},${FOUL_LEFT.y}
              A${WALL_RADIUS},${WALL_RADIUS} 0 0 1 ${FOUL_RIGHT.x},${FOUL_RIGHT.y} Z`}
        />

        {/* ── Infield dirt — black mound + home-to-mound alley ──
            On the Mattel reference the dirt is solid black: a round
            mound zone in the middle of the green, with a narrow
            vertical strip running down to home plate. We mirror that
            with two filled shapes — the rectangle is centered on the
            x-axis between home and mound, the circle is centered on
            the mound itself. The two overlap so they fuse into one
            continuous black shape. */}
        <rect
          className="field-dirt"
          x={POS.home.x - HOME_TO_MOUND_DIRT_WIDTH / 2}
          y={POS.mound.y}
          width={HOME_TO_MOUND_DIRT_WIDTH}
          height={POS.home.y - POS.mound.y}
        />
        <circle
          className="field-dirt"
          cx={POS.mound.x}
          cy={POS.mound.y}
          r={INFIELD_DIRT_RADIUS}
        />

        {/* ── Foul lines — the only field-chalk strokes ─────
            Home → 1B wall and home → 3B wall. These pass exactly
            through 1B and 3B by construction (see field-geometry).
            The basepath chalk between 1B↔2B and 2B↔3B is intentionally
            absent — those segments are dirt on a real diamond, and the
            old amber diamond outline was reading as a futuristic UI
            border. The displacement filter gives the long straight
            runs a hair of phosphor jitter so they don't read as a
            vector tool's geometric output. */}
        <g filter={isActive ? "url(#field-displace-subtle)" : undefined}>
          <line
            x1={POS.home.x}
            y1={POS.home.y}
            x2={FOUL_LEFT.x}
            y2={FOUL_LEFT.y}
            className="field-foul-line"
            stroke="#f5efdc"
            strokeWidth="2.4"
            strokeLinecap="square"
            style={{ animationDelay: "0ms" }}
          />
          <line
            x1={POS.home.x}
            y1={POS.home.y}
            x2={FOUL_RIGHT.x}
            y2={FOUL_RIGHT.y}
            className="field-foul-line"
            stroke="#f5efdc"
            strokeWidth="2.4"
            strokeLinecap="square"
            style={{ animationDelay: "1700ms" }}
          />
        </g>

        {/* ── Outfield wall edge — single thin white arc ────
            Replaces the old segmented amber wall. One smooth white
            curve from foul-left to foul-right at the outer radius —
            reads as the painted-on warning track boundary you see on
            the Mattel field, not as a row of electric segments. */}
        <path
          className="field-wall"
          d={`M${FOUL_LEFT.x},${FOUL_LEFT.y}
              A${WALL_RADIUS},${WALL_RADIUS} 0 0 1 ${FOUL_RIGHT.x},${FOUL_RIGHT.y}`}
          fill="none"
          stroke="#f5efdc"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        {/* Pitcher's rubber — small white pixel on the dirt mound. */}
        <rect
          className="field-mound-rubber"
          x={POS.mound.x - 4}
          y={POS.mound.y - 1.25}
          width={8}
          height={2.5}
          fill="#f5efdc"
        />

        {/* Home plate — solid white pentagon. Flat edge faces the
            pitcher (up); back point faces the catcher (down). In SVG y
            grows downward, so the point is at home.y + 12. Pure fill
            so the plate reads as the painted-on Mattel pentagon, not a
            wireframe glyph. */}
        <path
          className="field-home-plate"
          d={`M${POS.home.x - 9},${POS.home.y - 5}
              L${POS.home.x + 9},${POS.home.y - 5}
              L${POS.home.x + 11},${POS.home.y + 3}
              L${POS.home.x},${POS.home.y + 12}
              L${POS.home.x - 11},${POS.home.y + 3} Z`}
          fill="#f5efdc"
          stroke="none"
        />

        {isRunScoring && (
          <circle
            className="field-plate-score-pulse"
            cx={POS.home.x}
            cy={POS.home.y}
            r="14"
            fill="rgba(251, 191, 36, 0.85)"
            opacity="0"
          />
        )}

        {/* Structural bases (always visible). */}
        <BaseShape pos={POS.first} />
        <BaseShape pos={POS.second} />
        <BaseShape pos={POS.third} />

        {/* Base occupancy renders from one explicit visible snapshot. */}
        <BaseBulb pos={POS.first}  base="first"  occupied={visibleBaseState.first} />
        <BaseBulb pos={POS.second} base="second" occupied={visibleBaseState.second} />
        <BaseBulb pos={POS.third}  base="third"  occupied={visibleBaseState.third} />
        <BaseLabel
          pos={POS.first}
          base="first"
          occupied={visibleBaseState.first}
          name={visibleRunnerNames?.first}
        />
        <BaseLabel
          pos={POS.second}
          base="second"
          occupied={visibleBaseState.second}
          name={visibleRunnerNames?.second}
        />
        <BaseLabel
          pos={POS.third}
          base="third"
          occupied={visibleBaseState.third}
          name={visibleRunnerNames?.third}
        />

        {showContact && (
          <circle
            className="field-contact-flash"
            cx={POS.home.x}
            cy={POS.home.y}
            r="8"
            fill="var(--field-accent)"
            opacity="0"
          />
        )}

        {eventType === "strikeout" && (
          <circle
            className="field-strikeout-flash"
            cx={POS.home.x}
            cy={POS.home.y}
            r="5"
            fill="rgba(251, 191, 36, 0)"
          />
        )}

        {isHbp && (
          <circle
            className="field-hbp-flash"
            cx={POS.home.x}
            cy={POS.home.y}
            r="6"
            fill="rgba(248, 113, 113, 0)"
          />
        )}

        {showPitch && (
          <circle
            className="field-pitch-pulse"
            cx={POS.mound.x}
            cy={POS.mound.y}
            r="3"
            fill="#fbbf24"
            opacity="0"
          />
        )}

        {trail && hasBattedBallOverlay && (
          <path
            id={trailPathId}
            className="field-ball-trail field-ball-trail-batted"
            d={trail}
            fill="none"
            stroke="var(--field-accent)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={TRAIL_LENGTH}
            strokeDashoffset={TRAIL_LENGTH}
          />
        )}

        {extraTrails.map((def, i) => {
          const pathId = `${reactId}-trail-${i + 2}`;
          const appearMs = runnersStart + def.beginOffsetMs;
          const moveMs = appearMs;
          const fadeMs = moveMs + def.durationMs + def.fadeTailMs;
          return (
            <Fragment key={pathId}>
              <path
                id={pathId}
                className="field-ball-trail field-ball-trail-throw"
                d={def.path}
                fill="none"
                stroke="var(--field-accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray={TRAIL_LENGTH}
                strokeDashoffset={TRAIL_LENGTH}
              />
              <g filter={`url(#${ballGlowFilterId})`}>
                <BallDot
                  pathId={pathId}
                  start={extraTrailStartPoint(def.path)}
                  appearMs={appearMs}
                  moveMs={moveMs}
                  durMs={def.durationMs}
                  fadeMs={fadeMs}
                  fadeDurMs={glow.fadeMs > 0 ? glow.fadeMs : 220}
                  size={2.4}
                />
              </g>
            </Fragment>
          );
        })}

        {/* Runner movement trails — phosphor afterimage for each runner.
            Drawn FIRST so dots render on top. */}
        {(runnerMovements ?? []).map((m, i) => (
          <RunnerTrailSvg
            key={`trail-${m.advance.runnerId ?? m.advance.runnerName ?? `${m.from}-${m.to}-${i}`}`}
            movement={m}
            runnersStart={runnersStart}
          />
        ))}

        {/* Runner movement — animated along multi-segment basepaths. */}
        {(runnerMovements ?? []).map((m, i) => (
          <RunnerDotSvg
            key={`runner-${m.advance.runnerId ?? m.advance.runnerName ?? `${m.from}-${m.to}-${i}`}`}
            movement={m}
            runnersStart={runnersStart}
            accentColor={accentColor}
          />
        ))}

        {homer && (
          <circle
            className="field-homer-pulse"
            cx={POS.home.x}
            cy={120}
            r="160"
            fill="url(#field-homer-glow)"
            opacity="0"
          />
        )}

        {/* Traveling ball — the protagonist. Rendered LAST so its bloom
            paints over runner dots, base bulbs, and labels during overlap
            frames. White phosphor core + 3-layer SVG bloom (corona / halo /
            tight) scaled to the profile's glow intensity, so a home run
            blooms huge and a foul stays modest. */}
        {trail && showContact && (
          <g filter={`url(#${ballGlowFilterId})`}>
            <BallDot
              pathId={trailPathId}
              start={POS.home}
              appearMs={ballAppearMs}
              moveMs={ballMoveMs}
              durMs={schedule.ball}
              fadeMs={ballFadeMs}
              fadeDurMs={glow.fadeMs > 0 ? glow.fadeMs : 240}
              size={5}
            />
          </g>
        )}
      </svg>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────

function BaseShape({ pos }: { pos: { x: number; y: number } }) {
  // Solid white square rotated 45° — the white-diamond base markers
  // from the Mattel reference. Pure fill, no stroke; pops cleanly
  // against the kelly-green grass without needing an outline.
  return (
    <g transform={`translate(${pos.x} ${pos.y}) rotate(45)`}>
      <rect
        x={-6}
        y={-6}
        width={12}
        height={12}
        fill="#f5efdc"
        stroke="none"
        shapeRendering="crispEdges"
      />
    </g>
  );
}

function BaseBulb({
  pos,
  base,
  occupied,
}: {
  pos: { x: number; y: number };
  base: "first" | "second" | "third";
  occupied: boolean;
}) {
  if (!occupied) return null;

  // Two-circle marker: a team-accent disc with a chunky cream rim. Sits
  // on top of the white base diamond, so an occupied base reads as a
  // clearly distinct shape from an empty base at a glance. The bulb is
  // sized so the cream rim halos just outside the white square (~8.5 >
  // the square's 8.49 circumscribed radius).
  return (
    <g
      className="field-base-bulb"
      data-testid="base-bulb"
      data-base={base}
      data-occupied="true"
    >
      <circle cx={pos.x} cy={pos.y} r={8.5} fill="#f5efdc" />
      <circle
        cx={pos.x}
        cy={pos.y}
        r={6}
        fill="var(--field-accent)"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth={0.6}
      />
    </g>
  );
}

// Per-base anchor offsets for the runner-name label. Tucked to the
// outside of each bag so labels never sit on a basepath used by an
// animated RunnerDotSvg.
const BASE_LABEL_OFFSET: Record<"first" | "second" | "third", { dx: number; dy: number; anchor: "start" | "middle" | "end" }> = {
  first:  { dx: 14, dy: 4,   anchor: "start"  },
  second: { dx: 0,  dy: -12, anchor: "middle" },
  third:  { dx: -14, dy: 4,  anchor: "end"    },
};

function BaseLabel({
  pos,
  base,
  occupied,
  name,
}: {
  pos: { x: number; y: number };
  base: "first" | "second" | "third";
  occupied: boolean;
  name?: string;
}) {
  if (!occupied) return null;
  const label = formatRunnerLabel(name);
  if (!label) return null;
  const off = BASE_LABEL_OFFSET[base];
  const width = Math.max(38, label.length * 6 + 10);
  const height = 13;
  const x = pos.x + off.dx;
  const y = pos.y + off.dy;
  const rectX = off.anchor === "middle"
    ? x - width / 2
    : off.anchor === "end"
      ? x - width
      : x;
  return (
    <g
      className="field-base-label"
      data-testid="base-runner-label"
      data-base={base}
      data-runner={label}
    >
      <rect
        className="field-base-label-bg"
        x={rectX}
        y={y - height + 3}
        width={width}
        height={height}
        rx={4}
      />
      <text
        className="field-base-label-text"
        x={x}
        y={y}
        textAnchor={off.anchor}
        fontSize={8}
      >
        {label}
      </text>
    </g>
  );
}

/**
 * Runner dot. Safe runners travel along a multi-segment basepath using
 * SVG <animateMotion>; tagged/forced/double-play outs share the same
 * basepath travel but layer per-style SMIL animations (radius shrink,
 * fill desaturation, opacity fade) so they read as mechanical retirements;
 * in-place outs flare without moving.
 *
 * Per-runner timing comes from the RunnerMovement plan — `runnersStart` is
 * the absolute ms after mount when the runners phase begins; the movement's
 * own `beginMs` is its stagger offset within that phase.
 */
function RunnerDotSvg({
  movement,
  runnersStart,
  accentColor,
}: {
  movement: RunnerMovement;
  runnersStart: number;
  accentColor: string;
}) {
  const beginMs = runnersStart + movement.beginMs;
  const begin = `${beginMs}ms`;
  const dur = `${movement.durationMs}ms`;
  const style = movement.style;

  // In-place out — strikeout/popup flare at home, no travel.
  if (movement.to === "out" && !movement.outAt) {
    const fromXY = FIELD_POINTS[movement.from];
    return (
      <circle
        className="field-runner field-runner-out"
        cx={fromXY.x}
        cy={fromXY.y}
        r="6"
        fill="var(--field-accent)"
        data-testid="runner-marker"
        data-from={movement.from}
        data-to="out"
      />
    );
  }

  // Resolve the destination — either the safe target base or the tagged-out
  // base. Both share the same basepath-following render path. Inlining the
  // `movement.to === "out"` check (rather than using the `isOut` alias)
  // lets TS narrow `movement.to` from `BaseName | "out"` to `BaseName` on
  // the false branch.
  const isOut = movement.to === "out";
  const destination = movement.to === "out" ? movement.outAt! : movement.to;
  const path = basepathSvgPath(movement.from, destination);
  const isHome = movement.scores;
  const isOutShrink =
    style === "double_play" || style === "forced_out" || style === "tagged_out";

  const baseR = DOT_RADIUS[style] || 6;
  const baseOpacity = DOT_OPACITY[style] || 1;

  const styleClass = STYLE_DOT_CLASS[style];
  const className = [
    "field-runner",
    "field-runner-motion",
    isHome ? "field-runner-home" : "",
    styleClass,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      {/* Halo ring for scoring runners — co-animated on the same basepath
          so it tracks the dot, blooming open as the runner crosses the
          plate. Rendered before the dot so the dot paints on top. */}
      {style === "score" && (
        <circle r="0" fill={accentColor} opacity="0">
          <animateMotion
            path={path}
            begin={begin}
            dur={dur}
            fill="freeze"
            rotate="0"
            calcMode="linear"
          />
          <animate
            attributeName="r"
            values="0;0;0;8;18;22"
            keyTimes="0;0.3;0.6;0.8;0.92;1"
            begin={begin}
            dur={dur}
            fill="freeze"
          />
          <animate
            attributeName="opacity"
            values="0;0;0;0.28;0.45;0.3"
            keyTimes="0;0.3;0.6;0.8;0.92;1"
            begin={begin}
            dur={dur}
            fill="freeze"
          />
        </circle>
      )}

      <circle
        className={className}
        r={baseR}
        fill={accentColor}
        opacity="0"
        data-testid={isOut ? "runner-marker" : isHome ? "run-scored" : "runner-marker"}
        data-from={movement.from}
        data-to={isOut ? "out" : movement.to}
        data-out-at={movement.outAt}
        data-style={style}
        data-scores={isHome ? "true" : "false"}
      >
        {/* For shrink-out styles the opacity is animated, so we skip the
            <set> reveal and let the values list begin from full opacity. */}
        {!isOutShrink && (
          <set
            attributeName="opacity"
            to={String(baseOpacity)}
            begin={begin}
            fill="freeze"
          />
        )}

        <animateMotion
          path={path}
          begin={begin}
          dur={dur}
          fill="freeze"
          rotate="0"
          calcMode="linear"
        />

        {/* score: radius swells from 7→10, with the heaviest growth as the
            runner crosses the plate. Spline easing keeps the swell from
            feeling mechanical. */}
        {style === "score" && (
          <animate
            attributeName="r"
            values="7;7;8;10;10"
            keyTimes="0;0.2;0.55;0.88;1"
            calcMode="spline"
            keySplines="0.25 0.1 0.25 1;0.25 0.1 0.25 1;0.1 0 0.2 1;0 0 1 1"
            begin={begin}
            dur={dur}
            fill="freeze"
          />
        )}

        {/* steal: brief mid-motion compress + spring — reads as athleticism. */}
        {style === "steal" && (
          <animate
            attributeName="r"
            values="6;5.5;6;5;6"
            keyTimes="0;0.25;0.5;0.72;1"
            calcMode="spline"
            keySplines="0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1;0.4 0 0.6 1"
            begin={begin}
            dur={dur}
            fill="freeze"
          />
        )}

        {/* double_play / forced_out / tagged_out: shrink + opacity fade. */}
        {isOutShrink && (
          <>
            <animate
              attributeName="r"
              values={style === "double_play" ? "6;6;5;4;3" : "6;6;5.5;4.5;4"}
              keyTimes="0;0.15;0.45;0.75;1"
              calcMode="linear"
              begin={begin}
              dur={dur}
              fill="freeze"
            />
            <animate
              attributeName="opacity"
              values="1;1;0.9;0.65;0.3"
              keyTimes="0;0.15;0.45;0.75;1"
              begin={begin}
              dur={dur}
              fill="freeze"
            />
          </>
        )}

        {/* double_play: fill desaturates toward the amber-dim palette as
            the runner is erased. Hardcoded dim hexes are independent of
            team accent — a retiring runner loses team identity. */}
        {style === "double_play" && (
          <animate
            attributeName="fill"
            values={`${accentColor};${accentColor};#9b7626;#6a5020`}
            keyTimes="0;0.3;0.65;1"
            begin={begin}
            dur={dur}
            fill="freeze"
          />
        )}
      </circle>

      {/* Per-runner arrival plate flash — fires after the scoring runner
          completes motion. Distinct from the global `field-plate-score-pulse`
          (which fires once per scoring play); this one belongs to the
          runner's own beat so multi-run plays get sequential blooms. */}
      {style === "score" && movement.arrivalPulseMs > 0 && (
        <circle
          cx={POS.home.x}
          cy={POS.home.y}
          r="10"
          fill={accentColor}
          opacity="0"
        >
          <animate
            attributeName="r"
            from="10"
            to="26"
            begin={`${beginMs + movement.durationMs}ms`}
            dur={`${movement.arrivalPulseMs}ms`}
            fill="freeze"
          />
          <animate
            attributeName="opacity"
            from="0.55"
            to="0"
            begin={`${beginMs + movement.durationMs}ms`}
            dur={`${movement.arrivalPulseMs}ms`}
            fill="freeze"
          />
        </circle>
      )}
    </>
  );
}

/**
 * Phosphor afterimage trail behind a runner. Draws synchronously with
 * the runner dot's motion (same begin time, same duration, same
 * dasharray length as the path itself) so the trail's leading edge
 * tracks the dot exactly, then persists for `trailFadeMs` per-style
 * before fading to zero.
 *
 * Skipped for in-place outs (no movement → no trail) and for "out"
 * advances without an outAt (we don't know where the runner went).
 */
function RunnerTrailSvg({
  movement,
  runnersStart,
}: {
  movement: RunnerMovement;
  runnersStart: number;
}) {
  if (movement.style === "in_place_out") return null;
  if (movement.to === "out" && !movement.outAt) return null;

  // Resolve the trail destination — either the safe destination or the
  // tagged-out base.
  const destination = (movement.to === "out" ? movement.outAt : movement.to);
  if (!destination) return null;

  const path = basepathSvgPath(movement.from, destination);
  const len = basepathLength(movement.from, destination);
  if (len <= 0 || movement.durationMs <= 0) return null;

  const beginMs = runnersStart + movement.beginMs;
  const fadeBeginMs = beginMs + movement.durationMs;
  const fadeDurMs = Math.max(120, movement.trailFadeMs);

  return (
    <path
      className="field-runner-trail"
      data-style={movement.style}
      d={path}
      fill="none"
      stroke="var(--field-accent)"
      strokeWidth={TRAIL_WIDTH[movement.style] || 1.75}
      strokeLinecap="round"
      strokeDasharray={len}
      strokeDashoffset={len}
      opacity="0"
    >
      {/* Reveal exactly when the runner starts moving. */}
      <set attributeName="opacity" to="1" begin={`${beginMs}ms`} fill="freeze" />
      {/* Draw progressively in lockstep with the dot. */}
      <animate
        attributeName="stroke-dashoffset"
        from={len}
        to="0"
        begin={`${beginMs}ms`}
        dur={`${movement.durationMs}ms`}
        fill="freeze"
      />
      {/* Profile-specific persistence: snappy for steals, lingering for
          scores, chained for double plays. */}
      <animate
        attributeName="opacity"
        from="1"
        to="0"
        begin={`${fadeBeginMs}ms`}
        dur={`${fadeDurMs}ms`}
        fill="freeze"
      />
    </path>
  );
}

/**
 * Bright traveling ball dot. White phosphor core with an amber halo so
 * it reads as the brightest, most-active object on the field. Rides
 * `pathId`'s curve via SVG <animateMotion>; reveal/move/fade are pure
 * SMIL so the dot picks up exactly when it's supposed to without leaning
 * on CSS animation timing.
 *
 * Reveal happens at `appearMs` (the contact moment for primary, the
 * defensive-throw start for secondary). Motion begins at `moveMs` and
 * runs for `durMs`. Fade begins at `fadeMs` and lasts `fadeDurMs` —
 * profile-specific so home runs linger and grounders snap.
 */
function BallDot({
  pathId,
  start,
  appearMs,
  moveMs,
  durMs,
  fadeMs,
  fadeDurMs,
  size,
}: {
  pathId: string;
  start: { x: number; y: number };
  appearMs: number;
  moveMs: number;
  durMs: number;
  fadeMs: number;
  fadeDurMs: number;
  size: number;
}) {
  return (
    <circle
      className="field-ball-dot"
      cx={start.x}
      cy={start.y}
      r={size}
      fill="#ffffff"
      opacity="0"
      data-testid="ball-dot"
    >
      {/* Reveal at contact (or throw start). */}
      <set attributeName="opacity" to="1" begin={`${appearMs}ms`} fill="freeze" />
      {/* Travel along the trajectory. */}
      <animateMotion
        begin={`${moveMs}ms`}
        dur={`${durMs}ms`}
        fill="freeze"
        rotate="0"
        calcMode="spline"
        keyTimes="0;1"
        keySplines="0.3 0 0.4 1"
      >
        <mpath href={`#${pathId}`} />
      </animateMotion>
      {/* Profile-specific fade. HRs use the longest fadeDurMs so the
          ball lingers visually after exiting the wall; grounders snap. */}
      <animate
        attributeName="opacity"
        from="1"
        to="0"
        begin={`${fadeMs}ms`}
        dur={`${fadeDurMs}ms`}
        fill="freeze"
      />
    </circle>
  );
}

/** Parse the initial move-to from an extra-trail path string. ExtraTrail
 *  paths always start with `M${x} ${y}` so we can read the dot's resting
 *  position without threading the trail's origin point separately.
 *
 *  See docs/audits/error-handling-report.md §G1. The regex miss is
 *  unreachable for any path we ship today (every entry in EXTRA_TRAILS
 *  and SAC_FLY_RELAY_PATHS is constructed from a
 *  template literal whose head is `M${num} ${num}`), but the silent
 *  fallback to home plate would mask a future misconfiguration as a
 *  random glowing dot. Surface it loudly in dev; keep the fallback in
 *  prod so a single bad path entry can't blank the whole field. */
function extraTrailStartPoint(d: string): { x: number; y: number } {
  const m = d.match(/^M\s*([-\d.]+)\s+([-\d.]+)/);
  if (!m) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "[BaseballLightField] extra-trail path missing M-prefix; check EXTRA_TRAILS / SAC_FLY_RELAY_PATHS",
        { path: d },
      );
    }
    return POS.home;
  }
  const x = Number(m[1]);
  const y = Number(m[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "[BaseballLightField] extra-trail path has non-finite start coords",
        { path: d, x, y },
      );
    }
    return POS.home;
  }
  return { x, y };
}
