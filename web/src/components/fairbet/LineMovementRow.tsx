import { formatOdds } from "@/lib/utils";
import { FairBetTheme } from "@/lib/theme";
import type { OddsFormat } from "@/lib/types";

interface LineMovementRowProps {
  openingLine: number;
  currentLine: number;
  oddsFormat: OddsFormat;
  isPro: boolean;
}

function movementColor(opening: number, current: number): string {
  if (current > opening) return FairBetTheme.positive;
  if (current < opening) return FairBetTheme.negative;
  return "var(--ds-text-tertiary)";
}

function movementArrow(opening: number, current: number): string {
  if (current > opening) return "↑";
  if (current < opening) return "↓";
  return "";
}

export function LineMovementRow({
  openingLine,
  currentLine,
  oddsFormat,
  isPro,
}: LineMovementRowProps) {
  const color = movementColor(openingLine, currentLine);
  const arrow = movementArrow(openingLine, currentLine);
  const openStr = formatOdds(openingLine, oddsFormat);
  const nowStr = formatOdds(currentLine, oddsFormat);

  const direction =
    currentLine > openingLine
      ? "up"
      : currentLine < openingLine
        ? "down"
        : "flat";

  const inner = (
    <div
      data-testid="line-movement-row"
      data-direction={direction}
      className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg"
      style={{ backgroundColor: "var(--fb-surface-tint)" }}
    >
      <span className="text-neutral-500">Opened:</span>
      <span className="font-medium text-neutral-400">{openStr}</span>
      <span className="text-neutral-500">→ Now:</span>
      <span className="font-bold text-neutral-50">{nowStr}</span>
      {arrow && (
        <span
          data-testid="line-movement-arrow"
          className="font-bold"
          style={{ color }}
        >
          {arrow}
        </span>
      )}
    </div>
  );

  if (!isPro) {
    return (
      <div data-testid="line-movement-gated" className="relative overflow-hidden rounded-lg">
        <div className="blur-sm select-none pointer-events-none">{inner}</div>
      </div>
    );
  }

  return inner;
}
