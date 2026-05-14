/**
 * Adapter: backend Scroll Down MLB DTO -> existing renderer types.
 *
 * STRICT RULE: this adapter only TRANSLATES shapes. It does not make
 * decisions. Selection, narrative, leverage tier, runner movement
 * classification, trajectory classification, and result chip labels are
 * all decided server-side. The adapter copies them through.
 *
 * The one local computation: `scoreAfter`, which the backend deliberately
 * does NOT serialize (spoiler-safety contract). The adapter computes it
 * from `scoreBefore + runsScoredOnPlay` attributed to the batting team
 * (top inning => away, bottom inning => home). This number stays in
 * memory for animation only — it is never sent back to the wire.
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
  SdmRunnerMovement,
} from "@/types/scroll-down-mlb";

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
    const adapted = adaptCard(card, deck, gameId, homeAbbr, awayAbbr, homeName, awayName);
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
    lastPlayIndex: deck.lastPlayIndex ?? -1,
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
): CatchupCard | null {
  switch (card.type) {
    case "scene":
      return adaptSceneCard(card, deck, gameId, homeAbbr, awayAbbr, homeName, awayName);
    case "play":
      return adaptPlayCard(card, gameId, homeAbbr, awayAbbr);
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
): PlayCardData | null {
  const play = card.play;
  if (!play) return null;
  const inning = card.inning ?? 1;
  const inningHalf = (card.half ?? "top") as "top" | "bottom";
  // Top of inning => away batting, bottom => home batting.
  const battingTeamAbbr = inningHalf === "bottom" ? homeAbbr : awayAbbr;

  const scoreBefore = play.scoreBefore ?? { home: 0, away: 0 };
  // LOCAL-ONLY post-play scoreboard. Computed from backend-provided
  // `runsScoredOnPlay` attributed to the batting team. Never re-emitted
  // on the wire — this stays inside the renderer.
  const scoreAfter = computeScoreAfter(scoreBefore, play.runsScoredOnPlay, inningHalf);

  const baseStateBefore: BaseballBaseState = play.baseStateBefore ?? emptyBases();
  const baseStateAfter: BaseballBaseState = play.baseStateAfter ?? emptyBases();

  const runnerNamesBefore = play.runnerNamesBefore ?? {};
  const runnerNamesAfter = play.runnerNamesAfter ?? {};

  const movements = card.visual?.runnerMovements ?? [];
  const runnerAdvances = adaptRunnerMovements(movements);

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

  const inningLabel = card.title ?? buildInningLabel(inning, inningHalf);

  // Some upstream play rows don't carry batterName (the SDA `player_name`
  // column is the underlying source — when it's null, `play.batterName`
  // arrives null too). Recover it from the runner-movement plan: the
  // batter is the one runner whose movement starts at home plate.
  const inferredBatterName =
    play.batterName ??
    inferBatterFromMovements(movements, runnerNamesAfter, runnerNamesBefore);

  // Splice the inferred batter name into the curated narrative if the
  // backend narrator left the generic "the batter" placeholder. Falls
  // back to the raw MLB play description as a last resort. Keeps the
  // curated tone while restoring the player context.
  const narrativeText = pickNarrative(card.description, play.description, inferredBatterName);

  return {
    kind: "play",
    gameId,
    cardId: card.id,
    index: card.sortOrder,
    playIndex: parsePlayIndex(play.playId),
    inning,
    inningHalf,
    inningLabel,
    battingTeamAbbr,
    description: narrativeText,
    narrative: narrativeText !== play.description ? narrativeText : undefined,
    scoreBefore,
    scoreAfter,
    situationBefore: {
      outs: play.outsBefore ?? undefined,
      balls: play.ballsBefore ?? undefined,
      strikes: play.strikesBefore ?? undefined,
      baseState: baseStateBefore,
      batterName: inferredBatterName ?? undefined,
      pitcherName: play.pitcherName ?? undefined,
      pitcherStatLine: play.pitcherStatLine ?? undefined,
    },
    outsAfter: play.outsAfter ?? 0,
    baseStateAfter,
    runnerNamesBefore: runnerNamesBefore as RunnerNames,
    runnerNamesAfter: runnerNamesAfter as RunnerNames,
    runnerAdvances,
    ballPath,
    eventType: (play.eventType as PlayEventType | null | undefined) ?? undefined,
    animationProfile,
    visualIntensity,
    leverageTier: ((card.leverageTier ?? 0) as 0 | 1 | 2),
    chipPrimary: play.label ?? undefined,
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
 * Map the backend's runner movements (with style + outAt) onto the
 * renderer's `RunnerAdvance` shape. Style is dropped here because the
 * frontend renderer re-classifies via `classifyRunnerStyle` for animation
 * timing — but the from/to/outAt selection itself is the backend's
 * decision.
 */
function adaptRunnerMovements(
  movements: SdmRunnerMovement[],
): RunnerAdvance[] {
  return movements.map((m) => ({
    from: m.from,
    to: m.to,
    outAt: m.outAt ?? undefined,
  }));
}


/**
 * Recover the batter's name when the upstream play row didn't carry it
 * directly. The batter is the one runner whose movement begins at home
 * plate — every batted-ball event (single, HR, K, popup, walk, etc.)
 * places a `from: "home"` movement, and its `runner` is the batter.
 *
 * Two fallback layers when that movement's runner string is empty:
 *   1. `runnerNamesAfter[base]` for whichever base the batter ended up on
 *      (single → first, double → second, etc.). Skipped when the batter
 *      went to "out" or "home" (HR) because no after-name is recorded.
 *   2. Diff `runnerNamesAfter` against `runnerNamesBefore` — any name that
 *      appears in `after` but wasn't in `before` must be the batter who
 *      just reached.
 *
 * Returns `null` (not `undefined`) when nothing resolves, so the caller's
 * `??` chain falls through cleanly to that case.
 */
function inferBatterFromMovements(
  movements: SdmRunnerMovement[],
  runnerNamesAfter: Partial<Record<"first" | "second" | "third", string>>,
  runnerNamesBefore: Partial<Record<"first" | "second" | "third", string>>,
): string | null {
  const batterMove = movements.find((m) => m.from === "home");
  if (batterMove?.runner) return batterMove.runner;

  // Did the batter reach a base safely? Check the destination of any
  // home → base move.
  if (batterMove && (batterMove.to === "first" || batterMove.to === "second" || batterMove.to === "third")) {
    const atDest = runnerNamesAfter[batterMove.to];
    if (atDest) return atDest;
  }

  // Diff after vs before for any newly-appeared runner name.
  const bases: Array<"first" | "second" | "third"> = ["first", "second", "third"];
  const before = new Set(bases.map((b) => runnerNamesBefore[b]).filter(Boolean) as string[]);
  for (const base of bases) {
    const name = runnerNamesAfter[base];
    if (name && !before.has(name)) return name;
  }
  return null;
}


/**
 * Choose the narrative sentence shown under the field.
 *
 * Order of preference:
 *   1. Curated narrator output (`cardDescription`) when it already has a
 *      name — emotionally framed, our preferred voice.
 *   2. Curated narrator output with the inferred batter name spliced into
 *      the "the batter" placeholder. Restores the actor without losing
 *      tone.
 *   3. Raw upstream MLB play-by-play (`playDescription`) — verbose but
 *      always carries the actors. Last-resort fallback when (1) and (2)
 *      both fail.
 */
function pickNarrative(
  cardDescription: string,
  playDescription: string | null | undefined,
  inferredBatterName: string | null,
): string {
  const card = (cardDescription ?? "").trim();
  const play = (playDescription ?? "").trim();
  if (!card) return play;
  if (!play && !inferredBatterName) return card;

  const hasBatterPlaceholder = /\bthe batter\b/i.test(card);
  const hasPitcherPlaceholder = /\bthe pitcher\b/i.test(card);

  if (hasBatterPlaceholder && inferredBatterName) {
    const last = lastNameOf(inferredBatterName);
    // Replace the leading "The batter" (capitalized) once, then any
    // remaining lowercase "the batter" references.
    let out = card.replace(/^The batter\b/, last);
    out = out.replace(/\bthe batter\b/gi, last.toLowerCase() === last ? last : last);
    return out;
  }

  // Narrator gave up on names entirely and we couldn't infer one — the
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


function computeScoreAfter(
  before: { home: number; away: number },
  runsScored: number,
  half: "top" | "bottom",
): { home: number; away: number } {
  const safe = Math.max(0, runsScored);
  if (half === "bottom") {
    return { home: before.home + safe, away: before.away };
  }
  return { home: before.home, away: before.away + safe };
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
