"use client";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Search teams...",
}: SearchBarProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2 text-sm text-neutral-50 placeholder-neutral-500 outline-none focus:border-neutral-600 transition"
    />
  );
}
