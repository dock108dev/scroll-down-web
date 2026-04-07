"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/stores/auth";

interface Tab {
  label: string;
  href: string;
  minRole: "guest" | "user" | "admin";
}

const TABS: Tab[] = [
  { label: "Simulator", href: "/analytics/simulator", minRole: "guest" },
  { label: "Profiles", href: "/analytics/profiles", minRole: "user" },
  { label: "Models", href: "/analytics/models", minRole: "user" },
  { label: "Batch Sims", href: "/analytics/batch", minRole: "user" },
];

const ROLE_RANK = { guest: 0, user: 1, admin: 2 } as const;

export function AnalyticsTabNav() {
  const pathname = usePathname();
  const role = useAuth((s) => s.role);

  return (
    <div className="relative">
      <nav className="flex gap-1 overflow-x-auto scrollbar-none border-b border-neutral-800 pb-px pr-6">
        {TABS.filter((tab) => ROLE_RANK[role] >= ROLE_RANK[tab.minRole]).map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`shrink-0 px-3 py-2 min-h-[44px] text-sm font-medium rounded-t-md transition-colors flex items-center gap-1.5 ${
                active
                  ? "text-neutral-50 border-b-2 border-blue-500"
                  : "text-neutral-500 hover:text-neutral-300"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
      {/* Fade indicator for scrollable overflow */}
      <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-neutral-950 to-transparent pointer-events-none" />
    </div>
  );
}
