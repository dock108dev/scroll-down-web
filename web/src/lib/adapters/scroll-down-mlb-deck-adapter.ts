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
  SdmPlayPayload,
  SdmRunnerMovement,
  SdmTeamSummary,
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
  for (const card of deck.cards) {
    const adapted = adaptCard(card, deck, gameId, homeAbbr, awayAbbr, homeName, awayName);
    if (adapted) cards.push(adapted);
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
  };
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

  const runnerAdvances = adaptRunnerMovements(card.visual?.runnerMovements ?? []);

  const ballPath = (card.visual?.trajectory as BallPath | null | undefined) ?? undefined;
  const animationProfile = (card.visual?.animationProfile as PlayAnimationProfile | null | undefined) ?? undefined;
  const visualIntensity = (card.visual?.intensity as "low" | "medium" | "high" | null | undefined) ?? undefined;

  const inningLabel = card.title ?? buildInningLabel(inning, inningHalf);

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
    description: card.description,
    narrative: card.description !== play.description ? card.description : undefined,
    scoreBefore,
    scoreAfter,
    situationBefore: {
      outs: play.outsBefore ?? undefined,
      balls: play.ballsBefore ?? undefined,
      strikes: play.strikesBefore ?? undefined,
      baseState: baseStateBefore,
      batterName: play.batterName ?? undefined,
      pitcherName: play.pitcherName ?? undefined,
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
