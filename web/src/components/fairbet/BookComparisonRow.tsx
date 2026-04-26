"use client";

import type { BookPrice } from "@/lib/types";
import { useSettings } from "@/stores/settings";
import { formatOdds } from "@/lib/utils";
import { BookChip } from "./BookChip";

interface BookComparisonRowProps {
  books: BookPrice[];
  /** Compact chips (smaller padding, no logo). */
  compact?: boolean;
  /** Show only the best price chip; muted "+ N more" indicator follows. */
  bestOnly?: boolean;
}

export function BookComparisonRow({ books, compact, bestOnly }: BookComparisonRowProps) {
  const oddsFormat = useSettings((s) => s.oddsFormat);

  if (books.length === 0) return null;

  const sorted = [...books].sort((a, b) => b.price - a.price);
  const isSingleBook = sorted.length === 1;
  const visible = bestOnly ? sorted.slice(0, 1) : sorted;
  const hidden = sorted.length - visible.length;

  return (
    <div
      data-testid="book-comparison-row"
      className="flex items-center gap-1.5 overflow-x-auto pb-0.5"
      aria-label="Book comparison"
      style={{ scrollbarWidth: "none" } as React.CSSProperties}
    >
      {visible.map((bp, i) => (
        <BookChip
          key={bp.book}
          book={bp.book}
          price={formatOdds(bp.price, oddsFormat)}
          isBest={!isSingleBook && i === 0}
          compact={compact}
        />
      ))}
      {hidden > 0 && (
        <span className="text-[10px] text-neutral-500 shrink-0 px-1">
          +{hidden} more
        </span>
      )}
    </div>
  );
}
