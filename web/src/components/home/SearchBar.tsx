"use client";

import { cn } from "@/lib/utils";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search teams...",
  disabled = false,
}: SearchBarProps) {
  return (
    <input
      data-testid="search-bar"
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={disabled ? "Search unavailable right now" : placeholder}
      disabled={disabled}
      className={cn(
        "w-full rounded-lg border px-4 py-2 text-sm outline-none transition",
        disabled
          ? "border-neutral-700 bg-neutral-800/50 text-neutral-600 placeholder-neutral-600 cursor-not-allowed"
          : "border-neutral-800 bg-neutral-900 text-neutral-50 placeholder-neutral-500 focus:border-neutral-600",
      )}
    />
  );
}
