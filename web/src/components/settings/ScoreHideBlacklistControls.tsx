"use client";

import { useMemo, useState } from "react";
import { SCORE_HIDE_LIMITS } from "@/stores/settings";
import { useGameData } from "@/stores/game-data";

interface ScoreHideBlacklistControlsProps {
  token: string | null;
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

  return (
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
