"use client";

import { AnalyticsAppCard } from "./components/AnalyticsAppCard";
import type { AnalyticsAppDef, AnalyticsGameContext } from "./types";

const APPS: AnalyticsAppDef[] = [
  {
    id: "simulation",
    title: "Alternate Game Universes",
    description:
      "Explore thousands of simulated game outcomes.",
    leagues: ["mlb", "nba", "nhl", "ncaab"],
    requiresLive: false,
  },
  {
    id: "live-prediction",
    title: "What Happens Next",
    description:
      "Predict the next pitch or play using live game data.",
    leagues: ["mlb"],
    requiresLive: true,
  },
  {
    id: "matchup",
    title: "Matchup Explorer",
    description:
      "See strengths and weaknesses of each team.",
    leagues: ["mlb", "nba", "nhl", "ncaab"],
    requiresLive: false,
  },
  {
    id: "player-projections",
    title: "Player Projections",
    description:
      "Forecast player performance for this game.",
    leagues: ["mlb", "nba", "nhl", "ncaab"],
    requiresLive: false,
  },
];

interface AnalyticsAppGridProps {
  ctx: AnalyticsGameContext;
  activeApp: string | null;
  onSelect: (id: string) => void;
}

export function AnalyticsAppGrid({
  ctx,
  activeApp,
  onSelect,
}: AnalyticsAppGridProps) {
  const league = ctx.leagueCode.toLowerCase();

  return (
    <div className="space-y-2">
      <h3 className="text-section-header">Available Tools</h3>
      <div className="grid gap-2">
        {APPS.map((app) => {
          const supported = app.leagues.includes(league);
          const liveDisabled = app.requiresLive && !ctx.isLive;
          const implemented = app.id === "simulation" || app.id === "live-prediction";
          const disabled = !supported || !implemented || liveDisabled;

          return (
            <AnalyticsAppCard
              key={app.id}
              title={app.title}
              description={
                liveDisabled && supported && implemented
                  ? "Available during live games."
                  : app.description
              }
              disabled={disabled}
              active={activeApp === app.id}
              onClick={() => onSelect(app.id)}
            />
          );
        })}
      </div>
    </div>
  );
}
