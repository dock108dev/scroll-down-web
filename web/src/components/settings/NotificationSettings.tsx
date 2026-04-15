"use client";

import { useMemo, useState } from "react";
import { useSettings, type NotificationGlobalMode, type PerTeamNotificationMode } from "@/stores/settings";
import { useGameData } from "@/stores/game-data";
import { cn } from "@/lib/utils";
import { Section } from "@/components/shared/FormPrimitives";

const GLOBAL_MODES: { value: NotificationGlobalMode; label: string; desc: string }[] = [
  {
    value: "spoiler_free",
    label: "Spoiler-free",
    desc: "Only safe templates, no outcome language",
  },
  {
    value: "scores_ok",
    label: "Scores OK",
    desc: "Standard sports app notifications",
  },
  {
    value: "per_team",
    label: "Per-team settings",
    desc: "Per-team overrides control behavior; teams without overrides inherit Spoiler-free",
  },
];

const PRE_GAME_OPTIONS = [
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 60, label: "60 min" },
];

const DIGEST_HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${i === 0 ? "12" : i <= 12 ? String(i) : String(i - 12)}:00 ${i < 12 ? "AM" : "PM"}`,
}));

export function NotificationSettings() {
  const {
    notificationGlobalMode,
    setNotificationGlobalMode,
    preGameReminderMinutes,
    setPreGameReminderMinutes,
    notificationsGameStarted,
    setNotificationsGameStarted,
    notificationsGameEnded,
    setNotificationsGameEnded,
    notificationsHalftime,
    setNotificationsHalftime,
    notificationsDailyDigest,
    setNotificationsDailyDigest,
    dailyDigestHour,
    setDailyDigestHour,
    notificationPerTeamOverrides,
    setPerTeamOverride,
    removePerTeamOverride,
  } = useSettings();

  return (
    <Section
      title="Notifications"
      collapsible
      defaultOpen={true}
      description="Control when and how you get notified about games."
    >
      <div className="px-4 py-3">
        <p className="text-sm text-neutral-200 mb-3">Notification Mode</p>
        <NotificationModeSelector
          value={notificationGlobalMode}
          onChange={setNotificationGlobalMode}
        />
      </div>

      <NotificationToggles
        preGameReminderMinutes={preGameReminderMinutes}
        setPreGameReminderMinutes={setPreGameReminderMinutes}
        notificationsGameStarted={notificationsGameStarted}
        setNotificationsGameStarted={setNotificationsGameStarted}
        notificationsGameEnded={notificationsGameEnded}
        setNotificationsGameEnded={setNotificationsGameEnded}
        notificationsHalftime={notificationsHalftime}
        setNotificationsHalftime={setNotificationsHalftime}
        notificationsDailyDigest={notificationsDailyDigest}
        setNotificationsDailyDigest={setNotificationsDailyDigest}
        dailyDigestHour={dailyDigestHour}
        setDailyDigestHour={setDailyDigestHour}
      />

      {notificationGlobalMode === "per_team" && (
        <PerTeamOverrides
          overrides={notificationPerTeamOverrides}
          onSet={setPerTeamOverride}
          onRemove={removePerTeamOverride}
        />
      )}
    </Section>
  );
}

function NotificationModeSelector({
  value,
  onChange,
}: {
  value: NotificationGlobalMode;
  onChange: (v: NotificationGlobalMode) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Notification mode" className="space-y-2">
      {GLOBAL_MODES.map((mode) => (
        <button
          key={mode.value}
          role="radio"
          aria-checked={value === mode.value}
          aria-label={mode.label}
          onClick={() => onChange(mode.value)}
          className={cn(
            "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
            value === mode.value
              ? "bg-neutral-800 border border-neutral-600"
              : "bg-neutral-900 border border-neutral-800 hover:border-neutral-700",
          )}
        >
          <span
            className={cn(
              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
              value === mode.value
                ? "border-blue-400 bg-blue-400"
                : "border-neutral-600",
            )}
          >
            {value === mode.value && (
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            )}
          </span>
          <div>
            <span className="text-sm text-neutral-200">{mode.label}</span>
            <p className="text-xs text-neutral-500 mt-0.5">{mode.desc}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

function NotificationToggles({
  preGameReminderMinutes,
  setPreGameReminderMinutes,
  notificationsGameStarted,
  setNotificationsGameStarted,
  notificationsGameEnded,
  setNotificationsGameEnded,
  notificationsHalftime,
  setNotificationsHalftime,
  notificationsDailyDigest,
  setNotificationsDailyDigest,
  dailyDigestHour,
  setDailyDigestHour,
}: {
  preGameReminderMinutes: number | null;
  setPreGameReminderMinutes: (m: number | null) => void;
  notificationsGameStarted: boolean;
  setNotificationsGameStarted: (v: boolean) => void;
  notificationsGameEnded: boolean;
  setNotificationsGameEnded: (v: boolean) => void;
  notificationsHalftime: boolean;
  setNotificationsHalftime: (v: boolean) => void;
  notificationsDailyDigest: boolean;
  setNotificationsDailyDigest: (v: boolean) => void;
  dailyDigestHour: number;
  setDailyDigestHour: (h: number) => void;
}) {
  const preGameEnabled = preGameReminderMinutes !== null;

  return (
    <div className="divide-y divide-neutral-800">
      <ToggleRow
        label="Pre-game reminder"
        checked={preGameEnabled}
        onChange={(v) => setPreGameReminderMinutes(v ? 30 : null)}
      >
        {preGameEnabled && (
          <select
            value={preGameReminderMinutes ?? 30}
            onChange={(e) => setPreGameReminderMinutes(Number(e.target.value))}
            aria-label="Pre-game reminder time"
            className="mt-1 bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-neutral-50"
          >
            {PRE_GAME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} before
              </option>
            ))}
          </select>
        )}
      </ToggleRow>

      <ToggleRow
        label="Game started"
        checked={notificationsGameStarted}
        onChange={setNotificationsGameStarted}
      />

      <ToggleRow
        label="Game ended"
        checked={notificationsGameEnded}
        onChange={setNotificationsGameEnded}
      />

      <ToggleRow
        label="Halftime"
        checked={notificationsHalftime}
        onChange={setNotificationsHalftime}
      />

      <ToggleRow
        label="Daily digest"
        checked={notificationsDailyDigest}
        onChange={setNotificationsDailyDigest}
      >
        {notificationsDailyDigest && (
          <select
            value={dailyDigestHour}
            onChange={(e) => setDailyDigestHour(Number(e.target.value))}
            aria-label="Daily digest delivery hour"
            className="mt-1 bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-xs text-neutral-50"
          >
            {DIGEST_HOURS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </ToggleRow>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-200">{label}</span>
        <button
          role="switch"
          aria-checked={checked}
          aria-label={label}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative inline-flex h-7 w-12 items-center rounded-full transition-colors duration-200",
            checked ? "bg-green-500" : "bg-neutral-700",
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform duration-200",
              checked ? "translate-x-6" : "translate-x-1",
            )}
          />
        </button>
      </div>
      {children}
    </div>
  );
}

function PerTeamOverrides({
  overrides,
  onSet,
  onRemove,
}: {
  overrides: Record<string, PerTeamNotificationMode>;
  onSet: (team: string, mode: PerTeamNotificationMode) => void;
  onRemove: (team: string) => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const gameEntries = useGameData((s) => s.games);

  const availableTeams = useMemo(() => {
    const set = new Set<string>();
    for (const { core } of gameEntries.values()) {
      if (core.homeTeam) set.add(core.homeTeam);
      if (core.awayTeam) set.add(core.awayTeam);
    }
    return Array.from(set).sort();
  }, [gameEntries]);

  const filteredTeams = useMemo(() => {
    const q = searchInput.toLowerCase().trim();
    if (!q) return availableTeams;
    return availableTeams.filter((t) => t.toLowerCase().includes(q));
  }, [availableTeams, searchInput]);

  const overrideEntries = Object.entries(overrides);

  return (
    <div className="px-4 py-3 space-y-3">
      <p className="text-sm font-medium text-neutral-200">Per-team settings</p>

      <div className="flex gap-2">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search teams by name"
          aria-label="Search teams for notification overrides"
          className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-neutral-50"
        />
      </div>

      {searchInput.trim() && (
        <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
          {filteredTeams
            .filter((t) => !(t in overrides))
            .slice(0, 20)
            .map((team) => (
              <button
                key={team}
                onClick={() => {
                  onSet(team, "spoiler_free");
                  setSearchInput("");
                }}
                className="rounded-full bg-neutral-900 border border-neutral-800 px-2 py-1 text-[11px] text-neutral-500 hover:text-neutral-300 hover:border-neutral-700 transition-colors"
              >
                + {team}
              </button>
            ))}
          {filteredTeams.filter((t) => !(t in overrides)).length === 0 && (
            <p className="text-xs text-neutral-600">No matching teams found.</p>
          )}
        </div>
      )}

      {overrideEntries.length === 0 ? (
        <p className="text-xs text-neutral-500">
          No per-team settings yet — teams without overrides use Spoiler-free protection
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {overrideEntries.map(([team, mode]) => (
            <div
              key={team}
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-800 border border-neutral-700 pl-3 pr-1 py-1"
            >
              <span className="text-xs text-neutral-300">{team}</span>
              <ModePill
                value={mode}
                onChange={(m) => onSet(team, m)}
              />
              <button
                onClick={() => onRemove(team)}
                aria-label={`Remove ${team}`}
                className="ml-0.5 text-neutral-500 hover:text-neutral-300 transition-colors px-1"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ModePill({
  value,
  onChange,
}: {
  value: PerTeamNotificationMode;
  onChange: (v: PerTeamNotificationMode) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-neutral-900 p-0.5 text-[10px]">
      <button
        onClick={() => onChange("spoiler_free")}
        aria-label="Spoiler-free"
        className={cn(
          "px-1.5 py-0.5 rounded-full transition-colors",
          value === "spoiler_free"
            ? "bg-neutral-700 text-neutral-200"
            : "text-neutral-500 hover:text-neutral-300",
        )}
      >
        Spoiler-free
      </button>
      <button
        onClick={() => onChange("scores_ok")}
        aria-label="Scores OK"
        className={cn(
          "px-1.5 py-0.5 rounded-full transition-colors",
          value === "scores_ok"
            ? "bg-neutral-700 text-neutral-200"
            : "text-neutral-500 hover:text-neutral-300",
        )}
      >
        Scores OK
      </button>
    </div>
  );
}
