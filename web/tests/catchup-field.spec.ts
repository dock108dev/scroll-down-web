import {
  test,
  expect,
  DEFAULT_GAME_ID,
  makeDeckResponse,
  makePlayCard,
  makeRecentResponse,
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
    // Default fixture has runners on 3rd before, 1st after — at least one
    // base-bulb per occupied state shows up. Bulbs are only rendered for
    // bases that are/were/will-be occupied (BaseballLightField.tsx).
    const bulbs = card.locator("[data-testid='base-bulb']");
    expect(await bulbs.count()).toBeGreaterThanOrEqual(2);
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

    // Third base: empty before, occupied after → lifecycle="arrive".
    const thirdBulb = reachCard.locator("[data-testid='base-bulb'][data-base='third']");
    await expect(thirdBulb).toHaveAttribute("data-lifecycle", "arrive");

    // Runner label for Edwards on first should be present pre-play.
    const firstLabel = reachCard.locator("text.field-base-label[data-base='first']");
    await expect(firstLabel).toHaveText("EDWARDS");
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
