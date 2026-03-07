"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { isLive as checkLive } from "@/lib/types";
import type { GameSummary } from "@/lib/types";
import { AnalyticsAppGrid } from "@/features/analytics/AnalyticsAppGrid";
import { SimulationApp } from "@/features/analytics/apps/SimulationApp";
import { LivePredictionApp } from "@/features/analytics/apps/LivePredictionApp/LivePredictionApp";
import type { AnalyticsGameContext } from "@/features/analytics/types";
import { resolveTeamColor, cardDisplayName } from "@/lib/utils";

export default function AnalyticsPage() {
  const [games, setGames] = useState<GameSummary[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [selectedGameId, setSelectedGameId] = useState<number | null>(null);
  const [activeApp, setActiveApp] = useState<string | null>(null);

  // Fetch today's games for the picker
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const params = new URLSearchParams({
          startDate: today,
          endDate: today,
          limit: "200",
        });
        const res = await api.games(params);
        if (!cancelled) {
          const mlbOnly = (res.games ?? []).filter(
            (g: GameSummary) => g.leagueCode?.toLowerCase() === "mlb",
          );
          setGames(mlbOnly);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setGamesLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const selectedGame = games.find((g) => g.id === selectedGameId) ?? null;

  const ctx: AnalyticsGameContext | null = selectedGame
    ? {
        gameId: selectedGame.id,
        leagueCode: selectedGame.leagueCode ?? "",
        homeTeam: selectedGame.homeTeam ?? "",
        awayTeam: selectedGame.awayTeam ?? "",
        homeTeamAbbr: selectedGame.homeTeamAbbr,
        awayTeamAbbr: selectedGame.awayTeamAbbr,
        homeColor: resolveTeamColor(selectedGame.homeTeamColorLight, selectedGame.homeTeamColorDark),
        awayColor: resolveTeamColor(selectedGame.awayTeamColorLight, selectedGame.awayTeamColorDark),
        isLive: checkLive(selectedGame.status, selectedGame),
      }
    : null;

  const handleBack = useCallback(() => setActiveApp(null), []);

  const handleGameChange = useCallback((id: number | null) => {
    setSelectedGameId(id);
    setActiveApp(null);
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
      <h1 className="text-xl font-bold text-neutral-50">Analytics</h1>

      {/* Game Picker */}
      <div>
        <select
          value={selectedGameId ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            handleGameChange(v ? Number(v) : null);
          }}
          className="w-full text-sm rounded-lg px-3 py-2.5 bg-neutral-900 text-neutral-200 border border-neutral-800 outline-none"
        >
          <option value="">
            {gamesLoading ? "Loading games..." : "Select a game"}
          </option>
          {games.map((g) => {
            const away = cardDisplayName(g.awayTeam, g.leagueCode, g.awayTeamAbbr);
            const home = cardDisplayName(g.homeTeam, g.leagueCode, g.homeTeamAbbr);
            const live = checkLive(g.status, g);
            return (
              <option key={g.id} value={g.id}>
                {away} @ {home} ({g.leagueCode?.toUpperCase()}){live ? " - LIVE" : ""}
              </option>
            );
          })}
        </select>
      </div>

      {/* No game selected */}
      {!selectedGameId && (
        <div className="py-12 text-center text-sm text-neutral-500">
          Select a game to explore analytics tools.
        </div>
      )}

      {/* App grid or active app */}
      {ctx && activeApp === null && (
        <AnalyticsAppGrid ctx={ctx} activeApp={null} onSelect={setActiveApp} />
      )}

      {ctx && activeApp === "simulation" && (
        <SimulationApp ctx={ctx} onBack={handleBack} />
      )}

      {ctx && activeApp === "live-prediction" && (
        <LivePredictionApp ctx={ctx} onBack={handleBack} />
      )}
    </div>
  );
}
