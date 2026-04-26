"use client";

import { bookSlug } from "@/lib/theme";
import { FairBetTheme } from "@/lib/theme";

interface BookChipProps {
  book: string;
  price: string;
  isBest?: boolean;
  compact?: boolean;
}

export function BookChip({ book, price, isBest, compact }: BookChipProps) {
  const slug = bookSlug(book);
  const showLogo = !compact;

  return (
    <span
      data-testid={`book-chip-${slug}`}
      className={
        compact
          ? "inline-flex items-center gap-1 rounded px-1.5 py-0.5 shrink-0 border text-[10px]"
          : "inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 shrink-0 border"
      }
      style={
        isBest
          ? {
              backgroundColor: "var(--fb-surface-tint)",
              borderColor: `${FairBetTheme.positive}80`,
              borderWidth: compact ? "1px" : "1.5px",
            }
          : {
              backgroundColor: "var(--fb-surface-secondary)",
              borderColor: "var(--fb-border-subtle)",
              borderWidth: "1px",
            }
      }
    >
      {showLogo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/books/${slug}.svg`}
          alt={book}
          width={28}
          height={16}
          className="shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none";
          }}
        />
      )}
      {compact && (
        <span className="font-medium uppercase tracking-tight" style={{ color: "var(--ds-text-tertiary)" }}>
          {bookAbbr(book)}
        </span>
      )}
      <span
        className={compact ? "font-bold" : "text-xs font-bold"}
        style={{ color: isBest ? FairBetTheme.positive : "var(--ds-text-primary)" }}
      >
        {price}
      </span>
    </span>
  );
}

function bookAbbr(book: string): string {
  const s = book.toLowerCase();
  if (s.includes("draftkings")) return "DK";
  if (s.includes("fanduel")) return "FD";
  if (s.includes("caesars")) return "CZR";
  if (s.includes("betmgm")) return "MGM";
  if (s.includes("betrivers")) return "BR";
  if (s.includes("pinnacle")) return "PIN";
  if (s.includes("pointsbet")) return "PB";
  return book.slice(0, 3).toUpperCase();
}
