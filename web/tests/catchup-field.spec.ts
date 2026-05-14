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
        runnerNamesBefore: { third: "Rafael Devers" },
        runnerNamesAfter: { first: "Casey Schmitt" },
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
    await expect(card.locator("[data-testid='base-runner-label'][data-base='third']")).toHaveAttribute("data-runner", "R DEVERS");
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
        runnerNamesBefore: { third: "Rafael Devers" },
        runnerNamesAfter: { first: "Casey Schmitt" },
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
    await expect(card.locator("[data-testid='base-bulb'][data-base='first']")).toHaveCount(1);
    await expect(card.locator("[data-testid='base-runner-label'][data-base='first']")).toHaveAttribute("data-runner", "C SCHMITT");
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

  test("revealed result state does not bleed into the next preview", async ({ page }) => {
    const walk = makePlayCard({
      id: `${DEFAULT_GAME_ID}-stale-walk`,
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
        runnerMovements: [{ runner: "Xavier Edwards", from: "home", to: "first", style: "walk_shuffle" }],
        intensity: "low",
        animationProfile: "walk",
      },
    });
    const single = makePlayCard({
      id: `${DEFAULT_GAME_ID}-stale-single`,
      sortOrder: 2,
      play: {
        ...makePlayCard().play!,
        eventType: "single",
        label: "SINGLE",
        subLabel: null,
        description: "A clean single follows.",
        ballsBefore: 0,
        strikesBefore: 0,
        outsBefore: 0,
        outsAfter: 0,
        baseStateBefore: { first: true, second: false, third: false },
        baseStateAfter: { first: true, second: true, third: false },
        runnerNamesBefore: { first: "Xavier Edwards" },
        runnerNamesAfter: { first: "Casey Schmitt", second: "Xavier Edwards" },
        runsScoredOnPlay: 0,
      },
      visual: {
        trajectory: "line_right",
        runnerMovements: [
          { runner: "Xavier Edwards", from: "first", to: "second", style: "advance" },
          { runner: "Casey Schmitt", from: "home", to: "first", style: "advance" },
        ],
        intensity: "medium",
        animationProfile: "line_drive",
      },
    });

    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse({ cards: [makeSceneCard(), walk, single] }),
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);

    const scroller = page.locator("[data-testid='catchup-scroller']");
    await scroller.evaluate((el) => {
      const child = el.children[1] as HTMLElement | undefined;
      if (child) child.scrollIntoView({ behavior: "instant", block: "start" });
    });

    const cards = page.locator("[data-testid='play-card']");
    await cards.first().getByRole("button", { name: /reveal pitch/i }).click();
    await expect(cards.first().locator("[data-testid='result-badge']")).toContainText("WALK");

    await scroller.evaluate((el) => {
      const child = el.children[2] as HTMLElement | undefined;
      if (child) child.scrollIntoView({ behavior: "instant", block: "start" });
    });

    await expect(cards.nth(1)).toHaveAttribute("data-reveal-state", "preview");
    await expect(cards.nth(1)).toHaveAttribute("data-event-type", "hidden");
    await expect(cards.nth(1).locator("[data-testid='preview-reveal-control']")).toBeVisible();
    await expect(cards.nth(1).locator("[data-testid='result-badge']")).toHaveCount(0);
    await expect(cards.nth(1)).not.toContainText("WALK");
    await expect(cards.nth(1).locator("[data-testid='base-bulb'][data-base='first']")).toHaveCount(1);
    await expect(cards.nth(1).locator("[data-testid='base-runner-label'][data-base='first']")).toHaveAttribute("data-runner", "X EDWARDS");
  });

  test("double without source trajectory does not invent a throw-home line", async ({ page }) => {
    const double = makePlayCard({
      id: `${DEFAULT_GAME_ID}-double-no-location`,
      sortOrder: 1,
      play: {
        ...makePlayCard().play!,
        eventType: "double",
        label: "DOUBLE",
        subLabel: null,
        description: "A double, with no hit location from the source feed.",
        baseStateBefore: { first: false, second: false, third: false },
        baseStateAfter: { first: false, second: true, third: false },
        runnerNamesBefore: {},
        runnerNamesAfter: { second: "Casey Schmitt" },
        runsScoredOnPlay: 0,
      },
      visual: {
        trajectory: "none",
        runnerMovements: [{ runner: "Casey Schmitt", from: "home", to: "second", style: "advance" }],
        intensity: "medium",
        animationProfile: "line_drive",
      },
    });

    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse({ cards: [makeSceneCard(), double] }),
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);

    const card = page.locator("[data-testid='play-card']").first();
    await card.getByRole("button", { name: /reveal pitch/i }).click();
    await expect(card.locator(".field-ball-trail")).toHaveCount(0);
    await expect(card.locator("[data-testid='runner-marker']")).toHaveCount(1);
  });

  test("catch-up playback settings persist locally", async ({ page }) => {
    await mockSdmRoutes(page, { recent: makeRecentResponse(), deck: makeDeckResponse() });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);

    await page.locator("[data-testid='catchup-settings-button']").click();
    const drawer = page.locator("[data-testid='catchup-settings-drawer']");
    await expect(drawer).toBeVisible();
    await drawer.locator("[data-testid='auto-reveal-setting']").getByRole("button", { name: "2s", exact: true }).click();
    await drawer.locator("[data-testid='auto-advance-setting']").getByRole("button", { name: "15s", exact: true }).click();
    await drawer.getByRole("button", { name: /close/i }).click();

    await page.reload();
    await page.locator("[data-testid='catchup-settings-button']").click();
    const reopened = page.locator("[data-testid='catchup-settings-drawer']");
    await expect(reopened.locator("[data-testid='auto-reveal-setting']").getByRole("button", { name: "2s", exact: true })).toHaveAttribute("data-active", "true");
    await expect(reopened.locator("[data-testid='auto-advance-setting']").getByRole("button", { name: "15s", exact: true })).toHaveAttribute("data-active", "true");
  });

  test("auto reveal fires once for the active event", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "sd-settings",
        JSON.stringify({
          state: {
            theme: "system",
            showStaleBanners: true,
            autoRevealDelayMs: 1000,
            autoAdvanceDelayMs: 0,
            spoilerSafeMode: true,
          },
          version: 3,
        }),
      );
    });
    await mockSdmRoutes(page, { recent: makeRecentResponse(), deck: makeDeckResponse() });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);

    const scroller = page.locator("[data-testid='catchup-scroller']");
    await scroller.evaluate((el) => {
      const child = el.children[1] as HTMLElement | undefined;
      if (child) child.scrollIntoView({ behavior: "instant", block: "start" });
    });

    const card = page.locator("[data-testid='play-card']").first();
    await expect(card).toHaveAttribute("data-active", "true");
    await expect(card).toHaveAttribute("data-auto-reveal-ms", "1000");

    await expect(page.locator(".catchup-page-shell")).toHaveAttribute("data-auto-reveal-ms", "1000");
    await expect(page.locator(".catchup-page-shell")).toHaveAttribute("data-active-play-id", `${DEFAULT_GAME_ID}-10002`);

    await expect(card).toHaveAttribute("data-reveal-state", "preview");
    await expect(card.locator("[data-testid='preview-reveal-control']")).toBeVisible();
    await expect(card).not.toHaveAttribute("data-reveal-state", "preview", { timeout: 4500 });
    await expect(card.locator("[data-testid='result-badge']")).toBeVisible();
  });

  test("auto advance only scrolls after the active event is revealed", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "sd-settings",
        JSON.stringify({
          state: {
            theme: "system",
            showStaleBanners: true,
            autoRevealDelayMs: 0,
            autoAdvanceDelayMs: 10000,
            spoilerSafeMode: true,
          },
          version: 3,
        }),
      );
    });
    const first = makePlayCard({
      id: `${DEFAULT_GAME_ID}-auto-advance-first`,
      sortOrder: 1,
      play: {
        ...makePlayCard().play!,
        eventType: "strikeout",
        label: "STRIKEOUT",
        description: "Mitchell strikes out swinging.",
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
    const second = makePlayCard({
      id: `${DEFAULT_GAME_ID}-auto-advance-second`,
      sortOrder: 2,
      inning: 1,
      half: "top",
      play: {
        ...makePlayCard().play!,
        eventType: "single",
        label: "SINGLE",
        description: "The next batter singles.",
        outsBefore: 2,
        outsAfter: 2,
        baseStateBefore: { first: false, second: false, third: false },
        baseStateAfter: { first: true, second: false, third: false },
        runnerNamesBefore: {},
        runnerNamesAfter: { first: "Casey Schmitt" },
        runsScoredOnPlay: 0,
      },
    });

    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse({ cards: [makeSceneCard(), first, second] }),
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);

    const scroller = page.locator("[data-testid='catchup-scroller']");
    await scroller.evaluate((el) => {
      const child = el.children[1] as HTMLElement | undefined;
      if (child) child.scrollIntoView({ behavior: "instant", block: "start" });
    });

    const cards = page.locator("[data-testid='play-card']");
    await expect(cards.first()).toHaveAttribute("data-active", "true");
    await expect(cards.nth(1)).toHaveAttribute("data-active", "false");

    await page.waitForTimeout(1100);
    await expect(cards.first()).toHaveAttribute("data-active", "true");
    await cards.first().getByRole("button", { name: /reveal pitch/i }).click();
    await expect(cards.first()).not.toHaveAttribute("data-reveal-state", "preview");

    await expect(cards.nth(1)).toHaveAttribute("data-active", "true", { timeout: 12000 });
    await expect(cards.nth(1)).toHaveAttribute("data-reveal-state", "preview");
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
        runnerNamesBefore: { first: "Wilmer Flores", second: "Jung Hoo Lee", third: "Rafael Devers" },
        runnerNamesAfter: { third: "Rafael Devers" },
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

  test("stationary runners stay visible without movement overlays", async ({ page }) => {
    const runnerOnFirstStays = makePlayCard({
      id: `${DEFAULT_GAME_ID}-first-stays`,
      sortOrder: 1,
      play: {
        ...makePlayCard().play!,
        eventType: "strikeout",
        label: "STRIKEOUT",
        description: "The batter strikes out; the runner holds first.",
        outsBefore: 0,
        outsAfter: 1,
        baseStateBefore: { first: true, second: false, third: false },
        baseStateAfter: { first: true, second: false, third: false },
        runnerNamesBefore: { first: "Corbin Carroll" },
        runnerNamesAfter: { first: "Corbin Carroll" },
        runsScoredOnPlay: 0,
      },
      visual: {
        trajectory: "pitch",
        runnerMovements: [{ runner: "Corbin Carroll", from: "first", to: "second", style: "advance" }],
        intensity: "low",
        animationProfile: "strikeout",
      },
    });
    const runnerOnSecondStays = makePlayCard({
      id: `${DEFAULT_GAME_ID}-second-stays`,
      sortOrder: 2,
      play: {
        ...makePlayCard().play!,
        eventType: "field_out",
        label: "FLYOUT",
        description: "A flyout; the runner holds second.",
        outsBefore: 1,
        outsAfter: 2,
        baseStateBefore: { first: false, second: true, third: false },
        baseStateAfter: { first: false, second: true, third: false },
        runnerNamesBefore: { second: "Josh Jung" },
        runnerNamesAfter: { second: "Josh Jung" },
        runsScoredOnPlay: 0,
      },
      visual: {
        trajectory: "none",
        runnerMovements: [{ runner: "Josh Jung", from: "second", to: "third", style: "advance" }],
        intensity: "low",
        animationProfile: "shallow_fly",
      },
    });

    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse({ cards: [makeSceneCard(), runnerOnFirstStays, runnerOnSecondStays] }),
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);

    const cards = page.locator("[data-testid='play-card']");
    await expect(cards.first().locator("[data-testid='base-bulb'][data-base='first']")).toHaveCount(1);
    await expect(cards.first().locator("[data-testid='base-runner-label'][data-base='first']")).toHaveAttribute("data-runner", "C CARROLL");
    await expect(cards.first().locator("[data-testid='runner-marker']")).toHaveCount(0);
    await cards.first().getByRole("button", { name: /reveal pitch/i }).click();
    await expect(cards.first().locator("[data-testid='base-bulb'][data-base='first']")).toHaveCount(1);
    await expect(cards.first().locator("[data-testid='base-runner-label'][data-base='first']")).toHaveAttribute("data-runner", "C CARROLL");
    await expect(cards.first().locator("[data-testid='runner-marker']")).toHaveCount(0);
    await expect(cards.first().locator(".field-runner-trail")).toHaveCount(0);

    const scroller = page.locator("[data-testid='catchup-scroller']");
    await scroller.evaluate((el) => {
      const child = el.children[2] as HTMLElement | undefined;
      if (child) child.scrollIntoView({ behavior: "instant", block: "start" });
    });

    await expect(cards.nth(1).locator("[data-testid='base-bulb'][data-base='second']")).toHaveCount(1);
    await expect(cards.nth(1).locator("[data-testid='base-runner-label'][data-base='second']")).toHaveAttribute("data-runner", "J JUNG");
    await cards.nth(1).getByRole("button", { name: /reveal pitch/i }).click();
    await expect(cards.nth(1).locator("[data-testid='base-bulb'][data-base='second']")).toHaveCount(1);
    await expect(cards.nth(1).locator("[data-testid='runner-marker']")).toHaveCount(0);
    await expect(cards.nth(1).locator(".field-ball-trail")).toHaveCount(0);
  });

  test("inning-ending out clears bases without fake stranded-runner movement", async ({ page }) => {
    const inningEnder = makePlayCard({
      id: `${DEFAULT_GAME_ID}-inning-ending-out`,
      sortOrder: 1,
      inning: 1,
      half: "top",
      play: {
        ...makePlayCard().play!,
        eventType: "field_out",
        label: "GROUNDOUT",
        description: "A groundout ends the inning; the runner is stranded.",
        outsBefore: 2,
        outsAfter: 3,
        baseStateBefore: { first: true, second: false, third: false },
        baseStateAfter: { first: false, second: false, third: false },
        runnerNamesBefore: { first: "Maxwell Waldschmidt" },
        runnerNamesAfter: {},
        runsScoredOnPlay: 0,
      },
      visual: {
        trajectory: "ground_2b",
        runnerMovements: [{ runner: "Maxwell Waldschmidt", from: "first", to: "second", style: "advance" }],
        intensity: "low",
        animationProfile: "routine_grounder",
      },
    });
    const nextInning = makePlayCard({
      id: `${DEFAULT_GAME_ID}-new-inning-empty`,
      sortOrder: 2,
      inning: 1,
      half: "bottom",
      play: {
        ...makePlayCard().play!,
        eventType: "field_out",
        label: "FLYOUT",
        description: "The new half-inning begins with empty bases.",
        outsBefore: 0,
        outsAfter: 1,
        baseStateBefore: { first: false, second: false, third: false },
        baseStateAfter: { first: false, second: false, third: false },
        runnerNamesBefore: {},
        runnerNamesAfter: {},
        runsScoredOnPlay: 0,
      },
      visual: {
        trajectory: "none",
        runnerMovements: [],
        intensity: "low",
        animationProfile: "shallow_fly",
      },
    });

    await mockSdmRoutes(page, {
      recent: makeRecentResponse(),
      deck: makeDeckResponse({ cards: [makeSceneCard(), inningEnder, nextInning] }),
    });
    await page.goto(`/catchup/${DEFAULT_GAME_ID}`);

    const cards = page.locator("[data-testid='play-card']");
    await expect(cards.first().locator("[data-testid='base-bulb'][data-base='first']")).toHaveCount(1);
    await expect(cards.first().locator("[data-testid='base-runner-label'][data-base='first']")).toHaveAttribute("data-runner", "M WALDSCHMIDT");
    await cards.first().getByRole("button", { name: /reveal pitch/i }).click();
    await expect(cards.first().locator("[data-testid='base-bulb']")).toHaveCount(0);
    await expect(cards.first().locator("[data-testid='runner-marker']")).toHaveCount(0);

    const scroller = page.locator("[data-testid='catchup-scroller']");
    await scroller.evaluate((el) => {
      const child = el.children[2] as HTMLElement | undefined;
      if (child) child.scrollIntoView({ behavior: "instant", block: "start" });
    });

    await expect(cards.nth(1)).toHaveAttribute("data-reveal-state", "preview");
    await expect(cards.nth(1).locator("[data-testid='base-bulb']")).toHaveCount(0);
    await expect(cards.nth(1).locator("[data-testid='runner-marker']")).toHaveCount(0);
  });

  test("on-base runner is visible on first-paint of the next at-bat (screenshot-bug repro)", async ({ page }) => {
    // The bug from IMG_0072–IMG_0077: a walk puts a runner on first, then
    // the next at-bat shows an empty diamond through pitch/ball. The field
    // now renders the explicit visible base snapshot, so first base must
    // be present immediately in preview instead of waiting for reveal.
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

    // First base is occupied in preview.
    const firstBulb = reachCard.locator("[data-testid='base-bulb'][data-base='first']");
    await expect(firstBulb).toHaveAttribute("data-occupied", "true");
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
    const firstLabel = reachCard.locator("[data-testid='base-runner-label'][data-base='first']");
    await expect(firstLabel).toHaveAttribute("data-runner", "X EDWARDS");

    await reachCard.getByRole("button", { name: /reveal pitch/i }).click();
    await expect(thirdBulb).toHaveAttribute("data-occupied", "true");
    await expect(reachCard.locator("[data-testid='base-runner-label'][data-base='third']")).toHaveAttribute("data-runner", "X EDWARDS");
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
