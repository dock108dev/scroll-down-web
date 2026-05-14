import { test as base, expect, type Page, type Route } from "@playwright/test";
import { addCoverageReport } from "monocart-reporter";
import type {
  SdmBaseMovement,
  SdmDeckCard,
  SdmDeckResponse,
  SdmHalfInningContainer,
  SdmPlayPayload,
  SdmRecentGame,
  SdmRecentResponse,
  SdmRevealResponse,
} from "../src/types/scroll-down-mlb";

const COLLECT_COVERAGE = process.env.SCROLLDOWN_E2E_COVERAGE === "1";

/**
 * Test fixture that auto-collects v8 JS coverage from the browser when
 * SCROLLDOWN_E2E_COVERAGE=1. Each test starts coverage on its `page`, runs,
 * then ships the entries to monocart-reporter for aggregation. Chromium-only.
 *
 * Coverage stays off by default (CI smoke runs without it; the daily job
 * doesn't need it either) — flip the env var in the dedicated coverage lane.
 */
export const test = base.extend<{ _coverage: void }>({
  _coverage: [
    async ({ page }, use, testInfo) => {
      if (COLLECT_COVERAGE && testInfo.project.name !== "setup") {
        await page.coverage.startJSCoverage({ resetOnNavigation: false });
      }
      await use();
      if (COLLECT_COVERAGE && testInfo.project.name !== "setup") {
        try {
          const entries = await page.coverage.stopJSCoverage();
          await addCoverageReport(entries, testInfo);
        } catch {
          // Coverage API requires Chromium. Mobile project also uses Chromium
          // under the hood, but if the page already closed, swallow it — the
          // test result is what matters, the coverage is bookkeeping.
        }
      }
    },
    { auto: true },
  ],
});
export { expect };

// ---------------------------------------------------------------------------
// Fixture builders — produce SDM wire shapes with sensible defaults.
// Overrides via `Partial<...>` so each test sets just the fields it cares about.
// ---------------------------------------------------------------------------

export const DEFAULT_GAME_ID = "190121";

export function makeRecentGame(overrides: Partial<SdmRecentGame> = {}): SdmRecentGame {
  return {
    gameId: DEFAULT_GAME_ID,
    league: "MLB",
    gameDate: "2026-05-03",
    status: "final",
    statusType: "final",
    awayTeam: {
      id: "1",
      abbreviation: "SF",
      displayName: "San Francisco Giants",
      colorLight: "#FD5A1E",
      colorDark: "#27251F",
    },
    homeTeam: {
      id: "2",
      abbreviation: "TB",
      displayName: "Tampa Bay Rays",
      colorLight: "#092C5C",
      colorDark: "#8FBCE6",
    },
    venueName: "Tropicana Field",
    startTime: "2026-05-03T17:40:00Z",
    hasDeck: true,
    deckVersion: "official-abc123",
    isFinal: true,
    ...overrides,
  };
}

export function makeRecentResponse(games: SdmRecentGame[] = [makeRecentGame()]): SdmRecentResponse {
  return { games };
}

export function makeScenePlay(overrides: Partial<SdmPlayPayload> = {}): SdmPlayPayload {
  return {
    playId: "10001",
    eventType: "single",
    label: "SINGLE",
    subLabel: null,
    description: "Leadoff single.",
    batterName: "Rafael Devers",
    pitcherName: "Springs",
    pitcherStatLine: null,
    ballsBefore: 0,
    strikesBefore: 0,
    outsBefore: 0,
    outsAfter: 0,
    baseStateBefore: { first: false, second: false, third: false },
    baseStateAfter: { first: true, second: false, third: false },
    runnerNamesBefore: {},
    runnerNamesAfter: { first: "Rafael Devers" },
    scoreBefore: { home: 0, away: 0 },
    runsScoredOnPlay: 0,
    ...overrides,
  };
}

export function makeSceneCard(): SdmDeckCard {
  return {
    id: `${DEFAULT_GAME_ID}-scene`,
    type: "scene",
    sortOrder: 0,
    title: "First pitch",
    description: "Giants at Rays.",
  };
}

export function makePlayCard(overrides: Partial<SdmDeckCard> = {}): SdmDeckCard {
  return {
    id: `${DEFAULT_GAME_ID}-10002`,
    type: "play",
    sortOrder: 1,
    inning: 1,
    half: "top",
    title: "Top 1st",
    description: "Schmitt singles home a run.",
    play: {
      playId: "10002",
      eventType: "single",
      label: "SINGLE",
      subLabel: "RUN SCORES",
      description: "Schmitt singles home a run.",
      batterName: "Casey Schmitt",
      pitcherName: null,
      pitcherStatLine: null,
      ballsBefore: 1,
      strikesBefore: 2,
      outsBefore: 1,
      outsAfter: 1,
      baseStateBefore: { first: false, second: false, third: true },
      baseStateAfter: { first: true, second: false, third: false },
      runnerNamesBefore: { third: "Rafael Devers" },
      runnerNamesAfter: { first: "Casey Schmitt" },
      scoreBefore: { home: 0, away: 0 },
      runsScoredOnPlay: 1,
    },
    visual: {
      trajectory: "fly_cf",
      intensity: "medium",
      animationProfile: "shallow_fly",
    },
    leverageTier: 1,
    ...overrides,
  };
}

export function makeRhythmCard(): SdmDeckCard {
  return {
    id: `${DEFAULT_GAME_ID}-rhythm`,
    type: "rhythm",
    sortOrder: 2,
    inning: 4,
    half: "top",
    title: "Innings 4-6",
    description: "Both pitchers in command.",
  };
}

export function makeFinalSetupCard(): SdmDeckCard {
  return {
    id: `${DEFAULT_GAME_ID}-final-setup`,
    type: "final_setup",
    sortOrder: 3,
    inning: 9,
    half: "bottom",
    title: "Final approach",
    description: "One out from the end.",
  };
}

export function makeDeckResponse(overrides: Partial<SdmDeckResponse> = {}): SdmDeckResponse {
  const cards = ensureUniquePlayIds(overrides.cards ?? [makeSceneCard(), makePlayCard()]);
  const halfInnings = "halfInnings" in overrides
    ? overrides.halfInnings
    : makeHalfInningsFromCards(cards);
  return {
    gameId: DEFAULT_GAME_ID,
    deckVersion: "official-abc123",
    generatedAt: "2026-05-03T20:13:52Z",
    isFinal: true,
    spoilerPolicy: "pre_reveal",
    homeTeam: {
      id: "2",
      abbreviation: "TB",
      displayName: "Tampa Bay Rays",
      colorLight: "#092C5C",
      colorDark: "#8FBCE6",
    },
    awayTeam: {
      id: "1",
      abbreviation: "SF",
      displayName: "San Francisco Giants",
      colorLight: "#FD5A1E",
      colorDark: "#27251F",
    },
    lastPlayIndex: 105074,
    firstPitch: "2026-05-03T17:40:00Z",
    venue: "Tropicana Field",
    homeProbablePitcher: null,
    awayProbablePitcher: null,
    plannerReport: { rhythm: [] },
    validationWarnings: [],
    ...overrides,
    cards,
    halfInnings,
  };
}

function ensureUniquePlayIds(cards: SdmDeckCard[]): SdmDeckCard[] {
  const seen = new Set<number>();
  return cards.map((card, i) => {
    if (card.type !== "play" || !card.play) return card;
    let playIndex = Number(card.play.playId);
    if (!Number.isFinite(playIndex)) playIndex = 10000 + i;
    while (seen.has(playIndex)) playIndex += 1;
    seen.add(playIndex);
    if (String(playIndex) === card.play.playId) return card;
    return {
      ...card,
      play: {
        ...card.play,
        playId: String(playIndex),
      },
    };
  });
}

function makeHalfInningsFromCards(cards: SdmDeckCard[]): SdmHalfInningContainer[] {
  const groups = new Map<string, SdmHalfInningContainer>();
  for (const card of cards) {
    if (card.type !== "play" || !card.play) continue;
    const inning = card.inning ?? 1;
    const half = card.half ?? "top";
    const key = `${inning}-${half}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        gameId: DEFAULT_GAME_ID,
        inning,
        half,
        battingTeam: half === "top"
          ? { id: "1", abbreviation: "SF", displayName: "San Francisco Giants", colorLight: null, colorDark: null }
          : { id: "2", abbreviation: "TB", displayName: "Tampa Bay Rays", colorLight: null, colorDark: null },
        fieldingTeam: half === "top"
          ? { id: "2", abbreviation: "TB", displayName: "Tampa Bay Rays", colorLight: null, colorDark: null }
          : { id: "1", abbreviation: "SF", displayName: "San Francisco Giants", colorLight: null, colorDark: null },
        events: [],
        meta: { scoredRuns: 0, hadActivity: true, hadLeadChange: false, hadTying: false },
        selectedPlayIndices: [],
      };
      groups.set(key, group);
    }
    const play = card.play;
    const scoreChange = scoreChangeForPlay(play, half);
    group.meta.scoredRuns += scoreChange.home + scoreChange.away;
    group.selectedPlayIndices.push(Number(play.playId));
    group.events.push({
      sequence: group.events.length + 1,
      playIndex: Number(play.playId),
      eventType: play.eventType,
      outsBefore: play.outsBefore,
      outsAfter: play.outsAfter,
      baseStateBefore: play.baseStateBefore,
      baseStateAfter: play.baseStateAfter,
      scoreBefore: play.scoreBefore,
      runsScoredOnPlay: play.runsScoredOnPlay,
      scoreChange,
      movements: movementsForPlay(play),
      revealType: "plate_appearance",
      result: {
        label: play.label ?? "PLAY",
        description: play.description ?? "",
        eventType: play.eventType,
        isOut: (play.outsAfter ?? 0) > (play.outsBefore ?? 0),
        isStrikeout: play.eventType === "strikeout",
        isWalk: play.eventType === "walk",
        isHit: play.eventType === "single" || play.eventType === "double" || play.eventType === "triple" || play.eventType === "home_run",
        isScoringPlay: play.runsScoredOnPlay > 0,
        isInningEnding: play.outsAfter === 3,
      },
      matchup: {
        batter: play.batterName ? { id: playerId(play.batterName), name: play.batterName } : null,
        pitcher: play.pitcherName ? { id: playerId(play.pitcherName), name: play.pitcherName } : null,
      },
      isSelected: true,
    });
  }
  return [...groups.values()];
}

type Base = "first" | "second" | "third";

function movementsForPlay(play: SdmPlayPayload): SdmBaseMovement[] {
  const before = play.baseStateBefore ?? { first: false, second: false, third: false };
  const after = play.baseStateAfter ?? { first: false, second: false, third: false };
  const beforeNames = play.runnerNamesBefore ?? {};
  const afterNames = play.runnerNamesAfter ?? {};
  const bases: Base[] = ["first", "second", "third"];
  const out: SdmBaseMovement[] = [];
  const usedAfter = new Set<Base>();
  let runsRemaining = play.runsScoredOnPlay;

  for (const from of bases) {
    if (!before[from]) continue;
    const name = beforeNames[from] ?? `Unknown ${from}`;
    const to = bases.find((base) => after[base] && afterNames[base] === name);
    if (to) {
      usedAfter.add(to);
      if (to !== from) out.push(baseMovement(name, from, to));
      continue;
    }
    if (runsRemaining > 0) {
      runsRemaining -= 1;
      out.push(baseMovement(name, from, "home"));
    } else if (!after[from]) {
      out.push(baseMovement(name, from, "out", from));
    }
  }

  for (const to of bases) {
    if (!after[to] || usedAfter.has(to)) continue;
    const name = afterNames[to] ?? play.batterName ?? `Unknown ${to}`;
    out.push(baseMovement(name, "home", to));
  }

  if (play.eventType === "home_run" && play.batterName) {
    out.push(baseMovement(play.batterName, "home", "home"));
  }

  return out;
}

function baseMovement(
  name: string,
  from: SdmBaseMovement["from"],
  to: SdmBaseMovement["to"],
  outAt?: SdmBaseMovement["outAt"],
): SdmBaseMovement {
  return {
    runner: { id: playerId(name), name },
    from,
    to,
    style: to === "out" ? "out" : to === "home" ? "score" : "advance",
    outAt: outAt ?? null,
  };
}

function scoreChangeForPlay(play: SdmPlayPayload, half: "top" | "bottom") {
  if (play.scoreChange) return play.scoreChange;
  const runs = Math.max(0, play.runsScoredOnPlay);
  return half === "bottom" ? { home: runs, away: 0 } : { home: 0, away: runs };
}

function playerId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function makeRevealResponse(overrides: Partial<SdmRevealResponse> = {}): SdmRevealResponse {
  return {
    gameId: DEFAULT_GAME_ID,
    finalScore: { home: 2, away: 1 },
    winnerTeamId: "2",
    summary: "Tampa Bay Rays beat San Francisco Giants, 2–1.",
    keyStats: [],
    gameFlow: [],
    generatedAt: "2026-05-03T20:30:00Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Route mocking helpers
// ---------------------------------------------------------------------------

interface MockOpts {
  recent?: SdmRecentResponse | { status: number; body?: unknown };
  deck?: SdmDeckResponse | { status: number; body?: unknown } | ((callCount: number) => SdmDeckResponse);
  reveal?: SdmRevealResponse | { status: number; body?: unknown };
}

async function fulfillJson(route: Route, status: number, body: unknown): Promise<void> {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body ?? {}),
  });
}

/**
 * Mock /api/games/recent + /api/games/[id]/cards + /api/games/[id]/summary
 * with the supplied payloads. Pass `{status, body}` to simulate errors.
 * Pass a function for `deck` to return a different payload per call (live polling).
 */
export async function mockSdmRoutes(page: Page, opts: MockOpts = {}): Promise<void> {
  if (opts.recent !== undefined) {
    await page.route("**/api/games/recent", async (route) => {
      const v = opts.recent!;
      if ("status" in v && typeof v.status === "number") {
        await fulfillJson(route, v.status, v.body ?? { error: "mock error" });
      } else {
        await fulfillJson(route, 200, v);
      }
    });
  }

  if (opts.deck !== undefined) {
    let callCount = 0;
    await page.route(/\/api\/games\/[^/]+\/cards/, async (route) => {
      callCount += 1;
      const v = opts.deck!;
      if (typeof v === "function") {
        await fulfillJson(route, 200, v(callCount));
        return;
      }
      if ("status" in v && typeof v.status === "number" && !("deckVersion" in v)) {
        await fulfillJson(route, v.status, (v as { body?: unknown }).body ?? { error: "mock error" });
      } else {
        await fulfillJson(route, 200, v);
      }
    });
  }

  if (opts.reveal !== undefined) {
    await page.route(/\/api\/games\/[^/]+\/summary/, async (route) => {
      const v = opts.reveal!;
      if ("status" in v && typeof v.status === "number" && !("finalScore" in v)) {
        await fulfillJson(route, v.status, (v as { body?: unknown }).body ?? { error: "mock error" });
      } else {
        await fulfillJson(route, 200, v);
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Storage seeding — must run before navigation so the persisted store starts
// hydrated rather than fetching a default and reflowing.
// ---------------------------------------------------------------------------

/**
 * Seed the Zustand onboarding store via localStorage before the app boots.
 * Use this to skip the FirstVisitGate overlay in tests that don't need it.
 */
export async function seedOnboarding(
  page: Page,
  state: { onboarded?: boolean; favoriteTeam?: string | null } = { onboarded: true, favoriteTeam: null },
): Promise<void> {
  await page.addInitScript((s) => {
    const payload = {
      state: {
        onboarded: s.onboarded ?? true,
        favoriteTeam: s.favoriteTeam ?? null,
      },
      version: 1,
    };
    localStorage.setItem("sd-onboarding", JSON.stringify(payload));
  }, state);
}

interface CatchupSeedEntry {
  cardIndex?: number;
  completed?: boolean;
  lastSeenPlayIndex?: number;
  updatedAt?: number;
}

export async function seedCatchupProgress(
  page: Page,
  entries: Record<string, CatchupSeedEntry>,
): Promise<void> {
  await page.addInitScript((e) => {
    const expanded: Record<string, unknown> = {};
    for (const [id, v] of Object.entries(e)) {
      expanded[id] = {
        cardIndex: v.cardIndex ?? 0,
        completed: v.completed ?? false,
        lastSeenPlayIndex: v.lastSeenPlayIndex ?? -1,
        updatedAt: v.updatedAt ?? Date.now(),
      };
    }
    const payload = {
      state: { entries: expanded },
      version: 1,
    };
    localStorage.setItem("sd-catchup-state", JSON.stringify(payload));
  }, entries);
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** Returns the visible innerText of <body>. Convenience for spoiler assertions. */
export async function bodyText(page: Page): Promise<string> {
  return page.locator("body").innerText();
}

/**
 * Stub `window.confirm` to a fixed answer before any code runs. Required
 * because Playwright's `page.on("dialog")` is for actual native dialogs;
 * the catchup-experience uses synchronous `window.confirm`, which Playwright
 * auto-dismisses (returning false). We override the function so we can
 * assert flows that need the user to "agree".
 */
export async function stubConfirm(page: Page, response: boolean): Promise<void> {
  await page.addInitScript((r) => {
    window.confirm = () => r;
  }, response);
}
