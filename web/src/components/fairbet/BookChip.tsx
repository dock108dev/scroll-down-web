"use client";

import { bookSlug } from "@/lib/theme";
import { FairBetTheme } from "@/lib/theme";

interface BookChipProps {
  book: string;
  price: string;
  isBest?: boolean;
}

export function BookChip({ book, price, isBest }: BookChipProps) {
  const slug = bookSlug(book);

  return (
    <span
      data-testid={`book-chip-${slug}`}
      className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 shrink-0 border"
      style={
        isBest
          ? {
              backgroundColor: "var(--fb-surface-tint)",
              borderColor: FairBetTheme.positive,
              borderWidth: "1.5px",
            }
          : {
              backgroundColor: "var(--fb-surface-secondary)",
              borderColor: "var(--fb-border-subtle)",
              borderWidth: "1px",
            }
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
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
      <span
        className="text-xs font-bold"
        style={{ color: isBest ? FairBetTheme.positive : "var(--ds-text-primary)" }}
      >
        {price}
      </span>
    </span>
  );
}
