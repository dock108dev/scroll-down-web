"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SCORE_HIDE_LIMITS, useSettings } from "@/stores/settings";
import { useAuth } from "@/stores/auth";
import { useGameData } from "@/stores/game-data";
import { cn } from "@/lib/utils";
import { Section, Row } from "@/components/shared/FormPrimitives";

const KNOWN_BOOKS = [
  "DraftKings",
  "FanDuel",
  "BetMGM",
  "Caesars",
  "bet365",
  "ESPN BET",
  "Fanatics",
  "Hard Rock Bet",
  "Pinnacle",
  "BetRivers",
] as const;

const HOME_SECTIONS = ["Yesterday", "Today"] as const;
export function SettingsContent() {
  const {
    theme,
    setTheme,
    scoreRevealMode,
    setScoreRevealMode,
    scoreHideLeagues,
    scoreHideTeams,
    addScoreHideLeague,
    removeScoreHideLeague,
    addScoreHideTeam,
    removeScoreHideTeam,
    oddsFormat,
    setOddsFormat,
    preferredSportsbook,
    setPreferredSportsbook,
    hideLimitedData,
    setHideLimitedData,
    homeExpandedSections,
    toggleHomeSection,
    timelineDefaultTiers,
    toggleTimelineTier,
    showStaleBanners,
    setShowStaleBanners,
  } = useSettings();

  const { token, email: authEmail, role, logout } = useAuth();
  const [leagueInput, setLeagueInput] = useState("");
  const [teamInput, setTeamInput] = useState("");
  const gameEntries = useGameData((s) => s.games);
  const leaguesAtLimit = scoreHideLeagues.length >= SCORE_HIDE_LIMITS.LEAGUES;
  const teamsAtLimit = scoreHideTeams.length >= SCORE_HIDE_LIMITS.TEAMS;

  const availableLeagues = useMemo(() => {
    const set = new Set<string>();
    for (const { core } of gameEntries.values()) {
      if (core.leagueCode) set.add(core.leagueCode.toUpperCase());
    }
    return Array.from(set).sort();
  }, [gameEntries]);

  const availableTeams = useMemo(() => {
    const set = new Set<string>();
    for (const { core } of gameEntries.values()) {
      if (core.homeTeam) set.add(core.homeTeam);
      if (core.awayTeam) set.add(core.awayTeam);
      if (core.homeTeamAbbr) set.add(core.homeTeamAbbr.toUpperCase());
      if (core.awayTeamAbbr) set.add(core.awayTeamAbbr.toUpperCase());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [gameEntries]);

  return (
    <div data-testid="settings-content" className="space-y-6">
      {/* ─── Account ──────────────────────────────────────── */}
      <Section title="Account">
        {token ? (
          <>
            <div className="px-4 py-3">
              <p className="text-sm text-neutral-200">{authEmail}</p>
              <span
                className={cn(
                  "inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full",
                  role === "admin"
                    ? "bg-purple-500/20 text-purple-400"
                    : "bg-blue-500/20 text-blue-400",
                )}
              >
                {role}
              </span>
            </div>
            <div className="flex items-center gap-3 px-4 py-3">
              <Link
                href="/profile"
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Manage Account
              </Link>
              <button
                onClick={logout}
                className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Log Out
              </button>
            </div>
          </>
        ) : (
          <div className="px-4 py-3 space-y-2">
            <p className="text-xs text-neutral-500">
              Sign in to sync your preferences and access all features
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/login?tab=signup"
                className="text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
              >
                Sign Up
              </Link>
            </div>
          </div>
        )}
      </Section>

      {/* ─── Appearance ──────────────────────────────────── */}
      <Section title="Appearance">
        <Row label="Theme">
          <SegmentedControl
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            value={theme}
            onChange={(v) => setTheme(v as "system" | "light" | "dark")}
          />
        </Row>
      </Section>

      {/* ─── Recaps — Default Expanded ──────────────────── */}
      <Section title="Recaps — Default Expanded" collapsible defaultOpen={false}>
        {HOME_SECTIONS.map((section) => (
          <SettingsCheckRow
            key={section}
            label={section}
            checked={homeExpandedSections.includes(section)}
            onToggle={() => toggleHomeSection(section)}
          />
        ))}
      </Section>

      {/* ─── Timeline — Default Tiers ────────────────────── */}
      <Section title="Timeline — Default Tiers" collapsible defaultOpen={false}>
        {([
          { tier: 1, label: "Key Plays", desc: "Scoring, turnovers, big moments" },
          { tier: 2, label: "Secondary", desc: "Fouls, rebounds, stoppages" },
          { tier: 3, label: "Minor", desc: "Subs, period starts, low-signal" },
        ] as const).map(({ tier, label, desc }) => (
          <button
            key={tier}
            role="checkbox"
            aria-checked={timelineDefaultTiers.includes(tier)}
            aria-label={label}
            onClick={() => toggleTimelineTier(tier)}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-800/30 transition-colors"
          >
            <div>
              <span className="text-sm text-neutral-200">{label}</span>
              <p className="text-xs text-neutral-500">{desc}</p>
            </div>
            {timelineDefaultTiers.includes(tier) && (
              <span className="text-green-400 text-sm font-medium">&#10003;</span>
            )}
          </button>
        ))}
        <div className="px-4 pb-3 pt-2">
          <p className="text-xs text-neutral-500 leading-relaxed">
            Controls which play tiers are visible by default in the timeline.
            You can also toggle tiers per-game from the timeline header.
          </p>
        </div>
      </Section>

      {/* ─── Score Display ──────────────────────────────── */}
      <Section title="Score Display" collapsible>
        <Row label="Score visibility">
          <DarkSelect
            value={scoreRevealMode}
            onChange={(v) =>
              setScoreRevealMode(v as "always" | "onMarkRead" | "blacklist")
            }
            options={[
              {
                value: "onMarkRead",
                label: "Hidden until reveal",
              },
              { value: "blacklist", label: "Selective hide (league or team)" },
              { value: "always", label: "Always show scores" },
            ]}
          />
        </Row>
        {scoreRevealMode === "blacklist" && (
          <div className="px-4 pb-3 pt-2 space-y-3">
            <p className="text-xs text-neutral-500 leading-relaxed">
              Games in your hidden list stay hidden until you reveal. Everything else stays live.
            </p>
            {!token && (
              <p className="text-xs text-neutral-600 leading-relaxed">
                Sign in to sync this list across devices. You can still use it on this device now.
              </p>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-neutral-400">
                Hidden leagues ({scoreHideLeagues.length}/{SCORE_HIDE_LIMITS.LEAGUES})
              </p>
              <div className="flex gap-2">
                <input
                  value={leagueInput}
                  onChange={(e) => setLeagueInput(e.target.value)}
                  placeholder="Add league code (NBA)"
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-neutral-50"
                />
                <button
                  onClick={() => {
                    if (!leagueInput.trim()) return;
                    addScoreHideLeague(leagueInput);
                    setLeagueInput("");
                  }}
                  disabled={leaguesAtLimit}
                  className="px-3 py-1.5 rounded-lg bg-neutral-700 text-sm text-neutral-100 hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              {leaguesAtLimit && (
                <p className="text-xs text-neutral-600">League limit reached.</p>
              )}
              <TagList items={scoreHideLeagues} onRemove={removeScoreHideLeague} />
              {!leaguesAtLimit && (
                <QuickPickList
                  items={availableLeagues.filter((l) => !scoreHideLeagues.includes(l)).slice(0, 12)}
                  onPick={addScoreHideLeague}
                />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium text-neutral-400">
                Hidden teams ({scoreHideTeams.length}/{SCORE_HIDE_LIMITS.TEAMS})
              </p>
              <div className="flex gap-2">
                <input
                  value={teamInput}
                  onChange={(e) => setTeamInput(e.target.value)}
                  placeholder="Add team name or abbreviation"
                  className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-neutral-50"
                />
                <button
                  onClick={() => {
                    if (!teamInput.trim()) return;
                    addScoreHideTeam(teamInput);
                    setTeamInput("");
                  }}
                  disabled={teamsAtLimit}
                  className="px-3 py-1.5 rounded-lg bg-neutral-700 text-sm text-neutral-100 hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
              </div>
              {teamsAtLimit && (
                <p className="text-xs text-neutral-600">Team limit reached.</p>
              )}
              <TagList items={scoreHideTeams} onRemove={removeScoreHideTeam} />
              {!teamsAtLimit && (
                <QuickPickList
                  items={availableTeams.filter((t) => !scoreHideTeams.some((x) => x.toLowerCase() === t.toLowerCase())).slice(0, 16)}
                  onPick={addScoreHideTeam}
                />
              )}
            </div>
          </div>
        )}
        {scoreRevealMode !== "blacklist" && (
          <div className="px-4 pb-3 pt-2">
            <p className="text-xs text-neutral-500 leading-relaxed">
              Hidden until reveal keeps live and final scores hidden until you tap. Always show displays scores automatically.
            </p>
          </div>
        )}
      </Section>

      {/* ─── Odds ───────────────────────────────────────── */}
      <Section title="Odds" collapsible defaultOpen={false}>
        <Row label="Default Book">
          <DarkSelect
            value={preferredSportsbook}
            onChange={setPreferredSportsbook}
            options={[
              { value: "", label: "Best available price" },
              ...KNOWN_BOOKS.map((b) => ({
                value: b.toLowerCase().replace(/\s+/g, ""),
                label: b,
              })),
            ]}
          />
        </Row>
        <Row label="Odds Format">
          <SegmentedControl
            options={[
              { value: "american", label: "American" },
              { value: "decimal", label: "Decimal" },
            ]}
            value={oddsFormat}
            onChange={(v) =>
              setOddsFormat(v as "american" | "decimal")
            }
          />
        </Row>
        <SettingsToggle
          label="Hide Thin Markets"
          hint="Markets with only 1–2 sportsbooks"
          checked={hideLimitedData}
          onChange={setHideLimitedData}
        />
        <div className="px-4 pb-3 pt-2">
          <p className="text-xs text-neutral-500 leading-relaxed">
            Filters out bets where only a few books are posting or they
            can&apos;t agree on a number. If the market is thin, the fair
            estimate is just one book&apos;s opinion.
          </p>
        </div>
      </Section>

      {/* ─── Admin ─────────────────────────────────────── */}
      {role === "admin" && (
        <Section title="Admin" collapsible defaultOpen={false}>
          <SettingsToggle
            label="Show Stale Data Banners"
            hint="Show a banner when displaying cached data during API outages"
            checked={showStaleBanners}
            onChange={setShowStaleBanners}
          />
        </Section>
      )}

      {/* ─── Disclaimer ────────────────────────────────── */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-4 space-y-2">
        <h2 className="text-xs font-semibold text-yellow-500/80 uppercase tracking-wide">
          Disclaimer
        </h2>
        <p className="text-xs text-neutral-500 leading-relaxed">
          +EV does not mean a bet will win &mdash; it means the number is off.
          Data is delayed; lines and scores update on a timer. Nothing here is
          guaranteed. This is meant to help you think, not think for you.
        </p>
      </div>

      {/* ─── About ──────────────────────────────────────── */}
      <Section title="About">
        <Row label="Version">
          <span className="text-sm text-neutral-400">0.1.0</span>
        </Row>
        <Row label="Build">
          <span className="text-sm text-neutral-400">Web</span>
        </Row>
        <div className="px-4 py-3 space-y-2">
          <a
            href="https://scrolldownsports.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            scrolldownsports.dev
          </a>
          <a
            href="https://scrolldownsports.dev/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="https://scrolldownsports.dev/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Terms of Service
          </a>
        </div>
      </Section>
    </div>
  );
}

/* ─── Settings-specific Sub-components ──────────────────────────── */

function SettingsToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <span className="text-sm text-neutral-200">{label}</span>
        {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      </div>
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
  );
}

function SettingsCheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-800/30 transition-colors"
    >
      <span className="text-sm text-neutral-200">{label}</span>
      {checked && (
        <span className="text-green-400 text-sm font-medium">&#10003;</span>
      )}
    </button>
  );
}

function TagList({
  items,
  onRemove,
}: {
  items: string[];
  onRemove: (value: string) => void;
}) {
  if (items.length === 0) {
    return <p className="text-xs text-neutral-600">No items added yet.</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onRemove(item)}
          className="inline-flex items-center gap-1 rounded-full bg-neutral-800 border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-700 transition-colors"
          title="Remove"
        >
          {item}
          <span className="text-neutral-500">x</span>
        </button>
      ))}
    </div>
  );
}

function QuickPickList({
  items,
  onPick,
}: {
  items: string[];
  onPick: (value: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <button
          key={item}
          onClick={() => onPick(item)}
          className="rounded-full bg-neutral-900 border border-neutral-800 px-2 py-1 text-[11px] text-neutral-500 hover:text-neutral-300 hover:border-neutral-700 transition-colors"
        >
          + {item}
        </button>
      ))}
    </div>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" className="flex rounded-lg bg-neutral-800 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-all",
            value === opt.value
              ? "bg-neutral-600 text-neutral-50 shadow-sm"
              : "text-neutral-400 hover:text-neutral-200",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DarkSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-neutral-50 appearance-none cursor-pointer min-w-[160px]"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
