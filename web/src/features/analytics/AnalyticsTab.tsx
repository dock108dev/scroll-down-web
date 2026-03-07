"use client";

import { useState } from "react";
import { AnalyticsAppGrid } from "./AnalyticsAppGrid";
import { SimulationApp } from "./apps/SimulationApp";
import { LivePredictionApp } from "./apps/LivePredictionApp";
import type { AnalyticsGameContext } from "./types";

interface AnalyticsTabProps {
  gameId: number;
  leagueCode: string;
  homeTeam: string;
  awayTeam: string;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeColor: string;
  awayColor: string;
  isLive?: boolean;
}

export function AnalyticsTab({
  gameId,
  leagueCode,
  homeTeam,
  awayTeam,
  homeTeamAbbr,
  awayTeamAbbr,
  homeColor,
  awayColor,
  isLive = false,
}: AnalyticsTabProps) {
  const [activeApp, setActiveApp] = useState<string | null>(null);

  const ctx: AnalyticsGameContext = {
    gameId,
    leagueCode,
    homeTeam,
    awayTeam,
    homeTeamAbbr,
    awayTeamAbbr,
    homeColor,
    awayColor,
    isLive,
  };

  const handleBack = () => setActiveApp(null);

  return (
    <div className="px-4 py-4">
      {activeApp === null && (
        <AnalyticsAppGrid
          ctx={ctx}
          activeApp={activeApp}
          onSelect={setActiveApp}
        />
      )}

      {activeApp === "simulation" && (
        <SimulationApp ctx={ctx} onBack={handleBack} />
      )}

      {activeApp === "live-prediction" && (
        <LivePredictionApp ctx={ctx} onBack={handleBack} />
      )}
    </div>
  );
}
