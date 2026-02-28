"use client";

import type { GameDetailResponse, OddsEntry } from "@/lib/types";
import { useSettings } from "@/stores/settings";
import { formatOdds } from "@/lib/utils";
import { SocialSection } from "./SocialSection";

interface PregameBuzzSectionProps {
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

export function PregameBuzzSection({ data }: PregameBuzzSectionProps) {
  const game = data.game;
  const odds = data.odds;
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

  const hasPregamePosts = data.socialPosts?.some(
    (p) =>
      p.gamePhase === "pregame" &&
      (p.tweetText || p.imageUrl || p.videoUrl) &&
      p.revealLevel !== "post",
  );

  if (!hasOdds && !hasPregamePosts) return null;

  return (
    <div className="px-4 space-y-4">
      {/* Lines */}
      {hasOdds && (
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-4">
          <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">
            Lines
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

      {/* Pregame Social Posts */}
      <SocialSection posts={data.socialPosts} phase="pregame" outcomeRevealed={false} />
    </div>
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
            <span className="text-xs tabular-nums text-neutral-100">
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
