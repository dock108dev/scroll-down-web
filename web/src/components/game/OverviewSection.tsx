"use client";

import type { GameDetailResponse, OddsEntry } from "@/lib/types";
import { useSettings } from "@/stores/settings";
import { formatOdds, formatDate, formatTime, cn } from "@/lib/utils";
import { SocialSection } from "./SocialSection";

interface OverviewSectionProps {
  data: GameDetailResponse;
}

/** Get the best opening line for a market+side */
function getBestLine(
  odds: OddsEntry[],
  marketType: string,
  side: string,
): OddsEntry | undefined {
  return odds
    .filter(
      (o) =>
        o.marketType === marketType &&
        o.side === side &&
        !o.isClosingLine &&
        o.price != null,
    )
    .sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity))[0];
}

export function OverviewSection({ data }: OverviewSectionProps) {
  const game = data.game;
  const odds = data.odds;
  const metrics = data.derivedMetrics;
  const oddsFormat = useSettings((s) => s.oddsFormat);

  // Pregame odds: spread, moneyline, total
  const homeSpread = getBestLine(odds, "spread", "home");
  const awaySpread = getBestLine(odds, "spread", "away");
  const homeML = getBestLine(odds, "moneyline", "home");
  const awayML = getBestLine(odds, "moneyline", "away");
  const over = getBestLine(odds, "total", "over");
  const under = getBestLine(odds, "total", "under");

  const hasOdds =
    homeSpread || awaySpread || homeML || awayML || over || under;

  // Derived metrics for pregame display
  const metricSpread =
    metrics && typeof metrics.spread === "string"
      ? (metrics.spread as string)
      : null;
  const metricTotal =
    metrics && typeof metrics.total === "string"
      ? (metrics.total as string)
      : null;

  return (
    <div className="px-4 space-y-4">
      {/* Game Info Card */}
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-neutral-500 mb-0.5">Date</div>
            <div className="text-neutral-200">{formatDate(game.gameDate)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500 mb-0.5">Time</div>
            <div className="text-neutral-200">{formatTime(game.gameDate)}</div>
          </div>
          <div>
            <div className="text-xs text-neutral-500 mb-0.5">League</div>
            <div className="text-neutral-200 uppercase font-medium">
              {game.leagueCode}
            </div>
          </div>
          {game.season && (
            <div>
              <div className="text-xs text-neutral-500 mb-0.5">Season</div>
              <div className="text-neutral-200">
                {game.season}
                {game.seasonType ? ` ${game.seasonType}` : ""}
              </div>
            </div>
          )}
        </div>

        {/* Data Availability Indicators */}
        <div>
          <div className="text-xs text-neutral-500 mb-2">Data Available</div>
          <div className="flex flex-wrap gap-2">
            <DataBadge label="Box Score" available={game.hasBoxscore} />
            <DataBadge label="Odds" available={game.hasOdds} />
            <DataBadge label="PBP" available={game.hasPbp} />
            <DataBadge label="Social" available={game.hasSocial} />
            <DataBadge label="Flow" available={game.hasFlow} />
            <DataBadge label="Player Stats" available={game.hasPlayerStats} />
          </div>
        </div>
      </div>

      {/* Pregame Odds */}
      {hasOdds && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
            Pregame Odds
          </h3>
          <div className="space-y-3">
            {/* Spread */}
            {(homeSpread || awaySpread) && (
              <OddsRow
                label="Spread"
                items={[
                  {
                    team: game.awayTeamAbbr ?? game.awayTeam,
                    line: awaySpread?.line,
                    price: awaySpread?.price,
                    oddsFormat,
                  },
                  {
                    team: game.homeTeamAbbr ?? game.homeTeam,
                    line: homeSpread?.line,
                    price: homeSpread?.price,
                    oddsFormat,
                  },
                ]}
              />
            )}

            {/* Moneyline */}
            {(homeML || awayML) && (
              <OddsRow
                label="Moneyline"
                items={[
                  {
                    team: game.awayTeamAbbr ?? game.awayTeam,
                    price: awayML?.price,
                    oddsFormat,
                  },
                  {
                    team: game.homeTeamAbbr ?? game.homeTeam,
                    price: homeML?.price,
                    oddsFormat,
                  },
                ]}
              />
            )}

            {/* Total */}
            {(over || under) && (
              <OddsRow
                label="Total"
                items={[
                  {
                    team: "Over",
                    line: over?.line,
                    price: over?.price,
                    oddsFormat,
                  },
                  {
                    team: "Under",
                    line: under?.line,
                    price: under?.price,
                    oddsFormat,
                  },
                ]}
              />
            )}
          </div>
        </div>
      )}

      {/* Derived metrics summary if present */}
      {(metricSpread || metricTotal) && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
            Consensus
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {metricSpread && (
              <div>
                <div className="text-xs text-neutral-500 mb-0.5">Spread</div>
                <div className="text-neutral-200 font-mono">
                  {metricSpread}
                </div>
              </div>
            )}
            {metricTotal && (
              <div>
                <div className="text-xs text-neutral-500 mb-0.5">Total</div>
                <div className="text-neutral-200 font-mono">{metricTotal}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pregame Social Posts */}
      <SocialSection posts={data.socialPosts} phase="pregame" outcomeRevealed={false} />
    </div>
  );
}

function DataBadge({
  label,
  available,
}: {
  label: string;
  available?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        available
          ? "bg-green-500/10 text-green-400 border border-green-500/20"
          : "bg-neutral-800 text-neutral-500 border border-neutral-700/50",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          available ? "bg-green-400" : "bg-neutral-600",
        )}
      />
      {label}
    </span>
  );
}

function OddsRow({
  label,
  items,
}: {
  label: string;
  items: {
    team: string;
    line?: number | null;
    price?: number | null;
    oddsFormat: "american" | "decimal" | "fractional";
  }[];
}) {
  return (
    <div>
      <div className="text-xs text-neutral-500 mb-1.5">{label}</div>
      <div className="grid grid-cols-2 gap-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-between bg-neutral-800/50 rounded-lg px-3 py-2"
          >
            <span className="text-xs text-neutral-300 font-medium">
              {item.team}
            </span>
            <span className="text-xs font-mono text-neutral-100">
              {item.line != null && (
                <span className="text-neutral-400 mr-1">
                  {item.line > 0 ? "+" : ""}
                  {item.line}
                </span>
              )}
              {item.price != null ? (
                <span>{formatOdds(item.price, item.oddsFormat)}</span>
              ) : (
                <span className="text-neutral-600">&mdash;</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
