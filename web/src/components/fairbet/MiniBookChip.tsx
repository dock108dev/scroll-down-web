"use client";

import { cn } from "@/lib/utils";
import { FairBetTheme, bookAbbreviation } from "@/lib/theme";
import { formatEV } from "@/lib/fairbet-utils";

interface MiniBookChipProps {
  book: string;
  price: string;
  ev?: number;
  isSharp?: boolean;
}

export function MiniBookChip({ book, price, ev, isSharp }: MiniBookChipProps) {
  const evVal = ev ?? 0;
  const abbr = bookAbbreviation(book);

  // Background colours by EV tier — use real borders instead of box-shadow
  // so they don't get clipped near container edges
  let bgStyle: React.CSSProperties;
  if (evVal >= 5) {
    bgStyle = {
      backgroundColor: FairBetTheme.successSoft,
      borderColor: `${FairBetTheme.positive}33`,
    };
  } else if (evVal > 0) {
    bgStyle = {
      backgroundColor: FairBetTheme.successSoftMuted,
      borderColor: "transparent",
    };
  } else {
    bgStyle = {
      backgroundColor: "color-mix(in srgb, var(--fb-surface-secondary) 50%, transparent)",
      borderColor: "transparent",
    };
  }

  if (isSharp) {
    bgStyle.borderColor = `${FairBetTheme.info}50`;
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs max-w-full border"
      style={bgStyle}
    >
      <span className="text-[10px] font-medium text-neutral-500">
        {abbr}
      </span>
      <span className="font-bold text-neutral-50">{price}</span>
      {ev != null && (
        <span
          className="text-[10px] font-medium"
          style={{ color: evVal >= 5 ? FairBetTheme.positive : evVal > 0 ? FairBetTheme.positiveMuted : FairBetTheme.neutral }}
        >
          {formatEV(evVal)}
        </span>
      )}
    </span>
  );
}
