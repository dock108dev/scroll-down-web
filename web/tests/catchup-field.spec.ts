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
