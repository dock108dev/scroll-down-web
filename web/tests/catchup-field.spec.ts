import {
  test,
  expect,
  DEFAULT_GAME_ID,
  makeDeckResponse,
  makePlayCard,
  makeRecentResponse,
  makeRhythmCard,
  makeSceneCard,
  mockSdmRoutes,
  seedOnboarding,
} from "./helpers";

test.describe("@smoke field rendering", () => {
  test.beforeEach(async ({ page }) => {
    await seedOnboarding(page, { onboarded: true, favoriteTeam: null });
  });

  test("scene setter renders its slide testid", async ({ page }) => {
    await mockSdmRoutes(page, { recent: makeRecentResponse(), deck: makeDeckResponse() });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);
    await expect(page.locator("[data-testid='catchup-scene-setter']")).toBeVisible();
  });

  test("play card renders inning-state, score-display, and outs-state", async ({ page }) => {
    await mockSdmRoutes(page, { recent: makeRecentResponse(), deck: makeDeckResponse() });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);
    const card = page.locator("[data-testid='play-card']").first();
    await expect(card).toBeVisible();
    await expect(card.locator("[data-testid='inning-state']")).toBeVisible();
    await expect(card.locator("[data-testid='score-display']")).toBeVisible();
    await expect(card.locator("[data-testid='outs-state']")).toBeVisible();
  });

  test("pitcher-stat-line is shown when the play carries one, hidden otherwise", async ({ page }) => {
    const withPitcher = makePlayCard({
      id: `${DEFAULT_GAME_ID}-with-pitcher`,
      sortOrder: 1,
      play: {
        ...makePlayCard().play!,
        pitcherName: "Springs",
        pitcherStatLine: "4.1 IP · 6 K · 1 BB · 2 R",
      },
    });
    const withoutPitcher = makePlayCard({
      id: `${DEFAULT_GAME_ID}-no-pitcher`,
      sortOrder: 2,
      inning: 2,
      half: "top",
      play: {
        ...makePlayCard().play!,
        pitcherName: null,
        pitcherStatLine: null,
      },
    });
    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse({ cards: [makeSceneCard(), withPitcher, withoutPitcher] }),
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);

    const cards = page.locator("[data-testid='play-card']");
    await expect(cards.first()).toBeVisible();
    // Scroll to the first play and check pitcher stat line is shown.
    await cards.first().scrollIntoViewIfNeeded();
    await expect(cards.first().locator("[data-testid='pitcher-stat-line']")).toHaveCount(1);
    // Second play has no pitcher line.
    await cards.nth(1).scrollIntoViewIfNeeded();
    await expect(cards.nth(1).locator("[data-testid='pitcher-stat-line']")).toHaveCount(0);
  });

  test("baseball-field renders, with a base-bulb for each occupied base", async ({ page }) => {
    await mockSdmRoutes(page, { recent: makeRecentResponse(), deck: makeDeckResponse() });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);
    const card = page.locator("[data-testid='play-card']").first();
    await expect(card).toBeVisible();
    await expect(card.locator("[data-testid='baseball-field']")).toBeVisible();
    // Preview is spoiler-safe: the default fixture has a runner on 3rd
    // before and a runner on 1st after, but only the before-state bulb
    // should exist before the user reveals the pitch.
    const bulbs = card.locator("[data-testid='base-bulb']");
    await expect(bulbs).toHaveCount(1);
    await expect(bulbs.first()).toHaveAttribute("data-base", "third");
  });

  test("preview state hides result, after-score, after-outs, narration, and runner advancement", async ({ page }) => {
    const scoring = makePlayCard({
      id: `${DEFAULT_GAME_ID}-spoiler-safe-preview`,
      sortOrder: 1,
      inning: 7,
      half: "top",
      play: {
        ...makePlayCard().play!,
        eventType: "single",
        label: "SINGLE",
        subLabel: "RUN SCORES",
        description: "Casey Schmitt singles home a run.",
        ballsBefore: 1,
        strikesBefore: 2,
        outsBefore: 1,
        outsAfter: 2,
        baseStateBefore: { first: false, second: false, third: true },
        baseStateAfter: { first: true, second: false, third: false },
        runnerNamesBefore: { third: "Devers" },
        runnerNamesAfter: { first: "Schmitt" },
        scoreBefore: { home: 0, away: 0 },
        runsScoredOnPlay: 1,
      },
      visual: {
        trajectory: "line_center",
        runnerMovements: [
          { runner: "Devers", from: "third", to: "home", style: "score" },
          { runner: "Schmitt", from: "home", to: "first", style: "advance" },
        ],
        intensity: "medium",
        animationProfile: "line_drive",
      },
    });

    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse({ cards: [makeSceneCard(), scoring] }),
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);

    const card = page.locator("[data-testid='play-card']").first();
    await expect(card).toHaveAttribute("data-reveal-state", "preview");
    await expect(card).toHaveAttribute("data-event-type", "hidden");
    await expect(card.locator("[data-testid='preview-reveal-control']")).toBeVisible();
    await expect(card.locator("[data-testid='result-badge']")).toHaveCount(0);
    await expect(card.locator("[data-testid='play-narration-panel']")).toHaveCount(0);
    await expect(card.locator("[data-testid='score-away']")).toHaveText("0");
    await expect(card.locator("[data-testid='outs-state']")).toHaveAttribute("data-outs-after", "1");
    await expect(card.locator("[data-testid='base-bulb']")).toHaveCount(1);
    await expect(card.locator("[data-testid='base-bulb']").first()).toHaveAttribute("data-base", "third");
    await expect(card.locator("[data-testid='runner-marker']")).toHaveCount(0);
  });

  test("revealing a scoring play stages result text, score, outs, and runners after the CTA", async ({ page }) => {
    const scoring = makePlayCard({
      id: `${DEFAULT_GAME_ID}-spoiler-safe-reveal`,
      sortOrder: 1,
      inning: 7,
      half: "top",
      play: {
        ...makePlayCard().play!,
        eventType: "single",
        label: "SINGLE",
        subLabel: "RUN SCORES",
        description: "Casey Schmitt singles home a run.",
        ballsBefore: 1,
        strikesBefore: 2,
        outsBefore: 1,
        outsAfter: 2,
        baseStateBefore: { first: false, second: false, third: true },
        baseStateAfter: { first: true, second: false, third: false },
        runnerNamesBefore: { third: "Devers" },
        runnerNamesAfter: { first: "Schmitt" },
        scoreBefore: { home: 0, away: 0 },
        runsScoredOnPlay: 1,
      },
      visual: {
        trajectory: "line_center",
        runnerMovements: [
          { runner: "Devers", from: "third", to: "home", style: "score" },
          { runner: "Schmitt", from: "home", to: "first", style: "advance" },
        ],
        intensity: "medium",
        animationProfile: "line_drive",
      },
    });

    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse({ cards: [makeSceneCard(), scoring] }),
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);

    const card = page.locator("[data-testid='play-card']").first();
    await card.getByRole("button", { name: /reveal pitch/i }).click();
    await expect(card).toHaveAttribute("data-reveal-state", "revealing");
    await expect(card).toHaveAttribute("data-event-type", "single");
    await expect(card.locator("[data-testid='result-badge']")).toBeVisible();
    await expect(card.locator("[data-testid='score-away']")).toHaveText("1");
    await expect(card.locator("[data-testid='outs-state']")).toHaveAttribute("data-outs-after", "2");
    await expect(card.locator("[data-testid='play-narration-panel']")).toHaveAttribute("data-visible", "true");
    await expect(card.locator("[data-testid='run-scored']")).toHaveCount(1);
  });

  test("walk and strikeout previews do not leak base or out changes", async ({ page }) => {
    const walk = makePlayCard({
      id: `${DEFAULT_GAME_ID}-preview-walk`,
      sortOrder: 1,
      play: {
        ...makePlayCard().play!,
        eventType: "walk",
        label: "WALK",
        subLabel: null,
        description: "Xavier Edwards walks.",
        ballsBefore: 3,
        strikesBefore: 1,
        outsBefore: 0,
        outsAfter: 0,
        baseStateBefore: { first: false, second: false, third: false },
        baseStateAfter: { first: true, second: false, third: false },
        runnerNamesBefore: {},
        runnerNamesAfter: { first: "Xavier Edwards" },
        runsScoredOnPlay: 0,
      },
      visual: {
        trajectory: "pitch",
        runnerMovements: [{ runner: "Xavier Edwards", from: "home", to: "first", style: "advance" }],
        intensity: "low",
        animationProfile: "walk",
      },
    });
    const strikeout = makePlayCard({
      id: `${DEFAULT_GAME_ID}-preview-strikeout`,
      sortOrder: 2,
      inning: 1,
      half: "top",
      play: {
        ...makePlayCard().play!,
        eventType: "strikeout",
        label: "STRIKEOUT",
        subLabel: "SWINGING",
        description: "Mitchell strikes out swinging.",
        ballsBefore: 1,
        strikesBefore: 2,
        outsBefore: 1,
        outsAfter: 2,
        baseStateBefore: { first: false, second: false, third: false },
        baseStateAfter: { first: false, second: false, third: false },
        runnerNamesBefore: {},
        runnerNamesAfter: {},
        runsScoredOnPlay: 0,
      },
      visual: {
        trajectory: "pitch",
        runnerMovements: [],
        intensity: "low",
        animationProfile: "strikeout",
      },
    });

    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse({ cards: [makeSceneCard(), walk, strikeout] }),
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);

    const cards = page.locator("[data-testid='play-card']");
    await expect(cards.first().locator("[data-testid='base-bulb']")).toHaveCount(0);
    await expect(cards.first().locator("[data-testid='outs-state']")).toHaveAttribute("data-outs-after", "0");

    const scroller = page.locator("[data-testid='catchup-scroller']");
    await scroller.evaluate((el) => {
      const child = el.children[2] as HTMLElement | undefined;
      if (child) child.scrollIntoView({ behavior: "instant", block: "start" });
    });

    await expect(cards.nth(1)).toHaveAttribute("data-reveal-state", "preview");
    await expect(cards.nth(1).locator("[data-testid='outs-state']")).toHaveAttribute("data-outs-after", "1");
    await expect(cards.nth(1).locator("[data-testid='result-badge']")).toHaveCount(0);
  });

  test("bases-loaded and empty-base preview fixtures render deterministic situations", async ({ page }) => {
    const basesLoaded = makePlayCard({
      id: `${DEFAULT_GAME_ID}-bases-loaded`,
      sortOrder: 1,
      play: {
        ...makePlayCard().play!,
        eventType: "double_play",
        label: "DOUBLE PLAY",
        description: "Ground ball with the bases loaded.",
        outsBefore: 0,
        outsAfter: 2,
        baseStateBefore: { first: true, second: true, third: true },
        baseStateAfter: { first: false, second: false, third: true },
        runnerNamesBefore: { first: "Flores", second: "Lee", third: "Devers" },
        runnerNamesAfter: { third: "Devers" },
        runsScoredOnPlay: 0,
      },
      visual: {
        trajectory: "ground_ss",
        runnerMovements: [],
        intensity: "medium",
        animationProfile: "double_play_grounder",
      },
    });
    const emptyBases = makePlayCard({
      id: `${DEFAULT_GAME_ID}-empty-bases`,
      sortOrder: 2,
      inning: 2,
      half: "bottom",
      play: {
        ...makePlayCard().play!,
        eventType: "field_out",
        label: "GROUNDOUT",
        description: "Routine groundout.",
        outsBefore: 2,
        outsAfter: 3,
        baseStateBefore: { first: false, second: false, third: false },
        baseStateAfter: { first: false, second: false, third: false },
        runnerNamesBefore: {},
        runnerNamesAfter: {},
        runsScoredOnPlay: 0,
      },
      visual: {
        trajectory: "ground_2b",
        runnerMovements: [],
        intensity: "low",
        animationProfile: "routine_grounder",
      },
    });

    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse({ cards: [makeSceneCard(), basesLoaded, emptyBases] }),
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);

    const cards = page.locator("[data-testid='play-card']");
    await expect(cards.first().locator("[data-testid='base-bulb']")).toHaveCount(3);

    const scroller = page.locator("[data-testid='catchup-scroller']");
    await scroller.evaluate((el) => {
      const child = el.children[2] as HTMLElement | undefined;
      if (child) child.scrollIntoView({ behavior: "instant", block: "start" });
    });

    await expect(cards.nth(1).locator("[data-testid='base-bulb']")).toHaveCount(0);
    await expect(cards.nth(1).locator("[data-testid='preview-reveal-control']")).toBeVisible();
  });

  test("on-base runner is visible on first-paint of the next at-bat (screenshot-bug repro)", async ({ page }) => {
    // The bug from IMG_0072–IMG_0077: a walk puts a runner on first, then
    // the next at-bat shows an empty diamond through pitch/ball. After the
    // BaseBulb lifecycle rewrite, a base whose state is the same entering
    // and leaving the play maps to lifecycle="hold" with static opacity:1.
    const walk = makePlayCard({
      id: `${DEFAULT_GAME_ID}-walk`,
      sortOrder: 1,
      inning: 1,
      half: "top",
      play: {
        ...makePlayCard().play!,
        eventType: "walk",
        label: "WALK",
        subLabel: null,
        batterName: "Xavier Edwards",
        baseStateBefore: { first: false, second: false, third: false },
        baseStateAfter:  { first: true,  second: false, third: false },
        runnerNamesBefore: {},
        runnerNamesAfter:  { first: "Xavier Edwards" },
        runsScoredOnPlay: 0,
      },
      visual: {
        trajectory: "pitch",
        runnerMovements: [],
        intensity: "low",
        animationProfile: "walk",
      },
    });
    const reach = makePlayCard({
      id: `${DEFAULT_GAME_ID}-reach`,
      sortOrder: 2,
      inning: 1,
      half: "top",
      play: {
        ...makePlayCard().play!,
        eventType: "error",
        label: "REACHED ON ERROR",
        subLabel: null,
        batterName: "Liam Hicks",
        baseStateBefore: { first: true,  second: false, third: false },
        baseStateAfter:  { first: true,  second: false, third: true  },
        runnerNamesBefore: { first: "Xavier Edwards" },
        runnerNamesAfter:  { first: "Liam Hicks", third: "Xavier Edwards" },
        runsScoredOnPlay: 0,
      },
      visual: {
        trajectory: "ground_3b",
        runnerMovements: [],
        intensity: "medium",
        animationProfile: "routine_grounder",
      },
    });

    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse({ cards: [makeSceneCard(), walk, reach] }),
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);

    // Scroll to the reach-on-error card (the second at-bat).
    const scroller = page.locator("[data-testid='catchup-scroller']");
    await scroller.evaluate((el) => {
      const child = el.children[2] as HTMLElement | undefined;
      if (child) child.scrollIntoView({ behavior: "instant", block: "start" });
    });

    const reachCard = page.locator("[data-testid='play-card']").nth(1);
    await expect(reachCard).toBeVisible();

    // First base: occupied before AND after → lifecycle="hold".
    const firstBulb = reachCard.locator("[data-testid='base-bulb'][data-base='first']");
    await expect(firstBulb).toHaveAttribute("data-lifecycle", "hold");
    // Bulb must be visible from first paint — the bug was opacity:0 here.
    const firstAccentOpacity = await firstBulb.evaluate((g) => {
      const inner = g.querySelector("circle:nth-child(2)") as SVGElement | null;
      return inner ? Number(window.getComputedStyle(inner).opacity) : 0;
    });
    expect(firstAccentOpacity).toBeGreaterThanOrEqual(0.9);

    // Third base is an after-state only, so it must not exist before reveal.
    const thirdBulb = reachCard.locator("[data-testid='base-bulb'][data-base='third']");
    await expect(thirdBulb).toHaveCount(0);

    // Runner label for Edwards on first should be present pre-play.
    const firstLabel = reachCard.locator("text.field-base-label[data-base='first']");
    await expect(firstLabel).toHaveText("EDWARDS");

    await reachCard.getByRole("button", { name: /reveal pitch/i }).click();
    await expect(thirdBulb).toHaveAttribute("data-lifecycle", "arrive");
  });

  test("rhythm card after a scoring play carries the post-play score forward (BRAINDUMP §1)", async ({ page }) => {
    // The documented regression: a HR makes it 1-0, but the next breath
    // card resets to 0-0. The deck adapter threads `lastKnownScore` onto
    // every rhythm card; this test exercises the wire all the way through
    // the renderer so a future refactor can't quietly drop it.
    const hr = makePlayCard({
      id: `${DEFAULT_GAME_ID}-hr`,
      sortOrder: 1,
      inning: 1,
      half: "top",
      play: {
        ...makePlayCard().play!,
        eventType: "home_run",
        label: "HOME RUN",
        baseStateBefore: { first: false, second: false, third: false },
        baseStateAfter:  { first: false, second: false, third: false },
        runnerNamesBefore: {},
        runnerNamesAfter:  {},
        scoreBefore: { home: 0, away: 0 },
        runsScoredOnPlay: 1,
      },
      visual: {
        trajectory: "home_run_center",
        runnerMovements: [],
        intensity: "high",
        animationProfile: "home_run",
      },
    });
    const breath = makeRhythmCard();
    breath.sortOrder = 2;

    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse({ cards: [makeSceneCard(), hr, breath] }),
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);

    // Scroll past the scoring play to the rhythm card.
    const scroller = page.locator("[data-testid='catchup-scroller']");
    await scroller.evaluate((el) => {
      const child = el.children[2] as HTMLElement | undefined;
      if (child) child.scrollIntoView({ behavior: "instant", block: "start" });
    });

    // Generic "rhythm" wire type maps to quiet-stretch in the adapter
    // (lib/adapters/scroll-down-mlb-deck-adapter.ts) when no kind suffix
    // is embedded in the card id.
    const rhythm = page.locator("[data-testid='quiet-stretch-card']");
    await expect(rhythm).toBeVisible();
    // SF scored 1, TB still 0. The scoreboard MUST reflect the carried score.
    const scoreNums = rhythm.locator(".rhythm-card-score-num");
    await expect(scoreNums.nth(0)).toHaveText("1"); // away (SF)
    await expect(scoreNums.nth(1)).toHaveText("0"); // home (TB)
  });

  test("walks the major animation profiles: home_run, walk, strikeout, double_play, ground", async ({ page }) => {
    // Each profile exercises a different branch in BaseballLightField (ball
    // trajectory, fade timing, runner-style mapping) — covering them on the
    // same deck keeps the rendering paths under test in one shot.
    const profiles: Array<{
      id: string;
      eventType: string;
      profile: string;
      trajectory: string;
      runs: number;
    }> = [
      { id: "p-hr", eventType: "home_run", profile: "home_run", trajectory: "home_run_center", runs: 1 },
      { id: "p-walk", eventType: "walk", profile: "walk", trajectory: "pitch", runs: 0 },
      { id: "p-so", eventType: "strikeout", profile: "strikeout", trajectory: "pitch", runs: 0 },
      { id: "p-dp", eventType: "double_play", profile: "double_play_grounder", trajectory: "ground_ss", runs: 0 },
      { id: "p-ground", eventType: "field_out", profile: "routine_grounder", trajectory: "ground_3b", runs: 0 },
    ];

    const playCards = profiles.map((p, i) =>
      makePlayCard({
        id: `${DEFAULT_GAME_ID}-${p.id}`,
        sortOrder: i + 1,
        inning: i + 1,
        half: i % 2 === 0 ? "top" : "bottom",
        play: {
          ...makePlayCard().play!,
          eventType: p.eventType,
          runsScoredOnPlay: p.runs,
        },
        visual: {
          trajectory: p.trajectory,
          runnerMovements: [],
          intensity: "medium",
          animationProfile: p.profile,
        },
      }),
    );

    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse({ cards: [makeSceneCard(), ...playCards] }),
    });

    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);

    // Scroll through each card so its field activates (the renderer only
    // schedules SMIL when isActive=true, which happens when the card is the
    // current slide).
    const scroller = page.locator("[data-testid='catchup-scroller']");
    const slideCount = profiles.length + 1; // scene + plays
    for (let i = 0; i < slideCount; i++) {
      await scroller.evaluate((el, idx) => {
        const child = el.children[idx] as HTMLElement | undefined;
        if (child) child.scrollIntoView({ behavior: "instant", block: "start" });
      }, i);
      // Just confirm the field renders for each — no need to wait long.
      await expect(page.locator("[data-testid='baseball-field']").first()).toBeVisible();
    }
  });
});
