"use client";

import { cn } from "@/lib/utils";
import { LEAGUE_OPTIONS } from "@/lib/constants";

interface LeagueFilterProps {
  selected: string;
  onChange: (league: string) => void;
}

export function LeagueFilter({ selected, onChange }: LeagueFilterProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <button
        onClick={() => onChange("")}
        className={cn(
          "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
          selected === ""
            ? "bg-neutral-50 text-neutral-950"
            : "bg-neutral-800 text-neutral-400 hover:text-neutral-50",
        )}
      >
        All
      </button>
      {LEAGUE_OPTIONS.map((league) => (
        <button
          key={league.code}
          onClick={() => onChange(league.code)}
          className={cn(
            "shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition",
            selected === league.code
              ? "bg-neutral-50 text-neutral-950"
              : "bg-neutral-800 text-neutral-400 hover:text-neutral-50",
          )}
        >
          {league.label}
        </button>
      ))}
    </div>
  );
}
