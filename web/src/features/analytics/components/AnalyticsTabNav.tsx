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
  { label: "Models", href: "/analytics/models", minRole: "admin" },
  { label: "Batch Sims", href: "/analytics/batch", minRole: "admin" },
];

const ROLE_RANK = { guest: 0, user: 1, admin: 2 } as const;

export function AnalyticsTabNav() {
  const pathname = usePathname();
  const role = useAuth((s) => s.role);

  return (
    <nav className="flex gap-1 overflow-x-auto scrollbar-none border-b border-neutral-800 pb-px">
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        const locked = ROLE_RANK[role] < ROLE_RANK[tab.minRole];
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`shrink-0 px-3 py-2 text-sm font-medium rounded-t-md transition-colors flex items-center gap-1.5 ${
              active
                ? "text-neutral-50 border-b-2 border-blue-500"
                : locked
                  ? "text-neutral-600 hover:text-neutral-500"
                  : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            {tab.label}
            {locked && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
