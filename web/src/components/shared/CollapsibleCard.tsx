"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface CollapsibleCardProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function CollapsibleCard({
  title,
  defaultOpen = false,
  children,
  className,
}: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      className={cn(
        "rounded-lg border border-neutral-800 bg-neutral-900 overflow-hidden",
        className,
      )}
    >
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-neutral-200 hover:bg-neutral-800/50 transition"
      >
        {title}
        <span
          className={cn(
            "text-xs text-neutral-500 transition-transform duration-200",
            open && "rotate-180",
          )}
        >
          ▼
        </span>
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4">{children}</div>
        </div>
      </div>
    </div>
  );
}
