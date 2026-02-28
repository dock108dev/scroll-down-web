"use client";

import type { OddsEntry } from "@/lib/types";
import { useSettings } from "@/stores/settings";
import { formatOdds, cn } from "@/lib/utils";
import { bookAbbreviation } from "@/lib/theme";

interface OddsTableProps {
  odds: OddsEntry[];
  /** Group related sides together (e.g., Home Spread / Away Spread) */
  groupSides?: boolean;
  /** Show player names prominently in the first column */
  showPlayerNames?: boolean;
  /** Team names for context in labels */
  homeTeam?: string;
  awayTeam?: string;
}

/** Build a row key from an odds entry */
function rowKey(o: OddsEntry): string {
  return `${o.marketType}|${o.side ?? ""}|${o.line ?? ""}|${o.playerName ?? ""}`;
}

/** Map player prop marketType to a short stat label */
const PLAYER_STAT_LABELS: Record<string, string> = {
  player_points: "Pts",
  player_rebounds: "Reb",
  player_assists: "Ast",
  player_threes: "3PM",
  player_blocks: "Blk",
  player_steals: "Stl",
  player_goals: "Goals",
  player_shots_on_goal: "SOG",
  player_total_saves: "Saves",
  player_pra: "PRA",
};

/** Format a line value with +/- prefix */
function formatLine(line: number): string {
  return `${line > 0 ? "+" : ""}${line}`;
}

/** Build a display label from an OddsEntry */
function buildLabel(entry: OddsEntry, showPlayerNames?: boolean): string {
  if (showPlayerNames && entry.playerName) {
    // Player prop: Name + stat category + line
    const stat = PLAYER_STAT_LABELS[entry.marketType] ?? entry.marketType.replace(/^player_/, "").replace(/_/g, " ");
    const line = entry.line != null ? ` ${formatLine(entry.line)}` : "";
    return `${entry.playerName} ${stat}${line}`;
  }

  const side = entry.side ?? "";
  const line = entry.line != null ? ` ${formatLine(entry.line)}` : "";

  // Use API description when available — it typically has the best context
  if (entry.description) {
    return entry.description;
  }

  // For spread/moneyline/alternates: section header already says the market type,
  // so just show side (team name) + line
  if (["spread", "moneyline", "alternate_spread", "alternate_total"].includes(entry.marketType)) {
    return `${side}${line}`.trim();
  }

  // For totals / team_total: "Over/Under + line"
  if (entry.marketType === "total" || entry.marketType === "team_total") {
    return `${side}${line}`.trim();
  }

  // Fallback
  const mt = entry.marketType.replace(/_/g, " ");
  return `${side} ${mt}${line}`.trim();
}

/** Find the best price in a set of entries using API isBest flag. */
function findBestPrice(entries: OddsEntry[]): number | null {
  const apiBest = entries.find((e) => e.isBest && e.price != null);
  return apiBest?.price ?? null;
}

/** Group rows into side pairs for mainline markets */
function groupIntoPairs(
  rows: [string, OddsEntry[]][],
): [string, OddsEntry[]][][] {
  // Group by marketType+line (ignoring side)
  const pairMap: Record<string, [string, OddsEntry[]][]> = {};

  for (const row of rows) {
    const first = row[1][0];
    const pairKey = `${first.marketType}|${first.line ?? ""}`;
    if (!pairMap[pairKey]) pairMap[pairKey] = [];
    pairMap[pairKey].push(row);
  }

  return Object.values(pairMap);
}

export function OddsTable({ odds, groupSides, showPlayerNames }: OddsTableProps) {
  const oddsFormat = useSettings((s) => s.oddsFormat);
  const preferredBook = useSettings((s) => s.preferredSportsbook);

  // Collect unique books in the data
  const books = Array.from(new Set(odds.map((o) => o.book)));

  // Group odds by row key
  const rowMap: Record<string, OddsEntry[]> = {};
  for (const o of odds) {
    const key = rowKey(o);
    if (!rowMap[key]) rowMap[key] = [];
    rowMap[key].push(o);
  }

  // Drop rows that only have closing-line data and no actual book prices
  const allRows = Object.entries(rowMap).filter(([, entries]) =>
    entries.some((e) => !e.isClosingLine && e.price != null),
  );

  // Optionally group into side pairs for mainline
  const pairs = groupSides ? groupIntoPairs(allRows) : allRows.map((r) => [r]);

  // Check if there are any closing line entries
  const hasClosingLines = odds.some((o) => o.isClosingLine);

  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-800">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-neutral-800/50 text-neutral-500">
            <th className="text-left px-3 py-2 font-medium sticky left-0 z-10 bg-neutral-800/90 backdrop-blur-sm min-w-[160px]">
              Market
            </th>
            {books.map((book) => {
              const abbr = bookAbbreviation(book);
              const isPreferred =
                preferredBook !== "" &&
                book.toLowerCase().replace(/\s+/g, "") === preferredBook;
              return (
                <th
                  key={book}
                  className={cn(
                    "text-center px-2 py-2 font-medium whitespace-nowrap",
                    isPreferred && "text-blue-400",
                  )}
                >
                  {abbr}
                </th>
              );
            })}
            {hasClosingLines && (
              <th className="text-center px-2 py-2 font-medium text-amber-500/70 whitespace-nowrap bg-neutral-800/80">
                CL
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {pairs.map((pair, pairIdx) => (
            <PairGroup
              key={pairIdx}
              rows={pair as [string, OddsEntry[]][]}
              books={books}
              oddsFormat={oddsFormat}
              preferredBook={preferredBook}
              showPlayerNames={showPlayerNames}
              hasClosingLines={hasClosingLines}
              isFirstPair={pairIdx === 0}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PairGroup({
  rows,
  books,
  oddsFormat,
  preferredBook,
  showPlayerNames,
  hasClosingLines,
  isFirstPair,
}: {
  rows: [string, OddsEntry[]][];
  books: string[];
  oddsFormat: "american" | "decimal" | "fractional";
  preferredBook: string;
  showPlayerNames?: boolean;
  hasClosingLines: boolean;
  isFirstPair: boolean;
}) {
  return (
    <>
      {rows.map(([key, entries], rowIdx) => {
        const first = entries[0];
        const bestPrice = findBestPrice(entries);
        const closingEntry = entries.find((e) => e.isClosingLine);

        const label = buildLabel(first, showPlayerNames);

        return (
          <tr
            key={key}
            className={cn(
              "text-neutral-300",
              // Add border between pair groups, not between paired rows
              rowIdx === 0 && !isFirstPair
                ? "border-t border-neutral-800/50"
                : rowIdx > 0
                  ? "border-t border-neutral-800/20"
                  : !isFirstPair
                    ? "border-t border-neutral-800/50"
                    : "",
            )}
          >
            <td
              className={cn(
                "px-3 py-1.5 sticky left-0 z-10 bg-neutral-900",
                showPlayerNames && first.playerName
                  ? "font-medium text-neutral-100"
                  : "truncate max-w-[260px]",
              )}
            >
              <span className="truncate block max-w-[260px]">{label}</span>
            </td>
            {books.map((book) => {
              const entry = entries.find(
                (e) => e.book === book && !e.isClosingLine,
              );
              const price = entry?.price;
              const isBest = price != null && bestPrice != null && price === bestPrice;
              const isPreferred =
                preferredBook !== "" &&
                book.toLowerCase().replace(/\s+/g, "") === preferredBook;

              return (
                <td
                  key={book}
                  className={cn(
                    "text-center px-2 py-1.5 tabular-nums whitespace-nowrap",
                    isBest && "text-green-400 bg-green-500/10",
                    isPreferred && !isBest && "bg-blue-500/5",
                  )}
                >
                  {price != null ? formatOdds(price, oddsFormat) : (
                    <span className="text-neutral-600">&mdash;</span>
                  )}
                </td>
              );
            })}
            {hasClosingLines && (
              <td className="text-center px-2 py-1.5 tabular-nums whitespace-nowrap bg-neutral-800/30">
                {closingEntry?.price != null ? (
                  <span className="text-amber-400/80">
                    {formatOdds(closingEntry.price, oddsFormat)}
                    <span className="ml-0.5 text-[9px] align-super text-amber-500/60">
                      CL
                    </span>
                  </span>
                ) : (
                  <span className="text-neutral-600">&mdash;</span>
                )}
              </td>
            )}
          </tr>
        );
      })}
    </>
  );
}
