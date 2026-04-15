import { describe, it, expect, beforeEach } from "vitest";
import { useSettings, SCORE_HIDE_LIMITS } from "../settings";

describe("settings store", () => {
  beforeEach(() => {
    useSettings.setState({
      theme: "system",
      scoreRevealMode: "onMarkRead",
      scoreHideLeagues: [],
      scoreHideTeams: [],
      preferredSportsbook: "",
      oddsFormat: "american",
      autoResumePosition: true,
      homeExpandedSections: [],
      hideLimitedData: true,
      timelineDefaultTiers: [1, 2, 3],
      followingLive: false,
      followingLiveAt: 0,
      showStaleBanners: true,
      notificationGlobalMode: "spoiler_free",
      preGameReminderMinutes: 30,
      notificationsGameStarted: true,
      notificationsGameEnded: true,
      notificationsHalftime: false,
      notificationsDailyDigest: false,
      dailyDigestHour: 8,
      notificationPerTeamOverrides: {},
    });
  });

  describe("score reveal mode", () => {
    it("sets score reveal mode", () => {
      useSettings.getState().setScoreRevealMode("always");
      expect(useSettings.getState().scoreRevealMode).toBe("always");
    });

    it("sets all three modes", () => {
      for (const mode of ["always", "onMarkRead", "blacklist"] as const) {
        useSettings.getState().setScoreRevealMode(mode);
        expect(useSettings.getState().scoreRevealMode).toBe(mode);
      }
    });
  });

  describe("score hide leagues", () => {
    it("adds and removes leagues", () => {
      useSettings.getState().addScoreHideLeague("nba");
      expect(useSettings.getState().scoreHideLeagues).toEqual(["NBA"]);

      useSettings.getState().removeScoreHideLeague("nba");
      expect(useSettings.getState().scoreHideLeagues).toEqual([]);
    });

    it("normalizes league codes to uppercase", () => {
      useSettings.getState().addScoreHideLeague("  nfl  ");
      expect(useSettings.getState().scoreHideLeagues).toEqual(["NFL"]);
    });

    it("deduplicates leagues", () => {
      useSettings.getState().addScoreHideLeague("NBA");
      useSettings.getState().addScoreHideLeague("nba");
      expect(useSettings.getState().scoreHideLeagues).toEqual(["NBA"]);
    });

    it("enforces 20 league limit", () => {
      for (let i = 0; i < SCORE_HIDE_LIMITS.LEAGUES; i++) {
        useSettings.getState().addScoreHideLeague(`L${i}`);
      }
      expect(useSettings.getState().scoreHideLeagues).toHaveLength(20);

      useSettings.getState().addScoreHideLeague("EXTRA");
      expect(useSettings.getState().scoreHideLeagues).toHaveLength(20);
      expect(useSettings.getState().scoreHideLeagues).not.toContain("EXTRA");
    });

    it("rejects empty strings", () => {
      useSettings.getState().addScoreHideLeague("  ");
      expect(useSettings.getState().scoreHideLeagues).toEqual([]);
    });
  });

  describe("score hide teams", () => {
    it("adds and removes teams", () => {
      useSettings.getState().addScoreHideTeam("Boston Celtics");
      expect(useSettings.getState().scoreHideTeams).toEqual(["Boston Celtics"]);

      useSettings.getState().removeScoreHideTeam("boston celtics");
      expect(useSettings.getState().scoreHideTeams).toEqual([]);
    });

    it("deduplicates teams case-insensitively", () => {
      useSettings.getState().addScoreHideTeam("Lakers");
      useSettings.getState().addScoreHideTeam("lakers");
      expect(useSettings.getState().scoreHideTeams).toHaveLength(1);
    });

    it("enforces 100 team limit", () => {
      for (let i = 0; i < SCORE_HIDE_LIMITS.TEAMS; i++) {
        useSettings.getState().addScoreHideTeam(`Team${i}`);
      }
      expect(useSettings.getState().scoreHideTeams).toHaveLength(100);

      useSettings.getState().addScoreHideTeam("Extra Team");
      expect(useSettings.getState().scoreHideTeams).toHaveLength(100);
    });
  });

  describe("notification global mode", () => {
    it("defaults to spoiler_free", () => {
      expect(useSettings.getState().notificationGlobalMode).toBe("spoiler_free");
    });

    it("sets all three modes", () => {
      for (const mode of ["spoiler_free", "scores_ok", "per_team"] as const) {
        useSettings.getState().setNotificationGlobalMode(mode);
        expect(useSettings.getState().notificationGlobalMode).toBe(mode);
      }
    });
  });

  describe("notification toggles", () => {
    it("toggles game started", () => {
      useSettings.getState().setNotificationsGameStarted(false);
      expect(useSettings.getState().notificationsGameStarted).toBe(false);
    });

    it("toggles game ended", () => {
      useSettings.getState().setNotificationsGameEnded(false);
      expect(useSettings.getState().notificationsGameEnded).toBe(false);
    });

    it("toggles halftime", () => {
      useSettings.getState().setNotificationsHalftime(true);
      expect(useSettings.getState().notificationsHalftime).toBe(true);
    });

    it("toggles daily digest", () => {
      useSettings.getState().setNotificationsDailyDigest(true);
      expect(useSettings.getState().notificationsDailyDigest).toBe(true);
    });

    it("sets pre-game reminder minutes", () => {
      useSettings.getState().setPreGameReminderMinutes(60);
      expect(useSettings.getState().preGameReminderMinutes).toBe(60);
    });

    it("sets pre-game reminder to null (disabled)", () => {
      useSettings.getState().setPreGameReminderMinutes(null);
      expect(useSettings.getState().preGameReminderMinutes).toBeNull();
    });
  });

  describe("daily digest hour", () => {
    it("sets valid hour", () => {
      useSettings.getState().setDailyDigestHour(14);
      expect(useSettings.getState().dailyDigestHour).toBe(14);
    });

    it("clamps hour to 0-23 range", () => {
      useSettings.getState().setDailyDigestHour(-5);
      expect(useSettings.getState().dailyDigestHour).toBe(0);

      useSettings.getState().setDailyDigestHour(30);
      expect(useSettings.getState().dailyDigestHour).toBe(23);
    });

    it("rounds fractional hours", () => {
      useSettings.getState().setDailyDigestHour(8.7);
      expect(useSettings.getState().dailyDigestHour).toBe(9);
    });
  });

  describe("per-team notification overrides", () => {
    it("adds a team override", () => {
      useSettings.getState().setPerTeamOverride("Boston Celtics", "scores_ok");
      expect(useSettings.getState().notificationPerTeamOverrides).toEqual({
        "Boston Celtics": "scores_ok",
      });
    });

    it("updates an existing override", () => {
      useSettings.getState().setPerTeamOverride("Lakers", "spoiler_free");
      useSettings.getState().setPerTeamOverride("Lakers", "scores_ok");
      expect(useSettings.getState().notificationPerTeamOverrides["Lakers"]).toBe("scores_ok");
    });

    it("removes a team override", () => {
      useSettings.getState().setPerTeamOverride("Lakers", "scores_ok");
      useSettings.getState().setPerTeamOverride("Celtics", "spoiler_free");
      useSettings.getState().removePerTeamOverride("Lakers");
      expect(useSettings.getState().notificationPerTeamOverrides).toEqual({
        Celtics: "spoiler_free",
      });
    });

    it("removing a non-existent team is a no-op", () => {
      useSettings.getState().setPerTeamOverride("Lakers", "scores_ok");
      useSettings.getState().removePerTeamOverride("NonExistent");
      expect(useSettings.getState().notificationPerTeamOverrides).toEqual({
        Lakers: "scores_ok",
      });
    });

    it("preserves other overrides when setting one", () => {
      useSettings.getState().setPerTeamOverride("Lakers", "scores_ok");
      useSettings.getState().setPerTeamOverride("Celtics", "spoiler_free");
      expect(Object.keys(useSettings.getState().notificationPerTeamOverrides)).toHaveLength(2);
    });
  });
});
