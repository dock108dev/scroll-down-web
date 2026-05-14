/**
 * Adapter: backend Scroll Down MLB DTO -> existing renderer types.
 *
 * STRICT RULE: this adapter only TRANSLATES shapes. It does not make
 * decisions. Selection, narrative, leverage tier, trajectory
 * classification, and result chip labels are all decided server-side. The
 * adapter copies them through.
 *
 * Normalized event flow: the backend ships a `halfInnings` list of
 * `ScrollDownHalfInningContainer` containers. Each container's `events`
 * carry the per-event normalized snapshots — before/after base + outs,
 * pre-play score, per-team `scoreChange` delta, deterministic
 * `movements`, `matchup` identity, `result` flags, and `revealType`. The
 * adapter looks up each play card's event by `playIndex` and copies
 * those fields onto the renderer's card. It does NOT re-derive movements
 * from a base-state diff when event movements are present, and it does
 * NOT infer the batter from movement entries — both are sourced from
 * the wire. Older PlayPayload-only decks still use the legacy base diff
 * so cached fixtures remain animated.
 *
 * The one local computation: `scoreAfter`, which the wire deliberately
 * omits (spoiler-safety contract). The adapter computes it as
 * `scoreBefore + scoreChange` so the post-play scoreboard tween stays
 * in memory only and is never round-tripped to the wire.
 */

import type {
  CatchupCard,
  CatchupCardsResponse,
  PlayCardData,
  PlayEventType,
  PriorAfterState,
  RhythmCard,
  RhythmCardKind,
  RunnerAdvance,
  RunnerNames,
  SceneSetterCard,
  InningTransitionCard,
  BallPath,
  BaseballBaseState,
  PlayAnimationProfile,
} from "@/lib/types";
import type {
  SdmDeckCard,
  SdmDeckResponse,
  SdmHalfInningContainer,
  SdmHalfInningEvent,
  SdmBaseMovement,
} from "@/types/scroll-down-mlb";
import { diffBaseStatesToAdvances } from "@/lib/runner-state";

const HOME_ABBR_FALLBACK = "HME";
const AWAY_ABBR_FALLBACK = "AWY";


/**
 * Convert the backend deck response into the existing
 * `CatchupCardsResponse` shape consumed by the renderer.
 */
export function adaptDeck(deck: SdmDeckResponse): CatchupCardsResponse {
  const gameId = parseGameId(deck.gameId);
  const homeAbbr = deck.homeTeam?.abbreviation ?? HOME_ABBR_FALLBACK;
  const awayAbbr = deck.awayTeam?.abbreviation ?? AWAY_ABBR_FALLBACK;
  const homeName = deck.homeTeam?.displayName ?? "Home";
  const awayName = deck.awayTeam?.displayName ?? "Away";

  // Index every wire event by its `playIndex` so play cards can resolve
  // the normalized event payload in O(1) without iterating the
  // container list. `halfInnings` may be empty for older fixtures, in
  // which case the adapter falls back to the legacy PlayPayload-only
  // path (no batter or movement upgrades available).
  const eventByPlayIndex = indexEventsByPlayIndex(deck.halfInnings);

  const cards: CatchupCard[] = [];
  // Running scoreboard threaded through the loop so rhythm/transition
  // cards inherit the score *after* the most recent play. The backend
  // omits `scoreAfter` from the wire for spoiler safety, so the cursor
  // only advances on play cards (whose `scoreAfter` is computed locally
  // above). Cursor is spread-copied onto each card to avoid aliasing.
  // Assumes `deck.cards` arrives in `sortOrder` (backend contract).
  let lastKnownScore = { home: 0, away: 0 };
  // Ending snapshot of the most recently emitted play card. Threaded
  // forward across rhythm cards (quiet-stretch / late-game / final-setup)
  // so a play card after a pacing card can still bridge from the previous
  // play's end state. Reset on scene-setter and inning-transition because
  // those are hard boundaries — the next play is its own opening beat.
  let lastPlayEnding: PriorAfterState | null = null;
  // Dedup defensively against the wire: a brief upstream race during a
  // poll boundary has been observed to ship the same play twice. React
  // would warn (and the second copy would re-bridge from itself), so we
  // drop the duplicate at the adapter so downstream stays clean.
  const seenIds = new Set<string>();
  for (const card of deck.cards) {
    if (seenIds.has(card.id)) continue;
    seenIds.add(card.id);
    const adapted = adaptCard(
      card,
      deck,
      gameId,
      homeAbbr,
      awayAbbr,
      homeName,
      awayName,
      eventByPlayIndex,
    );
    if (!adapted) continue;
    if (adapted.kind === "play") {
      lastKnownScore = adapted.scoreAfter;
      if (lastPlayEnding !== null) {
        adapted.priorAfter = lastPlayEnding;
      }
      lastPlayEnding = snapshotPlayEnding(adapted);
    } else if (
      adapted.kind === "inning-transition" ||
      adapted.kind === "quiet-stretch" ||
      adapted.kind === "late-game" ||
      adapted.kind === "final-setup"
    ) {
      adapted.score = { ...lastKnownScore };
      if (adapted.kind === "inning-transition") {
        lastPlayEnding = null;
      }
    } else if (adapted.kind === "scene-setter") {
      lastPlayEnding = null;
    }
    cards.push(adapted);
  }

  return {
    gameId,
    // Live-game cursor: when the wire carries half-inning containers we
    // derive the cursor from the total number of events shipped so the
    // "New moments available" banner can detect newly-arrived plays
    // regardless of whether the upstream feed populates
    // `deck.lastPlayIndex`. The cursor is monotonic per poll — each new
    // event appended to a container bumps it by one — so the polling
    // layer can compare strict-greater-than to detect new content. Falls
    // back to the deck-level field for backward compatibility.
    lastPlayIndex: deriveLastPlayCursor(deck, eventByPlayIndex),
    isFinal: deck.isFinal,
    cards,
  };
}


function adaptCard(
  card: SdmDeckCard,
  deck: SdmDeckResponse,
  gameId: number,
  homeAbbr: string,
  awayAbbr: string,
  homeName: string,
  awayName: string,
  eventByPlayIndex: Map<number, SdmHalfInningEvent>,
): CatchupCard | null {
  switch (card.type) {
    case "scene":
      return adaptSceneCard(card, deck, gameId, homeAbbr, awayAbbr, homeName, awayName);
    case "play":
      return adaptPlayCard(card, gameId, homeAbbr, awayAbbr, eventByPlayIndex);
    case "rhythm":
      return adaptRhythmCard(card, gameId, homeAbbr, awayAbbr);
    case "final_setup":
      return adaptRhythmCard(card, gameId, homeAbbr, awayAbbr, "final-setup");
    default:
      return null;
  }
}


function adaptSceneCard(
  card: SdmDeckCard,
  deck: SdmDeckResponse,
  gameId: number,
  homeAbbr: string,
  awayAbbr: string,
  homeName: string,
  awayName: string,
): SceneSetterCard {
  return {
    kind: "scene-setter",
    gameId,
    cardId: card.id,
    index: card.sortOrder,
    homeTeamAbbr: homeAbbr,
    awayTeamAbbr: awayAbbr,
    homeTeam: homeName,
    awayTeam: awayName,
    firstPitch: deck.firstPitch ?? "",
    homeProbablePitcher: deck.homeProbablePitcher ?? null,
    awayProbablePitcher: deck.awayProbablePitcher ?? null,
    venue: deck.venue ?? null,
    isFinal: deck.isFinal,
    gamePhase: deriveGamePhase(deck),
  };
}


/**
 * Classify the upstream game into scheduled / live / final from the three
 * signals the deck response already carries. Pure — easy to unit-test.
 *
 * `lastPlayIndex > 0` is the live threshold (not `>= 0`): a 0-indexed
 * placeholder is treated as pre-game to keep the pre-first-pitch UI stable.
 * `isFinal` wins outright when set, even if the play index is missing.
 */
export function deriveGamePhase(
  deck: Pick<SdmDeckResponse, "isFinal" | "lastPlayIndex">,
): "scheduled" | "live" | "final" {
  if (deck.isFinal) return "final";
  if ((deck.lastPlayIndex ?? -1) > 0) return "live";
  return "scheduled";
}


function adaptPlayCard(
  card: SdmDeckCard,
  gameId: number,
  homeAbbr: string,
  awayAbbr: string,
  eventByPlayIndex: Map<number, SdmHalfInningEvent>,
): PlayCardData | null {
  const play = card.play;
  if (!play) return null;
  const inning = card.inning ?? 1;
  const inningHalf = (card.half ?? "top") as "top" | "bottom";
  // Top of inning => away batting, bottom => home batting.
  const battingTeamAbbr = inningHalf === "bottom" ? homeAbbr : awayAbbr;

  const playIndex = parsePlayIndex(play.playId);
  const event = eventByPlayIndex.get(playIndex);

  // Prefer the normalized event payload when the half-inning containers
  // were shipped. Falls back to the PlayPayload-only legacy shape so
  // older deck fixtures (no halfInnings) still render. The wire-level
  // event is the source of truth for: pre-play score, per-team
  // scoreChange, before/after base + outs, runner movements, batter
  // identity, and result flags.
  const scoreBefore =
    event?.scoreBefore ?? play.scoreBefore ?? { home: 0, away: 0 };
  // LOCAL-ONLY post-play scoreboard. The wire never carries a cumulative
  // post-play total, so we always compute it as `scoreBefore +
  // scoreChange`. `scoreChange` is the per-team run delta produced by
  // this event (zeros for non-scoring plays). NEVER reads any after-
  // state score field — that path is structurally excluded by the
  // spoiler-safety contract and would equal the final score on the last
  // play of a completed game.
  //
  // Resolution order: event.scoreChange (canonical) → play.scoreChange
  // (legacy field on PlayPayload) → derive from `runsScoredOnPlay` ×
  // batting-team attribution (oldest fixture path, no per-team delta).
  const scoreChange =
    event?.scoreChange ??
    play.scoreChange ??
    runsToScoreChange(play.runsScoredOnPlay ?? 0, inningHalf);
  const scoreAfter = {
    home: scoreBefore.home + scoreChange.home,
    away: scoreBefore.away + scoreChange.away,
  };

  const baseStateBefore: BaseballBaseState =
    event?.baseStateBefore ?? play.baseStateBefore ?? emptyBases();
  const baseStateAfter: BaseballBaseState =
    event?.baseStateAfter ?? play.baseStateAfter ?? emptyBases();

  const runnerNamesBefore = play.runnerNamesBefore ?? {};
  const runnerNamesAfter = play.runnerNamesAfter ?? {};

  // Runner advances drive the in-card animation. Source of truth is the
  // wire's `event.movements` — the backend builds these deterministically
  // from `situation_before.bases` vs `situation_after.bases` plus the
  // batter's destination from event context. Legacy fixtures and older
  // cached decks do not carry `halfInnings`, so only that path falls back
  // to the old local base-state diff.
  const runnerAdvances: RunnerAdvance[] = event
    ? event.movements.map(movementToAdvance)
    : diffBaseStatesToAdvances(baseStateBefore, baseStateAfter, {
        runnerNamesBefore: runnerNamesBefore as RunnerNames,
        runnerNamesAfter: runnerNamesAfter as RunnerNames,
        eventType: (play.eventType as PlayEventType | null | undefined) ?? undefined,
        runsScored: play.runsScoredOnPlay ?? 0,
        outsRecorded: Math.max(0, (play.outsAfter ?? 0) - (play.outsBefore ?? 0)),
      });

  const rawTrajectory = card.visual?.trajectory as BallPath | null | undefined;
  // Generic backend `foul` doesn't carry direction. Infer from the
  // play description ("first base side" / "third base side" / "left" /
  // "right") so the curl reads correctly. Defaults to left when the
  // description gives no hint — keeps backward-compatible behavior.
  const ballPath: BallPath | undefined =
    rawTrajectory === "foul"
      ? inferFoulSide(play.description ?? card.description ?? "")
      : (rawTrajectory ?? undefined);
  const animationProfile = (card.visual?.animationProfile as PlayAnimationProfile | null | undefined) ?? undefined;
  const visualIntensity = (card.visual?.intensity as "low" | "medium" | "high" | null | undefined) ?? undefined;
  // Authoritative overlay suppression from the upstream classifier.
  const suppressMovementLines =
    card.visual?.displayHints?.suppressMovementLines === true ? true : undefined;

  const inningLabel = card.title ?? buildInningLabel(inning, inningHalf);

  // Batter identity: prefer `event.matchup.batter.name` (normalized,
  // backend-canonical, populated even when upstream omits per-play
  // batter records). Falls back to `play.batterName` (legacy
  // PlayPayload) when the half-inning event is unavailable. There is
  // intentionally no movement-inference fallback — the wire is now the
  // source of truth.
  const batterName =
    event?.matchup.batter?.name ?? play.batterName ?? null;

  // Splice the resolved batter name into the curated narrative if the
  // backend narrator left the generic "the batter" placeholder. Falls
  // back to the raw MLB play description as a last resort. Keeps the
  // curated tone while restoring the player context.
  const narrativeText = pickNarrative(card.description, play.description, batterName);

  const eventTypeFromEvent = event?.eventType ?? event?.result.eventType ?? null;
  const resolvedEventType =
    (eventTypeFromEvent as PlayEventType | null | undefined) ??
    (play.eventType as PlayEventType | null | undefined) ??
    undefined;

  return {
    kind: "play",
    gameId,
    cardId: card.id,
    index: card.sortOrder,
    playIndex,
    inning,
    inningHalf,
    inningLabel,
    battingTeamAbbr,
    description: narrativeText,
    narrative: narrativeText !== play.description ? narrativeText : undefined,
    scoreBefore,
    scoreAfter,
    situationBefore: {
      outs: event?.outsBefore ?? play.outsBefore ?? undefined,
      balls: play.ballsBefore ?? undefined,
      strikes: play.strikesBefore ?? undefined,
      baseState: baseStateBefore,
      batterName: batterName ?? undefined,
      pitcherName: event?.matchup.pitcher?.name ?? play.pitcherName ?? undefined,
      pitcherStatLine: play.pitcherStatLine ?? undefined,
    },
    outsAfter: event?.outsAfter ?? play.outsAfter ?? 0,
    baseStateAfter,
    runnerNamesBefore: runnerNamesBefore as RunnerNames,
    runnerNamesAfter: runnerNamesAfter as RunnerNames,
    runnerAdvances,
    ballPath,
    eventType: resolvedEventType,
    animationProfile,
    visualIntensity,
    suppressMovementLines,
    leverageTier: ((card.leverageTier ?? 0) as 0 | 1 | 2),
    chipPrimary: event?.result.label ?? play.label ?? undefined,
    chipSecondary: play.subLabel ?? undefined,
  };
}


function adaptRhythmCard(
  card: SdmDeckCard,
  gameId: number,
  homeAbbr: string,
  awayAbbr: string,
  forcedKind?: RhythmCardKind,
): RhythmCard | InningTransitionCard {
  // The backend collapses inning-transition / quiet-stretch / late-game
  // into the single `rhythm` DTO type. The original kind is encoded in
  // the card.id suffix (-tx-, -qs-, -lg-).
  const kind: RhythmCardKind | "inning-transition" =
    forcedKind ??
    (card.id.includes("-tx-") ? "inning-transition"
      : card.id.includes("-qs-") ? "quiet-stretch"
      : card.id.includes("-lg-") ? "late-game"
      : card.id.includes("-fs-") ? "final-setup"
      : "quiet-stretch");

  const inning = card.inning ?? 1;
  const half = (card.half ?? "top") as "top" | "bottom";

  if (kind === "inning-transition") {
    return {
      kind: "inning-transition",
      gameId,
      cardId: card.id,
      index: card.sortOrder,
      label: card.title ?? "",
      phase: card.id.includes("-end-") || card.id.includes("end") ? "end" : "mid",
      score: { home: 0, away: 0 },
      homeTeamAbbr: homeAbbr,
      awayTeamAbbr: awayAbbr,
      subtitle: card.description,
      fromInning: inning,
      fromHalf: half,
      toInning: inning,
      toHalf: half,
    };
  }

  return {
    kind,
    gameId,
    cardId: card.id,
    index: card.sortOrder,
    label: card.title ?? "",
    subtitle: card.description,
    score: { home: 0, away: 0 },
    homeTeamAbbr: homeAbbr,
    awayTeamAbbr: awayAbbr,
    toInning: inning,
    toHalf: half,
  };
}


/**
 * Translate one wire `BaseMovement` into the renderer's `RunnerAdvance`
 * shape. Direct field rename — no diffing or inference, since the
 * backend already shipped a deterministic movement entry.
 */
function movementToAdvance(move: SdmBaseMovement): RunnerAdvance {
  return {
    from: move.from,
    to: move.to,
    runnerId: move.runner.id ?? undefined,
    runnerName: move.runner.name,
    reason: move.reason ?? undefined,
    outAt: move.outAt ?? undefined,
  };
}


/**
 * Build the `playIndex → HalfInningEvent` index. Skips containers
 * gracefully when the wire omits them so the adapter still works against
 * older deck fixtures (which carry no `halfInnings` at all).
 */
function indexEventsByPlayIndex(
  containers: SdmHalfInningContainer[] | undefined,
): Map<number, SdmHalfInningEvent> {
  const out = new Map<number, SdmHalfInningEvent>();
  if (!containers) return out;
  for (const container of containers) {
    for (const event of container.events) {
      out.set(event.playIndex, event);
    }
  }
  return out;
}


/**
 * Compute the live-game cursor from the half-inning container list.
 *
 * Used by the polling layer ("New moments available" banner) to detect
 * when a fresh poll observed events that weren't present on the prior
 * poll. The cursor must increase monotonically as new events are
 * appended — otherwise a user already at the bottom of the deck would
 * silently miss them.
 *
 * Strategy: total event count across all containers when half-innings
 * are present. Falls back to the deck-level `lastPlayIndex` for
 * backward compatibility with older fixtures.
 */
function deriveLastPlayCursor(
  deck: SdmDeckResponse,
  eventByPlayIndex: Map<number, SdmHalfInningEvent>,
): number {
  if (eventByPlayIndex.size > 0) return eventByPlayIndex.size;
  return deck.lastPlayIndex ?? -1;
}


/**
 * Choose the narrative sentence shown under the field.
 *
 * Order of preference:
 *   1. Curated narrator output (`cardDescription`) when it already has a
 *      name — emotionally framed, our preferred voice.
 *   2. Curated narrator output with the resolved batter name spliced into
 *      the "the batter" placeholder. Restores the actor without losing
 *      tone.
 *   3. Raw upstream MLB play-by-play (`playDescription`) — verbose but
 *      always carries the actors. Last-resort fallback when (1) and (2)
 *      both fail.
 */
function pickNarrative(
  cardDescription: string,
  playDescription: string | null | undefined,
  batterName: string | null,
): string {
  const card = (cardDescription ?? "").trim();
  const play = (playDescription ?? "").trim();
  if (!card) return play;
  if (!play && !batterName) return card;

  const hasBatterPlaceholder = /\bthe batter\b/i.test(card);
  const hasPitcherPlaceholder = /\bthe pitcher\b/i.test(card);

  if (hasBatterPlaceholder && batterName) {
    const last = lastNameOf(batterName);
    // Replace the leading "The batter" (capitalized) once, then any
    // remaining lowercase "the batter" references.
    let out = card.replace(/^The batter\b/, last);
    out = out.replace(/\bthe batter\b/gi, last.toLowerCase() === last ? last : last);
    return out;
  }

  // Narrator gave up on names entirely and we couldn't resolve one — the
  // raw MLB text is wordier but at least carries them.
  if ((hasBatterPlaceholder || hasPitcherPlaceholder) && play) {
    return play;
  }
  return card;
}


/**
 * Choose a foul-side direction from a play description. Looks for
 * unambiguous "first base side" / "third base side" markers, then for
 * "right field" / "left field" / "rightfield" / "leftfield", then for
 * a bare "first base" or "third base" reference. Defaults to "left"
 * when nothing matches — the historical fallback before the split.
 */
function inferFoulSide(description: string): BallPath {
  const text = description.toLowerCase();
  // "first base side" / "first-base side" — strongest signal for 1B-side foul.
  if (/\b(first|1st)[\s-]*base\s+side\b/.test(text)) return "foul_right";
  if (/\b(third|3rd)[\s-]*base\s+side\b/.test(text)) return "foul_left";
  // Right-field / left-field foul territory.
  if (/\bright\s*field\b|\brightfield\b/.test(text)) return "foul_right";
  if (/\bleft\s*field\b|\bleftfield\b/.test(text)) return "foul_left";
  // Bare "first/third base" reference — usually a fielder catching the foul.
  if (/\bfirst\s*base(?:man)?\b|\b1b\b/.test(text)) return "foul_right";
  if (/\bthird\s*base(?:man)?\b|\b3b\b/.test(text)) return "foul_left";
  // Bare directional hint ("down the right-field line", "into the
  // first-base dugout") — last resort before defaulting.
  if (/\bright\b/.test(text)) return "foul_right";
  if (/\bleft\b/.test(text)) return "foul_left";
  return "foul_left";
}


function lastNameOf(full: string): string {
  const trimmed = full.trim();
  if (!trimmed) return trimmed;
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  if (/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(last) && parts.length >= 2) {
    return parts[parts.length - 2].replace(/[.,;]$/, "");
  }
  return last.replace(/[.,;]$/, "");
}


// ── Helpers ─────────────────────────────────────────────────


function parseGameId(gameId: string): number {
  const n = Number(gameId);
  return Number.isFinite(n) ? n : 0;
}


function parsePlayIndex(playId: string): number {
  const n = Number(playId);
  return Number.isFinite(n) ? n : 0;
}


function emptyBases(): BaseballBaseState {
  return { first: false, second: false, third: false };
}


function snapshotPlayEnding(card: PlayCardData): PriorAfterState {
  return {
    score: card.scoreAfter,
    baseState: card.baseStateAfter,
    runnerNames: (card.runnerNamesAfter ?? {}) as RunnerNames,
    outs: card.outsAfter,
    inning: card.inning,
    inningHalf: card.inningHalf,
  };
}


/**
 * Last-resort scoreChange derivation from `runsScoredOnPlay` for older
 * fixtures that ship neither `event.scoreChange` nor `play.scoreChange`.
 * Attributes runs to the batting team based on inning half.
 */
function runsToScoreChange(
  runs: number,
  half: "top" | "bottom",
): { home: number; away: number } {
  const safe = Math.max(0, runs);
  return half === "bottom" ? { home: safe, away: 0 } : { home: 0, away: safe };
}


function buildInningLabel(inning: number, half: "top" | "bottom"): string {
  return `${half === "top" ? "Top" : "Bottom"} ${ordinal(inning)}`;
}


function ordinal(n: number): string {
  const v = Math.abs(n);
  if (v % 100 >= 11 && v % 100 <= 13) return `${n}th`;
  switch (v % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}
