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

  // Background colours by EV tier
  let bgStyle: React.CSSProperties;
  if (evVal >= 5) {
    bgStyle = {
      backgroundColor: FairBetTheme.successSoft,
      borderColor: `${FairBetTheme.positive}33`,
      borderWidth: 1,
      borderStyle: "solid",
    };
  } else if (evVal > 0) {
    bgStyle = {
      backgroundColor: FairBetTheme.successSoftMuted,
    };
  } else {
    bgStyle = {
      backgroundColor: "color-mix(in srgb, var(--fb-surface-secondary) 50%, transparent)",
    };
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
        isSharp && "ring-1",
      )}
      style={{
        ...bgStyle,
        ...(isSharp ? { boxShadow: `0 0 0 1px ${FairBetTheme.info}50` } : {}),
      }}
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
