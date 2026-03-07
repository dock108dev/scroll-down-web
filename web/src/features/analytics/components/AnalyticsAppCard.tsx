"use client";

import { cn } from "@/lib/utils";

interface AnalyticsAppCardProps {
  title: string;
  description: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}

export function AnalyticsAppCard({
  title,
  description,
  disabled,
  active,
  onClick,
}: AnalyticsAppCardProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "card w-full text-left px-4 py-3 transition-colors",
        active && "ring-1 ring-neutral-500",
        disabled
          ? "opacity-40 cursor-not-allowed"
          : "hover:bg-neutral-800/60 cursor-pointer",
      )}
    >
      <div className="text-sm font-medium text-neutral-200">{title}</div>
      <div className="text-xs text-neutral-500 mt-0.5">{description}</div>
      {disabled && (
        <div className="text-[10px] text-neutral-600 mt-1 italic">
          Coming soon
        </div>
      )}
    </button>
  );
}
