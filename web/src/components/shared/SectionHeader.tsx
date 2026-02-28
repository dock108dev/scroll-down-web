"use client";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  count?: number;
  sticky?: boolean;
}

export function SectionHeader({
  title,
  expanded,
  onToggle,
  count,
  sticky = true,
}: SectionHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 px-4 py-3 text-sm font-semibold text-neutral-300 bg-neutral-950",
        sticky && "sticky z-20",
      )}
      style={sticky ? { top: "var(--header-h)" } : undefined}
    >
      <span
        className={cn(
          "text-xs transition-transform duration-200",
          expanded ? "rotate-90" : "rotate-0",
        )}
      >
        ▶
      </span>
      {title}
      {count !== undefined && (
        <span className="text-xs text-neutral-500">({count})</span>
      )}
    </button>
  );
}
