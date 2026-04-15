"use client";

import { useMemo, useState } from "react";
import { SCORE_HIDE_LIMITS } from "@/stores/settings";
import { useGameData } from "@/stores/game-data";

interface ScoreHideBlacklistControlsProps {
  token: string | null;
  disabled?: boolean;
  scoreHideLeagues: string[];
  scoreHideTeams: string[];
  addScoreHideLeague: (league: string) => void;
  removeScoreHideLeague: (league: string) => void;
  addScoreHideTeam: (team: string) => void;
  removeScoreHideTeam: (team: string) => void;
}

/**
 * Score-hide blacklist controls.
 * Lets users maintain league/team lists used by selective score visibility mode.
 */
export function ScoreHideBlacklistControls({
  token,
  disabled = false,
  scoreHideLeagues,
  scoreHideTeams,
  addScoreHideLeague,
  removeScoreHideLeague,
  addScoreHideTeam,
  removeScoreHideTeam,
}: ScoreHideBlacklistControlsProps) {
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

  const filteredTeams = useMemo(() => {
    if (!teamInput.trim()) return availableTeams;
    const q = teamInput.toLowerCase();
    return availableTeams.filter((t) => t.toLowerCase().includes(q));
  }, [availableTeams, teamInput]);

  return (
    <fieldset disabled={disabled} className={disabled ? "opacity-50" : ""}>
      <div className="px-4 pb-3 pt-2 space-y-3">
        <p className="text-xs text-neutral-500 leading-relaxed">
          Games in your hidden list stay hidden until you reveal. Everything else stays live.
        </p>
        {!token && !disabled && (
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
              aria-label="Add league code"
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-neutral-50"
            />
            <button
              onClick={() => {
                if (!leagueInput.trim()) return;
                addScoreHideLeague(leagueInput);
                setLeagueInput("");
              }}
              disabled={leaguesAtLimit || disabled}
              className="px-3 py-1.5 rounded-lg bg-neutral-700 text-sm text-neutral-100 hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
          {leaguesAtLimit && (
            <p className="text-xs text-red-400" role="alert">Maximum 20 leagues</p>
          )}
          <TagList items={scoreHideLeagues} onRemove={removeScoreHideLeague} disabled={disabled} />
          {!leaguesAtLimit && !disabled && (
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
              placeholder="Search team name or abbreviation"
              aria-label="Search teams"
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-neutral-50"
            />
            <button
              onClick={() => {
                if (!teamInput.trim()) return;
                addScoreHideTeam(teamInput);
                setTeamInput("");
              }}
              disabled={teamsAtLimit || disabled}
              className="px-3 py-1.5 rounded-lg bg-neutral-700 text-sm text-neutral-100 hover:bg-neutral-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add
            </button>
          </div>
          {teamsAtLimit && (
            <p className="text-xs text-red-400" role="alert">Maximum 100 teams</p>
          )}
          <TagList items={scoreHideTeams} onRemove={removeScoreHideTeam} disabled={disabled} />
          {!teamsAtLimit && !disabled && (
            <QuickPickList
              items={filteredTeams.filter((t) => !scoreHideTeams.some((x) => x.toLowerCase() === t.toLowerCase())).slice(0, 16)}
              onPick={(team) => {
                addScoreHideTeam(team);
                setTeamInput("");
              }}
            />
          )}
        </div>
      </div>
    </fieldset>
  );
}

function TagList({
  items,
  onRemove,
  disabled = false,
}: {
  items: string[];
  onRemove: (value: string) => void;
  disabled?: boolean;
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
          disabled={disabled}
          aria-label={`Remove ${item}`}
          className="inline-flex items-center gap-1 rounded-full bg-neutral-800 border border-neutral-700 px-2.5 py-1 text-xs text-neutral-300 hover:bg-neutral-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {item}
          <span className="text-neutral-500" aria-hidden="true">&times;</span>
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
