import type {
  BallPath,
  BaseballBaseState,
  CatchupCard,
  CatchupCardsResponse,
  GameSummary,
  PlayAnimationProfile,
  PlayCardData,
  PlayEntry,
  PlayEventType,
  RunnerAdvance,
  RunnerNames,
  SceneSetterCard,
  SelectionAuditRow,
  SelectionReason,
  SituationBefore,
} from "./types";
import { CATCHUP } from "./config";
import { narrativeForCard } from "./narrative";
import { planDeck, summarizeHalfInnings } from "./rhythm-planner";

/** Lightweight upstream pitcher record — only the fields we read for
 *  reconstructing pitcher of record. `inningsPitched` is the cumulative-outs
 *  hint used to decide when one reliever hands off to the next. */
export interface UpstreamPitcher {
  team: string;
  playerName: string;
  /** "5.1" = 5 innings + 1 out = 16 outs total. */
  inningsPitched?: string | null;
  hits?: number | null;
  runs?: number | null;
  earnedRuns?: number | null;
  baseOnBalls?: number | null;
  strikeOuts?: number | null;
  homeRuns?: number | null;
}

/**
 * Tier 1 = scoring + late-game high-leverage. Tier 2 = extra-base hits and
 * other meaningful results. Plays without a tier are treated as tier 2.
 * Tier 3+ never makes the deck on its own — but every play in the upstream
 * feed feeds the timeline pass, and any play that is a scoring / tying /
 * lead-change / late-leverage moment is force-included regardless of tier.
 */
const TIER1 = 1;
const TIER2 = 2;
const LATE_LEVERAGE_INNING = 7;

function tierOf(play: PlayEntry): number {
  return typeof play.tier === "number" ? play.tier : TIER2;
}

// ── Inning labeling ────────────────────────────────────────

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

export function buildInningLabel(inning: number, half: "top" | "bottom"): string {
  return `${half === "top" ? "Top" : "Bottom"} ${ordinal(inning)}`;
}

/**
 * Read top/bottom from upstream when it's there. Returns `null` only when
 * none of the available signals identify the half — the caller falls back
 * to a timeline-derived value rather than silently defaulting to "top".
 *
 * Signal priority:
 *   1. `phase` / `periodLabel` (explicit "top"/"bottom" markers)
 *   2. `teamAbbreviation` vs the home team (bottom = home is batting).
 *
 * Signal #2 matters when upstream feeds (like ours) don't tag the half on
 * the play itself but always carry the batting-team abbreviation. Without
 * it, a half-inning that omits its 3rd out (tier-filtered upstream) bleeds
 * runners into the next half.
 */
function inningHalfFromUpstream(
  play: PlayEntry,
  homeTeamAbbr?: string,
): "top" | "bottom" | null {
  const phase = (play.phase || "").trim().toLowerCase();
  if (phase) {
    if (/^(t|top|t1|0)$/.test(phase)) return "top";
    if (/^(b|bot|bottom|t2|1)$/.test(phase)) return "bottom";
    if (phase.includes("top")) return "top";
    if (phase.includes("bot")) return "bottom";
  }
  const label = (play.periodLabel || "").trim().toUpperCase();
  if (label) {
    if (label.startsWith("TOP") || label.startsWith("T ") || label === "T") return "top";
    if (label.startsWith("BOT") || label.startsWith("B ") || label === "B") return "bottom";
    if (/^T\d+$/.test(label)) return "top";
    if (/^B\d+$/.test(label)) return "bottom";
  }
  const team = play.teamAbbreviation?.trim().toUpperCase();
  const home = homeTeamAbbr?.trim().toUpperCase();
  if (team && home) {
    return team === home ? "bottom" : "top";
  }
  return null;
}

// ── Defensive readers ──────────────────────────────────────

interface RawPlaySituation {
  outs?: number;
  outsBefore?: number;
  outsAfter?: number;
  balls?: number;
  ballsBefore?: number;
  strikes?: number;
  strikesBefore?: number;
  count?: { balls?: number; strikes?: number };
  countBefore?: { balls?: number; strikes?: number };
  runners?: unknown;
  runnersOn?: unknown;
  runnersBefore?: unknown;
  runnersAfter?: unknown;
  baseRunners?: unknown;
  baseRunnersBefore?: unknown;
  baseRunnersAfter?: unknown;
  baseStateBefore?: unknown;
  baseStateAfter?: unknown;
  bases?: unknown;
  basesBefore?: unknown;
  basesAfter?: unknown;
  batter?: string;
  batterName?: string;
  pitcher?: string;
  pitcherName?: string;
}

function readNum(...candidates: Array<unknown>): number | undefined {
  for (const c of candidates) if (typeof c === "number") return c;
  return undefined;
}

function readStr(...candidates: Array<unknown>): string | undefined {
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  return undefined;
}

const BASE_KEYS: Record<string, "first" | "second" | "third"> = {
  "1": "first",
  "2": "second",
  "3": "third",
  first: "first",
  second: "second",
  third: "third",
  "1b": "first",
  "2b": "second",
  "3b": "third",
};

function readBaseState(raw: unknown): BaseballBaseState | undefined {
  if (!raw) return undefined;
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if ("first" in obj || "second" in obj || "third" in obj) {
      return {
        first: Boolean(obj.first),
        second: Boolean(obj.second),
        third: Boolean(obj.third),
      };
    }
  }
  if (Array.isArray(raw)) {
    const occupied: BaseballBaseState = { first: false, second: false, third: false };
    for (const entry of raw) {
      let key: string | undefined;
      if (typeof entry === "string") key = entry;
      else if (entry && typeof entry === "object") {
        const obj = entry as { base?: string | number; on?: string | number };
        const v = obj.base ?? obj.on;
        if (v !== undefined) key = String(v);
      }
      if (!key) continue;
      const norm = BASE_KEYS[key.toLowerCase()];
      if (norm) occupied[norm] = true;
    }
    return occupied;
  }
  return undefined;
}

function readBaseStateAfterUpstream(
  play: PlayEntry & RawPlaySituation,
): BaseballBaseState | undefined {
  return (
    readBaseState(play.baseStateAfter) ??
    readBaseState(play.runnersAfter) ??
    readBaseState(play.baseRunnersAfter) ??
    readBaseState(play.basesAfter)
  );
}

function readBaseStateBeforeUpstream(
  play: PlayEntry & RawPlaySituation,
): BaseballBaseState | undefined {
  return (
    readBaseState(play.baseStateBefore) ??
    readBaseState(play.runnersBefore) ??
    readBaseState(play.baseRunnersBefore) ??
    readBaseState(play.basesBefore) ??
    // Fall back to "current" runners — many feeds emit this for the at-bat
    // entering state.
    readBaseState(play.runners) ??
    readBaseState(play.runnersOn) ??
    readBaseState(play.baseRunners) ??
    readBaseState(play.bases)
  );
}

// ── Event type + ball path classification ──────────────────

// Order matters: most-specific first. "Triple play" must beat "triple", and
// "double play" must beat "double". Sub-categories that share a stem
// (passed_ball / wild_pitch, hit_by_pitch / walk) are differentiated by their
// distinguishing keyword.
const EVENT_KEYWORDS: Array<[PlayEventType, RegExp]> = [
  ["triple_play", /\btriple[-\s]?play\b/i],
  ["double_play", /\bdouble[-\s]?play|\bgidp\b/i],
  ["home_run", /\b(home\s*run|homers?|grand\s*slam|hr)\b/i],
  ["triple", /\btriples?\b/i],
  ["double", /\bdoubles?\b(?!\s*play)/i],
  ["single", /\bsingles?\b/i],
  ["hit_by_pitch", /\b(hit\s*by\s*pitch|hbp)\b/i],
  ["walk", /\b(walks?|base\s*on\s*balls|bb|intentional\s*walk|ibb)\b/i],
  ["catcher_interference", /\bcatcher(?:'s)?\s*interference\b/i],
  ["strikeout", /\b(strikes?\s*out|struck\s*out|strikeouts?|punches?\s*out|called\s*out\s*on\s*strikes|k\b)/i],
  ["caught_stealing", /\bcaught\s*stealing|throw(?:n)?\s*out\s*stealing|cs\b/i],
  ["pickoff", /\bpicked\s*off|pickoff\b/i],
  ["stolen_base", /\bsteals?\b|\bstolen\s*base/i],
  ["balk", /\bbalk\b/i],
  ["passed_ball", /\bpassed\s*ball\b/i],
  ["wild_pitch", /\bwild\s*pitch\b/i],
  ["sacrifice", /\bsacrifice|sac\s*(fly|bunt)\b/i],
  ["fielders_choice", /\bfielder['']?s\s*choice|\bfc\b/i],
  ["error", /\b(reaches\s*on.*error|error\b)/i],
  ["field_out", /\b(grounds?\s*out|flies\s*out|fly\s*out|pops?\s*out|lines?\s*out|line\s*out|forces?\s*out|force\s*out|tags?\s*out|tag\s*out|ground\s*out|out\b)/i],
];

export function classifyEvent(play: PlayEntry): PlayEventType {
  const explicit = (play.playType || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (explicit) {
    const known: PlayEventType[] = [
      "single", "double", "triple", "home_run", "walk", "hit_by_pitch", "strikeout",
      "field_out", "double_play", "triple_play", "fielders_choice", "error",
      "stolen_base", "caught_stealing", "pickoff",
      "wild_pitch", "passed_ball", "balk", "sacrifice", "catcher_interference",
    ];
    for (const k of known) if (explicit === k) return k;
    if (explicit.includes("triple_play")) return "triple_play";
    if (explicit.includes("home_run")) return "home_run";
    if (explicit.includes("double_play") || explicit === "gidp") return "double_play";
    if (explicit.includes("triple")) return "triple";
    if (explicit.includes("double")) return "double";
    if (explicit.includes("single")) return "single";
    if (explicit.includes("hit_by_pitch") || explicit === "hbp") return "hit_by_pitch";
    if (explicit.includes("intentional_walk") || explicit === "ibb") return "walk";
    if (explicit.includes("walk") || explicit === "bb") return "walk";
    if (explicit.includes("strikeout") || explicit === "k" || explicit === "ko") return "strikeout";
    if (explicit.includes("caught_stealing") || explicit === "cs") return "caught_stealing";
    if (explicit.includes("pickoff")) return "pickoff";
    if (explicit.includes("steal") || explicit.includes("stolen")) return "stolen_base";
    if (explicit.includes("balk")) return "balk";
    if (explicit.includes("passed_ball")) return "passed_ball";
    if (explicit.includes("wild_pitch") || explicit.includes("wild")) return "wild_pitch";
    if (explicit.includes("catcher_interference")) return "catcher_interference";
    if (explicit.includes("fielders_choice") || explicit === "fc") return "fielders_choice";
    if (explicit.includes("error")) return "error";
    if (explicit.includes("sac")) return "sacrifice";
    if (explicit.includes("out")) return "field_out";
  }
  const desc = play.description || "";
  for (const [eventType, re] of EVENT_KEYWORDS) {
    if (re.test(desc)) return eventType;
  }
  // Surface unmapped descriptions in dev so we can extend coverage.
  if (process.env.NODE_ENV !== "production" && desc.trim().length > 0) {
    console.warn("[catchup-cards] classifyEvent fell through to 'other' for:", desc);
  }
  return "other";
}

// Description keys. The outfield ones must allow both "left field" and
// "left fielder" — the original `\bleft\s*field\b` missed the "-er" suffix.
const DIRECTION_LEFT_CENTER  = /\bleft[-\s]+center(?:\s*field(?:er)?)?\b/i;
const DIRECTION_RIGHT_CENTER = /\bright[-\s]+center(?:\s*field(?:er)?)?\b/i;
const DIRECTION_LEFT   = /\b(left\s*field(?:er)?|to\s*left|\blf\b|down\s*the\s*(?:left[-\s])?line)\b/i;
const DIRECTION_RIGHT  = /\b(right\s*field(?:er)?|to\s*right|\brf\b|down\s*the\s*right[-\s]line)\b/i;
const DIRECTION_CENTER = /\b(center\s*field(?:er)?|to\s*center|\bcf\b|up\s*the\s*middle)\b/i;
const FIELDER_3B = /\bthird\s*base(?:man)?\b|\b3b\b/i;
const FIELDER_SS = /\bshort(?:stop)?\b|\bss\b/i;
const FIELDER_2B = /\bsecond\s*base(?:man)?\b|\b2b\b/i;
const FIELDER_1B = /\bfirst\s*base(?:man)?\b|\b1b\b/i;
const FIELDER_P  = /\bpitcher\b/i;
const DESC_GROUNDER = /\bground(?:s|ed|er|ing)?\b/i;
const DESC_LINE = /\blin(?:es?|ed|ing|er|e\s*drive)\b/i;
const DESC_FLY = /\bfl(?:y|ies|ied|ying)\b/i;
const DESC_POPUP = /\bpop(?:s|ped|up|ping)?\b/i;
const DESC_FOUL = /\bfoul/i;

/** Pick the outfield zone for a fly / line drive based on description. */
function outfieldZone(description: string, fallback: BallPath): BallPath {
  if (DIRECTION_LEFT_CENTER.test(description))  return "fly_lcf";
  if (DIRECTION_RIGHT_CENTER.test(description)) return "fly_rcf";
  if (DIRECTION_LEFT.test(description))         return "fly_lf";
  if (DIRECTION_RIGHT.test(description))        return "fly_rf";
  if (DIRECTION_CENTER.test(description))       return "fly_cf";
  return fallback;
}

/** Pick the grounder zone — terminate at the fielder, not the mound. */
function groundZone(description: string): BallPath {
  // Take the FIRST fielder mentioned. "grounds out, third baseman X to first
  // baseman Y" should pick 3B, not 1B (the throw destination).
  const matches: Array<{ idx: number; zone: BallPath }> = [];
  const m3b = description.match(FIELDER_3B);
  const mss = description.match(FIELDER_SS);
  const m2b = description.match(FIELDER_2B);
  const m1b = description.match(FIELDER_1B);
  const mp  = description.match(FIELDER_P);
  if (m3b?.index != null) matches.push({ idx: m3b.index, zone: "ground_3b" });
  if (mss?.index != null) matches.push({ idx: mss.index, zone: "ground_ss" });
  if (m2b?.index != null) matches.push({ idx: m2b.index, zone: "ground_2b" });
  if (m1b?.index != null) matches.push({ idx: m1b.index, zone: "ground_1b" });
  if (mp?.index  != null) matches.push({ idx: mp.index,  zone: "ground_p"  });
  if (matches.length > 0) {
    matches.sort((a, b) => a.idx - b.idx);
    return matches[0].zone;
  }
  // No fielder mentioned — bias by general direction.
  if (DIRECTION_LEFT.test(description))  return "ground_ss";
  if (DIRECTION_RIGHT.test(description)) return "ground_2b";
  return "ground_p";
}

/** Pick the line-drive zone. Lines stay flat and short. Honors named
 *  infielders so a "line drive to second baseman" reads on the right side. */
function lineZone(description: string): BallPath {
  // Outfield direction wins first — that's where the ball actually ended up.
  if (DIRECTION_LEFT.test(description))   return "line_left";
  if (DIRECTION_RIGHT.test(description))  return "line_right";
  if (DIRECTION_CENTER.test(description)) return "line_center";
  // Named infielder: SS / 3B → left side; 2B / 1B → right side; P → center.
  if (FIELDER_3B.test(description) || FIELDER_SS.test(description)) return "line_left";
  if (FIELDER_2B.test(description) || FIELDER_1B.test(description)) return "line_right";
  return "line_center";
}

function homeRunZone(description: string): BallPath {
  // Direction wins first — most HR descriptions name the field they
  // cleared. Center as the default if the description is silent.
  if (DIRECTION_LEFT_CENTER.test(description) || DIRECTION_LEFT.test(description)) return "home_run_left";
  if (DIRECTION_RIGHT_CENTER.test(description) || DIRECTION_RIGHT.test(description)) return "home_run_right";
  return "home_run_center";
}

function ballPathFromEvent(event: PlayEventType, description: string): BallPath {
  switch (event) {
    case "home_run":
      return homeRunZone(description);
    case "strikeout":
    case "walk":
      return "none";
    case "hit_by_pitch":
      // No ball path drawn — the trigger flash covers it.
      return "none";
    case "stolen_base":
    case "caught_stealing":
    case "pickoff":
    case "balk":
    case "catcher_interference":
      return "none";
    case "wild_pitch":
    case "passed_ball":
      return "pitch";
    case "triple":
    case "double": {
      if (DESC_LINE.test(description)) return lineZone(description);
      // Default doubles bias to LF; triples bias to CF gap.
      return outfieldZone(description, event === "triple" ? "fly_cf" : "fly_lf");
    }
    case "single": {
      // Singles described as "ground ball to right fielder" — the ball is
      // an outfield-bound dribbler, but the descriptive direction is what
      // the user reads. Trust DIRECTION first.
      if (DIRECTION_LEFT_CENTER.test(description) ||
          DIRECTION_RIGHT_CENTER.test(description) ||
          DIRECTION_LEFT.test(description) ||
          DIRECTION_RIGHT.test(description) ||
          DIRECTION_CENTER.test(description)) {
        return outfieldZone(description, "fly_cf");
      }
      if (DESC_LINE.test(description)) return lineZone(description);
      if (DESC_GROUNDER.test(description)) return groundZone(description);
      return "fly_cf";
    }
    case "double_play":
    case "triple_play":
    case "field_out":
    case "sacrifice":
    case "fielders_choice":
    case "error":
    case "other": {
      if (DESC_FOUL.test(description)) return "foul";
      if (DESC_LINE.test(description)) {
        // Line drives "to left fielder" stay flat-and-short toward LF.
        return lineZone(description);
      }
      if (DESC_FLY.test(description)) {
        return outfieldZone(description, "fly_cf");
      }
      if (DESC_POPUP.test(description)) return "popup";
      if (DESC_GROUNDER.test(description)) return groundZone(description);
      // Bare "out" with infielder named — still a grounder.
      if (FIELDER_3B.test(description) || FIELDER_SS.test(description) ||
          FIELDER_2B.test(description) || FIELDER_1B.test(description) ||
          FIELDER_P.test(description)) {
        return groundZone(description);
      }
      // Outfielder named without a fly verb is most often a line-out caught
      // on the run — show it as a line drive.
      if (DIRECTION_LEFT.test(description) || DIRECTION_RIGHT.test(description) ||
          DIRECTION_CENTER.test(description)) {
        return lineZone(description);
      }
      return event === "other" ? "none" : "ground_p";
    }
  }
}

/**
 * Light polish on the upstream play description so it doesn't read like a
 * stat dump: strip parenthetical annotations ("(scored)", "(2 RBI)"),
 * normalize whitespace, ensure first-letter caps and a trailing period.
 *
 * Deliberately conservative — no LLM rewrite. We don't want to invent
 * detail or contradict the upstream feed; we just clean up the surface so
 * cards read as natural sentences instead of feed text.
 */
export function humanizeDescription(raw: string): string {
  let s = (raw || "").trim();
  if (!s) return s;

  // Drop leading "1: " or "1. " numbering.
  s = s.replace(/^\d+[.:]\s*/, "");
  // Drop umpire-review preamble — common shapes:
  //   "Player challenged (pitch result), call on the field was overturned: …"
  //   "Royals challenged (hit by pitch), call on the field was upheld: …"
  //   "… call stands: …"
  // Keep only the part after the colon.
  s = s.replace(
    /^.*?challenge(?:d)?(?:[^:]*?)(?:overturned|confirmed|upheld|stands)\s*:\s*/i,
    "",
  );
  // Drop parenthetical / bracketed annotations.
  s = s.replace(/\s*\([^)]*\)\s*/g, " ");
  s = s.replace(/\s*\[[^\]]*\]\s*/g, " ");
  // Collapse whitespace.
  s = s.replace(/\s+/g, " ").trim();
  if (!s) return s;
  // Capitalize first letter.
  s = s[0].toUpperCase() + s.slice(1);
  // Collapse repeated trailing terminators to a single one ("..", " ." → ".")
  // so we don't accidentally drop a real "!" or "?".
  s = s.replace(/([.!?])[.!?\s]*$/, "$1");
  // Ensure a single trailing period if the upstream feed didn't terminate.
  if (!/[.!?]$/.test(s)) s += ".";
  return s;
}

/**
 * Pick a granular animation profile for the play. The profile drives trail
 * timing + persistence + double-play choreography in the field component.
 * BallPath still owns the actual path string; the profile is purely a
 * "behavior" axis layered on top.
 *
 * Note on `relay_throw`: the original ISSUE-006 spec proposed a top-level
 * `relay_throw` profile gated by a /\brelay\b|\bcutoff\b/i description
 * regex on hit/field_out events. The current MLB fixture corpus contains
 * zero descriptions matching those terms, so a classifier branch would be
 * silently dead. The two-segment relay throw was instead demoted to an
 * ExtraTrailDef pair attached to `deep_fly` and `line_drive` profiles in
 * BaseballLightField's EXTRA_TRAILS — see resolveExtraTrails() there.
 */
export function classifyAnimationProfile(
  event: PlayEventType,
  description: string,
): PlayAnimationProfile {
  // Rundown: caught in a rundown between bases. Detected before the
  // event-specific switch so it wins over the generic field_out /
  // caught_stealing fallthroughs.
  if (
    (event === "caught_stealing" || event === "field_out") &&
    /\brundown\b/i.test(description)
  ) {
    return "rundown";
  }
  switch (event) {
    case "home_run":  return "home_run";
    case "walk":      return "walk";
    case "hit_by_pitch": return "walk"; // shares timing/no-trail behavior; trigger flash differs
    case "catcher_interference": return "walk";
    case "strikeout": return "strikeout";
    case "stolen_base": return "stolen_base";
    case "caught_stealing": return "stolen_base";
    case "pickoff":   return "stolen_base";
    case "balk":      return "stolen_base"; // runners-only beat, no batted ball
    case "wild_pitch":
    case "passed_ball":
      return "wild_pitch";
    case "double_play":
    case "triple_play":
      return DESC_FLY.test(description) || DESC_POPUP.test(description)
        ? "double_play_fly"
        : "double_play_grounder";
    case "sacrifice":
      return DESC_FLY.test(description) ? "sacrifice_fly" : "routine_grounder";
    case "field_out": {
      if (DESC_POPUP.test(description)) return "popup";
      if (DESC_FLY.test(description)) {
        return /\bdeep|warning track|wall|caught at the wall/i.test(description)
          ? "deep_fly"
          : "shallow_fly";
      }
      if (DESC_LINE.test(description)) return "line_drive";
      return "routine_grounder";
    }
    case "fielders_choice": {
      // FCs are almost always grounders.
      return "hard_grounder";
    }
    case "single": {
      if (DESC_GROUNDER.test(description)) return "hard_grounder";
      if (DESC_LINE.test(description)) return "line_drive";
      return "shallow_fly";
    }
    case "double":
    case "triple": {
      if (DESC_LINE.test(description)) return "line_drive";
      return "deep_fly";
    }
    case "error":
    case "other":
    default:
      return "other";
  }
}

function visualIntensity(event: PlayEventType): "low" | "medium" | "high" {
  switch (event) {
    case "home_run":
    case "triple_play":
    case "double_play":
    case "triple":
      return "high";
    case "double":
    case "single":
    case "error":
    case "fielders_choice":
    case "wild_pitch":
    case "passed_ball":
    case "caught_stealing":
    case "pickoff":
      return "medium";
    case "strikeout":
    case "walk":
    case "hit_by_pitch":
    case "catcher_interference":
    case "field_out":
    case "stolen_base":
    case "balk":
    case "sacrifice":
    case "other":
    default:
      return "low";
  }
}

// ── Outs delta + advances ──────────────────────────────────

function outsDeltaFor(event: PlayEventType): number {
  switch (event) {
    case "triple_play":
      return 3;
    case "double_play":
      return 2;
    case "strikeout":
    case "field_out":
    case "sacrifice":
    case "fielders_choice":
    case "caught_stealing":
    case "pickoff":
      return 1;
    default:
      return 0;
  }
}

/** Plausibility downgrade: if upstream says "double_play" but the base
 *  state can't physically support one (no runner to retire alongside the
 *  batter), step the event down to a single field-out so we don't draw
 *  an impossible animation. Same idea for triple plays — they need at
 *  least 2 runners on. */
function downgradeImplausible(
  before: BaseballBaseState,
  event: PlayEventType,
): PlayEventType {
  const occupied =
    (before.first ? 1 : 0) + (before.second ? 1 : 0) + (before.third ? 1 : 0);
  if (event === "triple_play" && occupied < 2) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[catchup-cards] triple_play requires 2+ runners; downgrading to field_out", { before });
    }
    return occupied >= 1 ? "double_play" : "field_out";
  }
  if (event === "double_play" && occupied < 1) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[catchup-cards] double_play requires 1+ runner; downgrading to field_out", { before });
    }
    return "field_out";
  }
  return event;
}

/** Where the BATTER ends up by event type. Shared between the heuristic
 *  predictor and the diff resolver. Returns null when the event has no
 *  batter movement (steal, balk, wild pitch, etc.). */
function batterDestForEvent(event: PlayEventType): RunnerAdvance["to"] | null {
  switch (event) {
    case "single":               return "first";
    case "double":               return "second";
    case "triple":               return "third";
    case "home_run":             return "home";
    case "walk":                 return "first";
    case "hit_by_pitch":         return "first";
    case "catcher_interference": return "first";
    case "error":                return "first";
    case "fielders_choice":      return "first";
    case "field_out":            return "out";
    case "double_play":          return "out";
    case "triple_play":          return "out";
    case "strikeout":            return "out";
    case "sacrifice":            return "out";
    default:                     return null;
  }
}

/** Reconcile advances with reported `runsScored`. Two-pass:
 *    1. Promote existing in-play advances to "home" (lead runner first).
 *    2. If still short, ADD synthetic scoring advances for occupied bases
 *       whose runner has no advance yet. Covers cases like a force-out
 *       where the lead runner scored but the heuristic produced no
 *       advance for them. */
function applyRunConstraint(
  before: BaseballBaseState,
  advances: RunnerAdvance[],
  runsScored: number,
  event: PlayEventType,
): RunnerAdvance[] {
  if (runsScored <= 0) return advances;
  const out = advances.map((a) => ({ ...a }));

  // Home-run batter scores by definition — count toward the constraint.
  let predictedScores = out.filter((a) => a.to === "home").length;
  if (predictedScores >= runsScored) return out;

  const fromOrder: Record<RunnerAdvance["from"], number> = {
    third: 0, second: 1, first: 2, home: 3,
  };

  // Pass 1 — promote existing in-play advances.
  while (predictedScores < runsScored) {
    let bestIdx = -1;
    let bestPriority = Infinity;
    for (let i = 0; i < out.length; i++) {
      const a = out[i];
      if (a.to === "home" || a.to === "out") continue;
      // Skip the batter on non-HR events — promoting them would turn a
      // triple into HR-style visuals.
      if (a.from === "home" && event !== "home_run") continue;
      const p = fromOrder[a.from];
      if (p < bestPriority) {
        bestPriority = p;
        bestIdx = i;
      }
    }
    if (bestIdx < 0) break;
    out[bestIdx] = { ...out[bestIdx], to: "home" };
    predictedScores++;
  }

  // Pass 2 — synthetic advances from occupied bases that have no entry
  // yet. Lead-runner-first.
  if (predictedScores < runsScored) {
    const advancedFroms = new Set(out.map((a) => a.from));
    const occupiedLeadFirst: Array<"first" | "second" | "third"> = [];
    if (before.third)  occupiedLeadFirst.push("third");
    if (before.second) occupiedLeadFirst.push("second");
    if (before.first)  occupiedLeadFirst.push("first");
    for (const b of occupiedLeadFirst) {
      if (predictedScores >= runsScored) break;
      if (!advancedFroms.has(b)) {
        out.push({ from: b, to: "home" });
        advancedFroms.add(b);
        predictedScores++;
      }
    }
  }

  return out;
}

// ── Description-derived advances ───────────────────────────
// Upstream descriptions are explicit about what every runner did:
//   "Alejandro Osuna to 3rd."
//   "Brandon Nimmo out at 2nd."
//   "Paul Goldschmidt scores."
//   "Ezequiel Duran to 1st."
// Event-type heuristics (predictAdvances) only know "this is a force_out" —
// they have no way to know whether the lead runner scored or which runner
// got tagged. Parsing the prose is the difference between guessing and
// reading the play.

// Matches one OR more capitalized tokens — single-word names ("Goldschmidt
// scores") are real in some feeds, multi-word ("Paul Goldschmidt") more
// common. False matches on common nouns are blocked downstream by
// `fromBaseFor`: an unrecognized name resolves to no `from` and is dropped.
const NAME_PATTERN =
  "[\\p{Lu}][\\p{L}'.\\-]*(?:\\s+[\\p{Lu}][\\p{L}'.\\-]*)*";
const BASE_PATTERN =
  "1st|first|2nd|second|3rd|third|home(?:\\s+plate)?";

const RE_SCORES = new RegExp(
  `(${NAME_PATTERN})\\s+scores\\b`,
  "gu",
);
const RE_TO_BASE = new RegExp(
  `(${NAME_PATTERN})\\s+to\\s+(${BASE_PATTERN})\\b`,
  "gu",
);
const RE_OUT_AT = new RegExp(
  `(${NAME_PATTERN})\\s+(?:thrown\\s+out\\s+at|tagged\\s+out\\s+at|out\\s+at|forced\\s+out\\s+at|caught\\s+stealing(?:\\s+at)?|picked\\s+off\\s+(?:at\\s+)?)\\s*(${BASE_PATTERN})\\b`,
  "gu",
);

function parseTargetBase(raw: string): "first" | "second" | "third" | "home" {
  const t = raw.trim().toLowerCase();
  if (t === "1st" || t === "first") return "first";
  if (t === "2nd" || t === "second") return "second";
  if (t === "3rd" || t === "third") return "third";
  return "home";
}

function namesMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (x === y) return true;
  // Last-name match — descriptions sometimes use full names while our
  // name table uses last-only (or vice versa).
  const xLast = x.split(/\s+/).pop();
  const yLast = y.split(/\s+/).pop();
  if (xLast && yLast && xLast === yLast) return true;
  // Prefix/suffix containment — handles "P. Goldschmidt" vs "Paul Goldschmidt".
  if (xLast && y.includes(xLast)) return true;
  if (yLast && x.includes(yLast)) return true;
  return false;
}

/**
 * Parse runner advances out of an upstream description string.
 *
 * Returns advances attributed by name — the caller is expected to merge
 * these on top of event-type predictions (parsed entries win for any base
 * the parser actually identified).
 *
 * Each parsed advance includes the actor's `from` base, looked up against
 * `namesBefore` (or treated as the batter when the name matches
 * `batterName`). When no base can be resolved for a parsed name (typically
 * because earlier propagation lost the runner), the advance is dropped —
 * it's better to under-emit than to fabricate a `from` we can't justify.
 */
export function parseDescriptionAdvances(
  description: string,
  namesBefore: RunnerNames,
  batterName: string | undefined,
): RunnerAdvance[] {
  if (!description) return [];

  const fromBaseFor = (name: string): RunnerAdvance["from"] | null => {
    if (namesMatch(name, namesBefore.first)) return "first";
    if (namesMatch(name, namesBefore.second)) return "second";
    if (namesMatch(name, namesBefore.third)) return "third";
    if (namesMatch(name, batterName)) return "home";
    return null;
  };

  const advances: RunnerAdvance[] = [];

  for (const m of description.matchAll(RE_SCORES)) {
    const from = fromBaseFor(m[1]);
    if (from) advances.push({ from, to: "home" });
  }
  for (const m of description.matchAll(RE_TO_BASE)) {
    const from = fromBaseFor(m[1]);
    if (!from) continue;
    const to = parseTargetBase(m[2]);
    advances.push({ from, to });
  }
  for (const m of description.matchAll(RE_OUT_AT)) {
    const from = fromBaseFor(m[1]);
    if (!from) continue;
    const outAt = parseTargetBase(m[2]);
    advances.push({ from, to: "out", outAt });
  }

  return advances;
}

/**
 * Merge description-derived advances on top of event-type-derived ones.
 *
 * Description wins for any `from` base it identifies — event-type
 * heuristics fill in the runners the description didn't mention (typically
 * the batter on a non-explicit play, or runners on minor advancement).
 */
function mergeParsedAdvances(
  predicted: RunnerAdvance[],
  parsed: RunnerAdvance[],
): RunnerAdvance[] {
  if (parsed.length === 0) return predicted;
  const byFrom = new Map<RunnerAdvance["from"], RunnerAdvance>();
  for (const a of predicted) byFrom.set(a.from, a);
  for (const a of parsed) byFrom.set(a.from, a);
  return Array.from(byFrom.values());
}

function predictAdvances(
  before: BaseballBaseState,
  rawEvent: PlayEventType,
  profile?: PlayAnimationProfile,
): RunnerAdvance[] {
  const event = downgradeImplausible(before, rawEvent);
  const advances: RunnerAdvance[] = [];
  const advanceBases: number = (() => {
    switch (event) {
      case "single": return 1;
      case "double": return 2;
      case "triple": return 3;
      case "home_run": return 4;
      default: return 0;
    }
  })();

  // Where outs typically occur on this kind of play. Drives runner-dot
  // animation: "tagged-out" runners visibly travel to outAt before flaring
  // out, instead of just blinking off in place.
  const dpFly = profile === "double_play_fly";
  const dpGrounder = profile === "double_play_grounder";

  // Forced-advance events (every runner moves up one if the trailing base
  // is occupied — applies on walks, HBPs, catcher's interference). The
  // baseball-correct rule is "force advance only if all preceding bases
  // are loaded behind the runner."
  const isForceWalk =
    event === "walk" || event === "hit_by_pitch" || event === "catcher_interference";
  // Free-base events (every occupied base advances exactly one): balk,
  // wild pitch, passed ball.
  const isFreeBase =
    event === "balk" || event === "wild_pitch" || event === "passed_ball" || event === "error";

  if (before.third) {
    if (advanceBases >= 1 || event === "sacrifice") {
      advances.push({ from: "third", to: "home" });
    } else if (event === "double_play" || event === "triple_play") {
      if (dpFly) advances.push({ from: "third", to: "out", outAt: "home" });
      // ground DP: 3B typically holds (force is at second).
    } else if (isFreeBase) {
      advances.push({ from: "third", to: "home" });
    } else if (isForceWalk && before.first && before.second) {
      advances.push({ from: "third", to: "home" });
    }
  }
  if (before.second) {
    if (advanceBases >= 2) advances.push({ from: "second", to: "home" });
    else if (advanceBases >= 1) advances.push({ from: "second", to: "third" });
    else if (event === "double_play" || event === "triple_play") {
      if (dpGrounder) advances.push({ from: "second", to: "out", outAt: "third" });
    }
    else if (event === "fielders_choice") {
      // Lead runner is the typical FC casualty — assume the runner ahead
      // is the one thrown out at the next base.
      advances.push({ from: "second", to: "out", outAt: "third" });
    }
    else if (isFreeBase) advances.push({ from: "second", to: "third" });
    else if (isForceWalk && before.first) {
      advances.push({ from: "second", to: "third" });
    }
  }
  if (before.first) {
    if (advanceBases >= 3) advances.push({ from: "first", to: "home" });
    else if (advanceBases === 2) advances.push({ from: "first", to: "third" });
    else if (advanceBases === 1) advances.push({ from: "first", to: "second" });
    else if (isForceWalk) advances.push({ from: "first", to: "second" });
    else if (event === "double_play" || event === "triple_play") {
      // Classic 6-4-3 force at second. Fly DP: doubled-off back at 1st.
      advances.push({
        from: "first",
        to: "out",
        outAt: dpFly ? "first" : "second",
      });
    }
    else if (event === "fielders_choice" && !before.second) {
      // FC with only first occupied — runner usually forced at second.
      advances.push({ from: "first", to: "out", outAt: "second" });
    }
    else if (isFreeBase) advances.push({ from: "first", to: "second" });
  }

  // Caught stealing / pickoff — the runner targeted is normally the lead
  // baserunner (no upstream cue here, so prefer 1st when occupied).
  if (event === "caught_stealing" || event === "pickoff") {
    if (before.first) {
      advances.push({
        from: "first",
        to: "out",
        outAt: event === "pickoff" ? "first" : "second",
      });
    } else if (before.second) {
      advances.push({
        from: "second",
        to: "out",
        outAt: event === "pickoff" ? "second" : "third",
      });
    } else if (before.third) {
      advances.push({ from: "third", to: "out", outAt: "home" });
    }
  }

  const batterDest: RunnerAdvance["to"] | null = batterDestForEvent(event);
  if (batterDest) {
    // Fly outs: caught in the air — the batter is "out" near the catch
    // point, which we visualize at home plate. Ground-out / DP / sac:
    // thrown out at first.
    const outAt: RunnerAdvance["outAt"] | undefined =
      batterDest === "out" && (
        event === "field_out" || event === "double_play" ||
        event === "triple_play" || event === "sacrifice"
      )
        ? (profile === "popup" || profile === "shallow_fly" || profile === "deep_fly" || profile === "sacrifice_fly")
          ? undefined  // caught in the air; flare in place
          : "first"
        : undefined;
    advances.push({ from: "home", to: batterDest, ...(outAt ? { outAt } : {}) });
  }

  return advances;
}

/** Derive RunnerAdvance[] from a known before/after pair by diffing.
 *  Used when upstream supplies basesAfter — preferred over predicting
 *  because it can't lie about which runner went where. Names match
 *  first; unknown names fall back to lead-runner positional matching. */
function diffAdvances(
  before: BaseballBaseState,
  namesBefore: RunnerNames,
  after: BaseballBaseState,
  namesAfter: RunnerNames,
  batterName: string | undefined,
  batterDest: RunnerAdvance["to"] | null,
  runsScored: number,
): RunnerAdvance[] {
  const baseRank: Record<"home" | "first" | "second" | "third", number> = {
    home: 0, first: 1, second: 2, third: 3,
  };
  type Slot = { base: "first" | "second" | "third"; name?: string };
  const beforeSlots: Slot[] = [];
  if (before.first)  beforeSlots.push({ base: "first",  name: namesBefore.first  });
  if (before.second) beforeSlots.push({ base: "second", name: namesBefore.second });
  if (before.third)  beforeSlots.push({ base: "third",  name: namesBefore.third  });
  const afterSlots: Slot[] = [];
  if (after.first)  afterSlots.push({ base: "first",  name: namesAfter.first  });
  if (after.second) afterSlots.push({ base: "second", name: namesAfter.second });
  if (after.third)  afterSlots.push({ base: "third",  name: namesAfter.third  });

  const advances: RunnerAdvance[] = [];
  const usedAfter = new Set<number>();

  // Pass 1: name-match every before-slot whose name we know.
  for (const b of beforeSlots) {
    if (!b.name) continue;
    const idx = afterSlots.findIndex((a, i) => !usedAfter.has(i) && a.name === b.name);
    if (idx >= 0) {
      usedAfter.add(idx);
      const a = afterSlots[idx];
      if (a.base !== b.base) advances.push({ from: b.base, to: a.base });
      // else: held — no move
    }
  }

  // Pass 2: unmatched before-slots — runner left without a destination on
  // the bases. Either scored or got out. Use runsScored to allocate as
  // many "home" destinations as we have unaccounted runs.
  let runsToAllocate = Math.max(
    0,
    runsScored - advances.filter((a) => a.to === "home").length,
  );
  // If batter goes home (HR), one of the runs is for them.
  if (batterDest === "home") runsToAllocate = Math.max(0, runsToAllocate - 1);
  const unmatchedBefore = beforeSlots.filter(
    (b) => !advances.some((a) => a.from === b.base) && !b.name
      ? !afterSlots.some((aft, i) => !usedAfter.has(i) && aft.base === b.base)
      : !advances.some((a) => a.from === b.base) &&
        !afterSlots.some((aft, i) => !usedAfter.has(i) && aft.name === b.name),
  );
  // Sort by lead-runner priority: 3rd → 2nd → 1st (most-advanced first).
  unmatchedBefore.sort((a, b) => baseRank[b.base] - baseRank[a.base]);
  for (const b of unmatchedBefore) {
    if (runsToAllocate > 0) {
      advances.push({ from: b.base, to: "home" });
      runsToAllocate--;
    } else {
      // Out somewhere — outAt unknown without more data; flare in place.
      advances.push({ from: b.base, to: "out" });
    }
  }

  // Pass 3: unmatched after-slots that don't trace to a before-slot. These
  // are typically the BATTER landing on a base. We attribute the first
  // unmatched after-slot to the batter, the rest are unaccounted.
  if (batterName && batterDest && batterDest !== "out" && batterDest !== "home") {
    advances.push({ from: "home", to: batterDest });
  } else if (batterDest === "home") {
    advances.push({ from: "home", to: "home" });
  } else if (batterDest === "out") {
    advances.push({ from: "home", to: "out" });
  }

  return advances;
}

function applyAdvances(
  before: BaseballBaseState,
  advances: RunnerAdvance[],
): BaseballBaseState {
  const after: BaseballBaseState = { ...before };
  for (const adv of advances) {
    if (adv.from === "first")  after.first = false;
    if (adv.from === "second") after.second = false;
    if (adv.from === "third")  after.third = false;
  }
  for (const adv of advances) {
    if (adv.to === "first")  after.first = true;
    if (adv.to === "second") after.second = true;
    if (adv.to === "third")  after.third = true;
  }
  return after;
}

/**
 * Carry runner names through a set of advances. The batter's name attaches to
 * whichever destination they reach (single → 1B, etc.). Existing runners
 * carry their names with them; runners scoring or making outs drop out.
 */
function applyRunnerNames(
  before: RunnerNames,
  advances: RunnerAdvance[],
  batterName: string | undefined,
): RunnerNames {
  // Pair each advance with the name of the runner moving (batter when from=home).
  type Move = { name: string | undefined; to: RunnerAdvance["to"] };
  const moves: Move[] = advances.map((adv) => ({
    name:
      adv.from === "first" ? before.first :
      adv.from === "second" ? before.second :
      adv.from === "third" ? before.third :
      adv.from === "home" ? batterName :
      undefined,
    to: adv.to,
  }));

  // Start with current state; clear any source that's advancing; then place
  // moving runners at their destinations.
  const after: RunnerNames = { ...before };
  for (const adv of advances) {
    if (adv.from === "first")  delete after.first;
    if (adv.from === "second") delete after.second;
    if (adv.from === "third")  delete after.third;
  }
  for (const m of moves) {
    if (!m.name) continue;
    if (m.to === "first")  after.first = m.name;
    else if (m.to === "second") after.second = m.name;
    else if (m.to === "third")  after.third = m.name;
    // home / out: the runner's name leaves the bases.
  }
  return after;
}

/** Read upstream-provided per-base runner names if the feed includes them. */
function readUpstreamRunnerNames(raw: unknown): RunnerNames | undefined {
  if (!raw) return undefined;
  // Object form: { first: { name }, ... } or { 1: { name }, ... } or { first: "Name" }.
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    const names: RunnerNames = {};
    const grab = (slot: keyof RunnerNames, ...keys: string[]) => {
      for (const k of keys) {
        const v = obj[k];
        if (typeof v === "string" && v.trim()) { names[slot] = v.trim(); return; }
        if (v && typeof v === "object") {
          const o = v as Record<string, unknown>;
          const n = o.name ?? o.runnerName ?? o.playerName;
          if (typeof n === "string" && n.trim()) { names[slot] = n.trim(); return; }
        }
      }
    };
    grab("first", "first", "1", "1B");
    grab("second", "second", "2", "2B");
    grab("third", "third", "3", "3B");
    if (names.first || names.second || names.third) return names;
  }
  // Array form: [{ base: 1, name: "Clemens" }].
  if (Array.isArray(raw)) {
    const names: RunnerNames = {};
    for (const entry of raw) {
      if (!entry || typeof entry !== "object") continue;
      const o = entry as Record<string, unknown>;
      const baseKey = String(o.base ?? o.on ?? "").toLowerCase();
      const slot: keyof RunnerNames | null =
        baseKey === "1" || baseKey === "first" || baseKey === "1b" ? "first" :
        baseKey === "2" || baseKey === "second" || baseKey === "2b" ? "second" :
        baseKey === "3" || baseKey === "third" || baseKey === "3b" ? "third" : null;
      if (!slot) continue;
      const name = o.name ?? o.runnerName ?? o.playerName;
      if (typeof name === "string" && name.trim()) names[slot] = name.trim();
    }
    if (names.first || names.second || names.third) return names;
  }
  return undefined;
}

// ── Pitcher + batter running timelines ────────────────────
// Upstream gives us total per-game pitcher stats only (`mlbPitchers`); the
// pitcher of record per play is unattributed. We recover it by walking the
// outs accumulated for each pitching team and indexing into that team's
// reliever list (chronological from upstream). Each pitcher's IP-as-outs
// defines the boundary at which the next reliever takes over.

/** "5.1" → 16 outs. "0" / null / unparseable → 0. */
function inningsPitchedToOuts(ip: string | null | undefined): number {
  if (!ip) return 0;
  const m = String(ip).trim().match(/^(\d+)(?:\.(\d))?$/);
  if (!m) return 0;
  const innings = Number(m[1]);
  const partOuts = m[2] ? Number(m[2]) : 0;
  return innings * 3 + partOuts;
}

interface PitcherSnapshot {
  /** Full name as carried in upstream (e.g. "Tim Hill"). */
  name: string;
}

/**
 * Walk the upstream plays once and produce, per playIndex, the pitcher of
 * record at the moment that play starts.
 *
 * Attribution rule: the pitcher whose cumulative-outs threshold (drawn
 * from `inningsPitched` in upstream `mlbPitchers`) hasn't been crossed
 * yet, considering all outs the team has already recorded.
 *
 * Assumes the upstream pitcher list is in chronological appearance order
 * within each team — that's how MLB feeds typically order it. When the
 * order is wrong or pitchers are missing, attribution silently falls back
 * to the team's starter.
 */
export function computePitcherTimeline(
  plays: PlayEntry[],
  pitchers: UpstreamPitcher[] | undefined,
  homeTeamFullName: string | undefined,
  awayTeamFullName: string | undefined,
  homeTeamAbbr: string | undefined,
): Map<number, PitcherSnapshot | undefined> {
  const result = new Map<number, PitcherSnapshot | undefined>();
  if (!plays.length) return result;

  type Reliever = { name: string; outsThreshold: number };
  const byTeam: Record<string, Reliever[]> = {};
  if (pitchers) {
    for (const p of pitchers) {
      const team = (p.team || "").trim();
      if (!team || !p.playerName) continue;
      const outs = inningsPitchedToOuts(p.inningsPitched);
      (byTeam[team] = byTeam[team] || []).push({
        name: p.playerName.trim(),
        outsThreshold: outs,
      });
    }
  }

  // Convert appearance-order list to cumulative thresholds: the pitcher of
  // record at outs=k is the FIRST reliever whose cumulative covers k+1.
  const cumByTeam: Record<string, Array<{ name: string; cumOuts: number }>> = {};
  for (const [team, list] of Object.entries(byTeam)) {
    let acc = 0;
    cumByTeam[team] = list.map((r) => {
      acc += r.outsThreshold;
      return { name: r.name, cumOuts: acc };
    });
  }

  // Outs already recorded by each pitching team (game-wide). Drives the
  // hand-off boundary between consecutive relievers.
  const outsByTeam: Record<string, number> = {};

  const sorted = [...plays].sort((a, b) => a.playIndex - b.playIndex);
  for (const play of sorted) {
    const battingTeamAbbr = (play.teamAbbreviation || "").trim().toUpperCase();
    const home = (homeTeamAbbr || "").trim().toUpperCase();
    const pitchingTeamFull =
      battingTeamAbbr && home && battingTeamAbbr === home
        ? awayTeamFullName
        : homeTeamFullName;
    if (!pitchingTeamFull) {
      result.set(play.playIndex, undefined);
      continue;
    }

    const pitcherList = cumByTeam[pitchingTeamFull] ?? [];
    const outsSoFar = outsByTeam[pitchingTeamFull] ?? 0;
    // First reliever whose cumulative outs hasn't been fully consumed.
    const onMound = pitcherList.find((r) => outsSoFar < r.cumOuts) ??
      pitcherList[pitcherList.length - 1];

    if (!onMound) {
      result.set(play.playIndex, undefined);
    } else {
      // Snapshot the pitcher of record BEFORE this play resolves.
      result.set(play.playIndex, { name: onMound.name });
      // Advance the team's outs counter so the next play sees the right
      // reliever after a pitcher's IP threshold is reached.
      outsByTeam[pitchingTeamFull] = outsSoFar + outsDeltaFor(classifyEvent(play));
    }
  }

  return result;
}

// ── Single-pass game timeline ──────────────────────────────
// One forward walk over EVERY upstream play (including tier-3 routine plays
// the deck won't surface). Computes inning + half + outs + scores at every
// step, plus selection flags (scoring / tying / lead-change / late-leverage).
// The deck builder uses the resulting flag set to force-include must-show
// plays even when upstream tier assignment misses them.

interface TimelineEntry {
  inning: number;
  half: "top" | "bottom";
  outsBefore: number;
  outsAfter: number;
  scoreBefore: { home: number; away: number };
  scoreAfter: { home: number; away: number };
  baseStateBefore: BaseballBaseState;
  baseStateAfter: BaseballBaseState;
  runnerNamesBefore: RunnerNames;
  runnerNamesAfter: RunnerNames;
  /** Runner advances reconciled against runsScored — the truthful list
   *  for the visualization layer. Use this on the card; do not re-run
   *  predictAdvances downstream. */
  advances: RunnerAdvance[];
  eventType: PlayEventType;
  runsScored: number;
  isScoringPlay: boolean;
  isTyingPlay: boolean;
  isLeadChangePlay: boolean;
  isLateLeverage: boolean;
  /** True when upstream provided a phase/periodLabel; false when we derived. */
  halfFromUpstream: boolean;
}

const EMPTY_BASES: BaseballBaseState = { first: false, second: false, third: false };

function whoIsLeading(score: { home: number; away: number }): "home" | "away" | "tie" {
  if (score.home > score.away) return "home";
  if (score.away > score.home) return "away";
  return "tie";
}

export function computeTimeline(
  plays: PlayEntry[],
  homeTeamAbbr: string | undefined,
): Map<number, TimelineEntry> {
  const result = new Map<number, TimelineEntry>();
  const sorted = [...plays].sort((a, b) => a.playIndex - b.playIndex);

  let stateInning = sorted[0]?.quarter ?? 1;
  let stateHalf: "top" | "bottom" = "top";
  let outsInHalf = 0;
  let stateScore = { home: 0, away: 0 };
  // Forward-propagated base occupancy + runner names. Reset on every
  // half-inning rollover (3 outs ends the half; bases clear).
  let stateBases: BaseballBaseState = { ...EMPTY_BASES };
  let stateRunners: RunnerNames = {};

  const resetHalf = () => {
    outsInHalf = 0;
    stateBases = { ...EMPTY_BASES };
    stateRunners = {};
  };

  for (const play of sorted) {
    const enriched = play as PlayEntry & RawPlaySituation;
    const event = classifyEvent(play);
    const upstreamHalf = inningHalfFromUpstream(play, homeTeamAbbr);
    const upstreamInning = play.quarter ?? stateInning;

    // Inning advance: when the play's inning differs from our running state,
    // jump to the new inning, reset to top, and clear bases.
    if (upstreamInning !== stateInning) {
      stateInning = upstreamInning;
      stateHalf = upstreamHalf ?? "top";
      resetHalf();
    } else if (upstreamHalf && upstreamHalf !== stateHalf) {
      // Same inning, different half — trust upstream and clear bases.
      stateHalf = upstreamHalf;
      resetHalf();
    } else if (!upstreamHalf && outsInHalf >= 3) {
      // No upstream half info, but we've burned 3 outs — flip + clear.
      stateHalf = stateHalf === "top" ? "bottom" : "top";
      resetHalf();
    }

    const inning = stateInning;
    const half = stateHalf;
    const outsBefore = outsInHalf;

    // Score state entering this play. Prefer upstream score-before fields;
    // fall back to the running state we've accumulated forward.
    const upstreamScoreBefore = (() => {
      const h = play.scoreBefore?.home ?? play.homeScoreBefore;
      const a = play.scoreBefore?.away ?? play.awayScoreBefore;
      if (typeof h === "number" && typeof a === "number") return { home: h, away: a };
      return undefined;
    })();
    const scoreBefore = upstreamScoreBefore ?? { ...stateScore };

    // Score state exiting: prefer upstream homeScore/awayScore; otherwise
    // attribute pointsScored to whichever side is batting.
    let scoreAfter: { home: number; away: number } = scoreBefore;
    if (typeof play.score?.home === "number" && typeof play.score?.away === "number") {
      scoreAfter = { home: play.score.home, away: play.score.away };
    } else if (typeof play.homeScore === "number" && typeof play.awayScore === "number") {
      scoreAfter = { home: play.homeScore, away: play.awayScore };
    } else if (typeof play.pointsScored === "number" && play.pointsScored > 0) {
      const battingIsHome = half === "bottom";
      const battingIsAway = half === "top";
      const homeAdd = battingIsHome ? play.pointsScored : 0;
      const awayAdd = battingIsAway ? play.pointsScored : 0;
      if (play.scoringTeamAbbr && homeTeamAbbr) {
        if (play.scoringTeamAbbr === homeTeamAbbr) {
          scoreAfter = { home: scoreBefore.home + play.pointsScored, away: scoreBefore.away };
        } else {
          scoreAfter = { home: scoreBefore.home, away: scoreBefore.away + play.pointsScored };
        }
      } else {
        scoreAfter = { home: scoreBefore.home + homeAdd, away: scoreBefore.away + awayAdd };
      }
    }

    // Score is now known — compute the run delta first so we can
    // constrain runner advances against it (a heuristic prediction can't
    // contradict an authoritative score).
    const runsScored = Math.max(
      0,
      (scoreAfter.home - scoreBefore.home) + (scoreAfter.away - scoreBefore.away),
    );

    // Bases (occupancy). Trust upstream when present; otherwise forward-
    // propagate so "Clemens on 3rd" survives plays that don't ship runners.
    const upstreamBaseBefore = readBaseStateBeforeUpstream(enriched);
    const baseStateBefore = upstreamBaseBefore ?? { ...stateBases };
    const upstreamBaseAfter = readBaseStateAfterUpstream(enriched);
    const profile = classifyAnimationProfile(event, play.description ?? "");

    // Runner names: upstream first, then forward sim.
    const upstreamNamesBefore =
      readUpstreamRunnerNames(enriched.runnersBefore) ??
      readUpstreamRunnerNames(enriched.baseRunnersBefore) ??
      readUpstreamRunnerNames(enriched.runners) ??
      readUpstreamRunnerNames(enriched.runnersOn) ??
      readUpstreamRunnerNames(enriched.baseRunners) ??
      readUpstreamRunnerNames(enriched.bases);
    const runnerNamesBefore: RunnerNames = upstreamNamesBefore ?? { ...stateRunners };
    const batterName = readStr(enriched.batterName, enriched.batter, play.playerName);

    // Advances: when upstream gave us basesAfter, derive by DIFFING the
    // before/after pair (the most truthful path). Otherwise predict and
    // apply the run constraint so the prediction can't contradict
    // runsScored.
    const upstreamNamesAfter =
      readUpstreamRunnerNames(enriched.runnersAfter) ??
      readUpstreamRunnerNames(enriched.baseRunnersAfter);
    let predictedAdvances: RunnerAdvance[];
    if (upstreamBaseAfter) {
      predictedAdvances = diffAdvances(
        baseStateBefore,
        runnerNamesBefore,
        upstreamBaseAfter,
        upstreamNamesAfter ?? {},
        batterName,
        batterDestForEvent(event),
        runsScored,
      );
    } else {
      predictedAdvances = predictAdvances(baseStateBefore, event, profile);
    }
    // Description parsing — the upstream prose is the most authoritative
    // source ("Osuna scores. Nimmo out at 2nd. Duran to 1st."). Merge on
    // top so explicit per-name advances override event-type heuristics.
    const parsedAdvances = parseDescriptionAdvances(
      play.description ?? "",
      runnerNamesBefore,
      batterName,
    );
    predictedAdvances = mergeParsedAdvances(predictedAdvances, parsedAdvances);
    // Apply the run constraint regardless of source — even the diff path
    // can leave runs unaccounted for when names match imperfectly or
    // upstream basesAfter omits scored runners.
    predictedAdvances = applyRunConstraint(
      baseStateBefore,
      predictedAdvances,
      runsScored,
      event,
    );

    const baseStateAfter =
      upstreamBaseAfter ?? applyAdvances(baseStateBefore, predictedAdvances);

    const runnerNamesAfter: RunnerNames =
      upstreamNamesAfter ??
      applyRunnerNames(runnerNamesBefore, predictedAdvances, batterName);

    // Outs after: prefer upstream outsAfter; otherwise add the event delta.
    const upstreamOutsAfter = readNum(enriched.outsAfter);
    const outsAfter =
      typeof upstreamOutsAfter === "number"
        ? Math.min(3, upstreamOutsAfter)
        : Math.min(3, outsBefore + outsDeltaFor(event));
    const isScoringPlay = runsScored > 0;
    const leadingBefore = whoIsLeading(scoreBefore);
    const leadingAfter = whoIsLeading(scoreAfter);
    const isTyingPlay = isScoringPlay && leadingAfter === "tie" && leadingBefore !== "tie";
    const isLeadChangePlay =
      isScoringPlay &&
      leadingBefore !== leadingAfter &&
      leadingBefore !== "tie" &&
      leadingAfter !== "tie";
    const closeGame = Math.abs(scoreBefore.home - scoreBefore.away) <= 2;
    const isLateLeverage =
      inning >= LATE_LEVERAGE_INNING &&
      closeGame &&
      (isScoringPlay || event === "home_run" || event === "triple" || event === "walk" || event === "single" || event === "double");

    result.set(play.playIndex, {
      inning,
      half,
      outsBefore,
      outsAfter,
      scoreBefore,
      scoreAfter,
      baseStateBefore,
      baseStateAfter,
      runnerNamesBefore,
      runnerNamesAfter,
      advances: predictedAdvances,
      eventType: event,
      runsScored,
      isScoringPlay,
      isTyingPlay,
      isLeadChangePlay,
      isLateLeverage,
      halfFromUpstream: upstreamHalf !== null,
    });

    // Advance state for the next play.
    stateScore = scoreAfter;
    stateBases = baseStateAfter;
    stateRunners = runnerNamesAfter;
    outsInHalf = outsAfter;
    if (outsInHalf >= 3) {
      // Burnt the half — next play in the same inning rotates the half
      // and clears the bases.
      stateHalf = stateHalf === "top" ? "bottom" : "top";
      resetHalf();
    }
  }
  return result;
}

// ── Card construction (uses the timeline) ──────────────────

function readSituationBefore(
  play: PlayEntry & RawPlaySituation,
  fallbackOutsBefore: number,
  fallbackBaseBefore: BaseballBaseState,
): SituationBefore {
  const baseStateBefore =
    readBaseStateBeforeUpstream(play) ?? fallbackBaseBefore;
  const outs = readNum(play.outsBefore, play.outs) ?? fallbackOutsBefore;
  const balls = readNum(play.ballsBefore, play.balls, play.countBefore?.balls, play.count?.balls);
  const strikes = readNum(play.strikesBefore, play.strikes, play.countBefore?.strikes, play.count?.strikes);
  const batterName = readStr(play.batterName, play.batter, play.playerName);
  const pitcherName = readStr(play.pitcherName, play.pitcher);
  return { outs, balls, strikes, baseState: baseStateBefore, batterName, pitcherName };
}

export function toPlayCard(
  gameId: number,
  index: number,
  play: PlayEntry,
  timeline: TimelineEntry,
  opposingPitchers?: { home?: string | null; away?: string | null },
  pitcherSnapshot?: PitcherSnapshot,
): PlayCardData {
  const enriched = play as PlayEntry & RawPlaySituation;
  // Use the timeline's forward-propagated baseStateBefore so the card always
  // matches the running game state — even when upstream doesn't ship per-play
  // runner objects.
  const situationBefore = readSituationBefore(
    enriched,
    timeline.outsBefore,
    timeline.baseStateBefore,
  );
  // Pitcher of record. Reconstructed timeline (mlbPitchers walk) wins —
  // it knows the actual reliever sequence. Probable-pitcher fallback only
  // kicks in when we have no pitcher data at all.
  if (pitcherSnapshot) {
    situationBefore.pitcherName = pitcherSnapshot.name;
  } else if (!situationBefore.pitcherName && opposingPitchers) {
    const fallback =
      timeline.half === "top" ? opposingPitchers.home : opposingPitchers.away;
    if (fallback) situationBefore.pitcherName = fallback;
  }

  const ballPath = ballPathFromEvent(timeline.eventType, play.description ?? "");
  const animationProfile = classifyAnimationProfile(timeline.eventType, play.description ?? "");
  // Trust the timeline's reconciled advances — re-running predictAdvances
  // here would discard the run constraint and re-introduce "Grisham on
  // 3rd while Grisham scored" inconsistencies.
  const advances = timeline.advances;

  const card: PlayCardData = {
    kind: "play",
    gameId,
    cardId: `${gameId}-${play.playIndex}`,
    index,
    playIndex: play.playIndex,
    inning: timeline.inning,
    inningHalf: timeline.half,
    inningLabel: buildInningLabel(timeline.inning, timeline.half),
    battingTeamAbbr: play.teamAbbreviation,
    description: humanizeDescription(play.description || ""),
    scoreBefore: timeline.scoreBefore,
    scoreAfter: timeline.scoreAfter,
    situationBefore,
    outsAfter: timeline.outsAfter,
    baseStateAfter: timeline.baseStateAfter,
    runnerNamesBefore: timeline.runnerNamesBefore,
    runnerNamesAfter: timeline.runnerNamesAfter,
    runnerAdvances: advances,
    ballPath,
    eventType: timeline.eventType,
    animationProfile,
    visualIntensity: visualIntensity(timeline.eventType),
  };
  const narrative = narrativeForCard(card);
  if (narrative) card.narrative = narrative;
  return card;
}

export interface SceneSetterInput {
  game: Pick<
    GameSummary,
    "id" | "homeTeam" | "awayTeam" | "homeTeamAbbr" | "awayTeamAbbr" | "gameDate"
  >;
  homeProbablePitcher?: string | null;
  awayProbablePitcher?: string | null;
  venue?: string | null;
}

export function buildSceneSetter(input: SceneSetterInput): SceneSetterCard {
  const { game } = input;
  return {
    kind: "scene-setter",
    gameId: game.id,
    cardId: `${game.id}-scene`,
    index: 0,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    homeTeamAbbr: game.homeTeamAbbr ?? "HME",
    awayTeamAbbr: game.awayTeamAbbr ?? "AWY",
    firstPitch: game.gameDate,
    homeProbablePitcher: input.homeProbablePitcher ?? null,
    awayProbablePitcher: input.awayProbablePitcher ?? null,
    venue: input.venue ?? null,
  };
}

// ── Deterministic sampling ─────────────────────────────────

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function sampleTier2(
  pool: PlayEntry[],
  quota: number,
  gameId: number,
): PlayEntry[] {
  if (quota <= 0) return [];
  if (quota >= pool.length) return pool.slice();
  const rng = mulberry32(gameId);
  const indices = pool.map((_, i) => i);
  for (let i = indices.length - 1; i >= indices.length - quota; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const picked = indices.slice(indices.length - quota).sort((a, b) => a - b);
  return picked.map((i) => pool[i]);
}

// ── Selection (with audit) ─────────────────────────────────

interface SelectionOutput {
  selectedIds: Set<number>;
  reasons: Map<number, SelectionReason[]>;
}

function selectPlays(
  plays: PlayEntry[],
  timeline: Map<number, TimelineEntry>,
  gameId: number,
): SelectionOutput {
  const reasons = new Map<number, SelectionReason[]>();
  const addReason = (id: number, r: SelectionReason) => {
    const list = reasons.get(id) ?? [];
    if (!list.includes(r)) list.push(r);
    reasons.set(id, list);
  };

  // Pass 1 — must-include plays from timeline flags + tier 1.
  const must = new Set<number>();
  for (const play of plays) {
    const t = timeline.get(play.playIndex);
    if (!t) {
      addReason(play.playIndex, "missing-data");
      continue;
    }
    if (tierOf(play) === TIER1) {
      must.add(play.playIndex);
      addReason(play.playIndex, "tier-1");
    }
    if (t.isScoringPlay) {
      must.add(play.playIndex);
      addReason(play.playIndex, "scoring");
    }
    if (t.isTyingPlay) {
      must.add(play.playIndex);
      addReason(play.playIndex, "tying");
    }
    if (t.isLeadChangePlay) {
      must.add(play.playIndex);
      addReason(play.playIndex, "lead-change");
    }
    if (t.isLateLeverage) {
      must.add(play.playIndex);
      addReason(play.playIndex, "late-leverage");
    }
  }

  // Pass 2 — sample tier 2 from the remaining pool. The tier-2 quota
  // SCALES with the natural force-include count so the deck shape
  // reflects the game's actual energy:
  //   - boring (1-3 force-includes): minimal padding → ~5-7 cards
  //   - ordinary (5-9): moderate padding → ~8-13 cards
  //   - wild (10+): light padding, capped at HARD_MAX → 14-18 cards
  // Tier 1/flagged plays never get trimmed even if must.size > HARD_MAX.
  const optional = plays.filter(
    (p) => !must.has(p.playIndex) && tierOf(p) <= TIER2,
  );
  // 40% padding above the natural deck, with a floor of 2 samples for
  // sparse decks (so a 1-0 duel still has rhythm beyond the lone HR).
  const naturalPad = Math.max(2, Math.round(must.size * 0.4));
  const desired = Math.min(
    CATCHUP.HARD_MAX,
    Math.max(CATCHUP.SOFT_MIN, must.size + naturalPad),
  );
  const cap = Math.max(must.size, CATCHUP.HARD_MAX);
  const finalDesired = Math.min(desired, cap);
  const quota = Math.max(0, finalDesired - must.size);
  const sampled = sampleTier2(optional, quota, gameId);
  const sampledIds = new Set(sampled.map((p) => p.playIndex));

  for (const p of optional) {
    if (sampledIds.has(p.playIndex)) addReason(p.playIndex, "tier-2-sampled");
    else addReason(p.playIndex, "tier-2-not-sampled");
  }

  // Pass 3 — record reasons for plays that never had a chance.
  for (const p of plays) {
    if (must.has(p.playIndex) || sampledIds.has(p.playIndex)) continue;
    if (tierOf(p) > TIER2) addReason(p.playIndex, "tier-3-skipped");
    else if (!reasons.has(p.playIndex)) addReason(p.playIndex, "no-tier-not-sampled");
  }

  const selectedIds = new Set<number>([...must, ...sampledIds]);
  return { selectedIds, reasons };
}

// ── Build cards + audit ────────────────────────────────────

export interface BuildCardsInput extends SceneSetterInput {
  plays: PlayEntry[];
  /** Upstream `mlbPitchers` — per-game pitcher lines used to reconstruct
   *  pitcher of record per play. Optional; without it the matchup row
   *  falls back to probable-pitcher defaults. */
  mlbPitchers?: UpstreamPitcher[];
  sincePlayIndex?: number;
  isFinal: boolean;
  /** When true, returns the per-play audit table on the response. */
  withAudit?: boolean;
}

export function buildCatchupCards(input: BuildCardsInput): CatchupCardsResponse {
  const since = input.sincePlayIndex ?? -1;

  const timeline = computeTimeline(input.plays, input.game.homeTeamAbbr);
  const { selectedIds, reasons } = selectPlays(input.plays, timeline, input.game.id);

  const selectedPlays = input.plays
    .filter((p) => selectedIds.has(p.playIndex))
    .filter((p) => p.playIndex > since)
    .sort((a, b) => a.playIndex - b.playIndex);

  // 1. Build the play cards from selected plays.
  const probablePitchers = {
    home: input.homeProbablePitcher ?? null,
    away: input.awayProbablePitcher ?? null,
  };
  // Pitcher of record per play. Walks every play (not just the sampled
  // ones) so the cumulative-outs hand-off between relievers stays accurate
  // across the deck.
  const pitcherTimeline = computePitcherTimeline(
    input.plays,
    input.mlbPitchers,
    input.game.homeTeam,
    input.game.awayTeam,
    input.game.homeTeamAbbr,
  );
  const playCards: PlayCardData[] = [];
  for (const play of selectedPlays) {
    const t = timeline.get(play.playIndex);
    if (!t) continue;
    playCards.push(toPlayCard(
      input.game.id, 0, play, t, probablePitchers,
      pitcherTimeline.get(play.playIndex),
    ));
  }

  // 2. Hand off to the rhythm planner. It owns scene-setter placement,
  //    rhythm-card insertion, and priorAfter attachment.
  const halfInningMeta = summarizeHalfInnings(timeline.values());
  const cards = planDeck({
    scene: since < 0 ? buildSceneSetter(input) : null,
    playCards,
    halfInningMeta,
    homeTeamAbbr: input.game.homeTeamAbbr ?? "HME",
    awayTeamAbbr: input.game.awayTeamAbbr ?? "AWY",
  });

  const lastPlayIndex = input.plays.reduce(
    (max, p) => (p.playIndex > max ? p.playIndex : max),
    since,
  );

  const response: CatchupCardsResponse = {
    gameId: input.game.id,
    lastPlayIndex,
    isFinal: input.isFinal,
    cards,
  };

  if (input.withAudit) {
    response.audit = buildAudit(input.plays, timeline, selectedIds, reasons);
  }
  return response;
}

function buildAudit(
  plays: PlayEntry[],
  timeline: Map<number, TimelineEntry>,
  selectedIds: Set<number>,
  reasons: Map<number, SelectionReason[]>,
): SelectionAuditRow[] {
  const sorted = [...plays].sort((a, b) => a.playIndex - b.playIndex);
  return sorted.map((play) => {
    const t = timeline.get(play.playIndex);
    const enriched = play as PlayEntry & RawPlaySituation;
    return {
      playIndex: play.playIndex,
      inning: t?.inning ?? play.quarter ?? 0,
      half: t?.half ?? "unknown",
      outsBefore: t?.outsBefore ?? 0,
      outsAfter: t?.outsAfter ?? 0,
      scoreBefore: t?.scoreBefore ?? { home: 0, away: 0 },
      scoreAfter: t?.scoreAfter ?? { home: 0, away: 0 },
      runsScored: t?.runsScored ?? 0,
      baseStateBefore: t?.baseStateBefore ?? { first: false, second: false, third: false },
      baseStateAfter: t?.baseStateAfter ?? { first: false, second: false, third: false },
      eventType: t?.eventType ?? classifyEvent(play),
      description: (play.description || "").trim(),
      battingTeamAbbr: play.teamAbbreviation,
      batterName: readStr(enriched.batterName, enriched.batter, play.playerName),
      pitcherName: readStr(enriched.pitcherName, enriched.pitcher),
      tier: tierOf(play),
      isScoringPlay: t?.isScoringPlay ?? false,
      isTyingPlay: t?.isTyingPlay ?? false,
      isLeadChangePlay: t?.isLeadChangePlay ?? false,
      isLateLeverage: t?.isLateLeverage ?? false,
      isSelectedForCatchup: selectedIds.has(play.playIndex),
      selectionReasons: reasons.get(play.playIndex) ?? [],
    };
  });
}

// ── Validation ─────────────────────────────────────────────

export function isValidCard(card: CatchupCard): boolean {
  if (card.kind === "scene-setter") {
    return Boolean(card.gameId && card.homeTeam && card.awayTeam && card.firstPitch);
  }
  if (
    card.kind === "inning-transition" ||
    card.kind === "quiet-stretch" ||
    card.kind === "late-game" ||
    card.kind === "final-setup"
  ) {
    return Boolean(
      card.gameId &&
      typeof card.label === "string" &&
      card.label.length > 0 &&
      typeof card.score?.home === "number" &&
      typeof card.score?.away === "number" &&
      card.homeTeamAbbr &&
      card.awayTeamAbbr,
    );
  }
  if (card.kind !== "play") return false;
  return (
    typeof card.playIndex === "number" &&
    typeof card.scoreBefore?.home === "number" &&
    typeof card.scoreBefore?.away === "number" &&
    typeof card.scoreAfter?.home === "number" &&
    typeof card.scoreAfter?.away === "number" &&
    typeof card.outsAfter === "number" &&
    typeof card.description === "string" &&
    Boolean(card.situationBefore?.baseState) &&
    Boolean(card.baseStateAfter)
  );
}
