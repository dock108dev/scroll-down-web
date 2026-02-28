"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUI } from "@/stores/ui";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Games", icon: "🏟" },
  { href: "/fairbet", label: "FairBet", icon: "📊" },
];

export function BottomTabs() {
  const pathname = usePathname();
  const openSettings = useUI((s) => s.openSettings);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur md:hidden">
      <div className="flex h-16 items-center justify-around">
        {TABS.map((tab) => {
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-1 text-xs transition",
                isActive ? "text-neutral-50" : "text-neutral-500",
              )}
            >
              <span className="text-lg">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
        <button
          onClick={openSettings}
          className="flex flex-col items-center gap-1 text-xs text-neutral-500 transition"
        >
          <span className="text-lg">&#9881;</span>
          Settings
        </button>
      </div>
    </nav>
  );
}
