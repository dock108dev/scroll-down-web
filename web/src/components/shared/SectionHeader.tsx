"use client";

import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  count?: number;
  sticky?: boolean;
  stickyTop?: string;
}

export function SectionHeader({
  title,
  expanded,
  onToggle,
  count,
  sticky = true,
  stickyTop = "var(--header-h)",
}: SectionHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className={cn(
        "flex w-full items-center gap-2 px-4 py-3 text-[15px] font-bold text-neutral-200 bg-neutral-900/80 backdrop-blur-sm",
        sticky && "sticky z-20 border-y border-neutral-800",
      )}
      style={sticky ? { top: stickyTop } : undefined}
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
