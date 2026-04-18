"use client";

import type { BookPrice } from "@/lib/types";
import { useSettings } from "@/stores/settings";
import { formatOdds } from "@/lib/utils";
import { BookChip } from "./BookChip";

interface BookComparisonRowProps {
  books: BookPrice[];
}

export function BookComparisonRow({ books }: BookComparisonRowProps) {
  const oddsFormat = useSettings((s) => s.oddsFormat);

  if (books.length === 0) return null;

  // Higher American odds = more favorable for bettor
  const sorted = [...books].sort((a, b) => b.price - a.price);
  const isSingleBook = sorted.length === 1;

  return (
    <div
      data-testid="book-comparison-row"
      className="flex gap-2 overflow-x-auto pb-0.5"
      aria-label="Book comparison"
      style={{ scrollbarWidth: "none" } as React.CSSProperties}
    >
      {sorted.map((bp, i) => (
        <BookChip
          key={bp.book}
          book={bp.book}
          price={formatOdds(bp.price, oddsFormat)}
          isBest={!isSingleBook && i === 0}
        />
      ))}
    </div>
  );
}
