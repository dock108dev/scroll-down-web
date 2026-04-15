import { describe, it, expect, beforeEach } from "vitest";
import { useSettings } from "../settings";

describe("settings store — notification preferences integration", () => {
  beforeEach(() => {
    useSettings.setState({
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

  it("per-team overrides are preserved when global mode changes", () => {
    useSettings.getState().setNotificationGlobalMode("per_team");
    useSettings.getState().setPerTeamOverride("Lakers", "scores_ok");
    useSettings.getState().setPerTeamOverride("Celtics", "spoiler_free");

    useSettings.getState().setNotificationGlobalMode("spoiler_free");
    expect(useSettings.getState().notificationPerTeamOverrides).toEqual({
      Lakers: "scores_ok",
      Celtics: "spoiler_free",
    });

    useSettings.getState().setNotificationGlobalMode("per_team");
    expect(useSettings.getState().notificationPerTeamOverrides).toEqual({
      Lakers: "scores_ok",
      Celtics: "spoiler_free",
    });
  });

  it("daily digest hour is only meaningful when digest is enabled", () => {
    useSettings.getState().setNotificationsDailyDigest(false);
    useSettings.getState().setDailyDigestHour(14);
    expect(useSettings.getState().dailyDigestHour).toBe(14);

    useSettings.getState().setNotificationsDailyDigest(true);
    expect(useSettings.getState().dailyDigestHour).toBe(14);
  });

  it("pre-game reminder can cycle through all time options", () => {
    for (const minutes of [15, 30, 60] as const) {
      useSettings.getState().setPreGameReminderMinutes(minutes);
      expect(useSettings.getState().preGameReminderMinutes).toBe(minutes);
    }
  });

  it("disabling pre-game reminder sets null", () => {
    useSettings.getState().setPreGameReminderMinutes(null);
    expect(useSettings.getState().preGameReminderMinutes).toBeNull();
  });

  it("batch of per-team overrides round-trips correctly", () => {
    const teams = ["Lakers", "Celtics", "Warriors", "Heat", "Nets"];
    for (const team of teams) {
      useSettings.getState().setPerTeamOverride(team, "scores_ok");
    }
    useSettings.getState().setPerTeamOverride("Celtics", "spoiler_free");

    const overrides = useSettings.getState().notificationPerTeamOverrides;
    expect(Object.keys(overrides)).toHaveLength(5);
    expect(overrides["Celtics"]).toBe("spoiler_free");
    expect(overrides["Lakers"]).toBe("scores_ok");
  });

  it("removing all overrides results in empty object", () => {
    useSettings.getState().setPerTeamOverride("Lakers", "scores_ok");
    useSettings.getState().setPerTeamOverride("Celtics", "spoiler_free");
    useSettings.getState().removePerTeamOverride("Lakers");
    useSettings.getState().removePerTeamOverride("Celtics");
    expect(useSettings.getState().notificationPerTeamOverrides).toEqual({});
  });
});
