"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUI } from "@/stores/ui";
import { usePinnedGames } from "@/stores/pinned-games";
import { useAuth } from "@/stores/auth";
import { useFollowingLive } from "@/hooks/useFollowingLive";
import { useHealthDegraded } from "@/hooks/useHealthStatus";
import { LAYOUT } from "@/lib/config";
import { PinnedBar } from "@/components/home/PinnedBar";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Games" },
  { href: "/fairbet", label: "FairBet" },
  { href: "/analytics", label: "Analytics", adminOnly: true },
  { href: "/history", label: "History", adminOnly: true },
];

export function TopNav() {
  const pathname = usePathname();
  const openSettings = useUI((s) => s.openSettings);
  const hasPins = usePinnedGames((s) => s.pinnedIds.size > 0);
  const { followingLive, toggle: toggleLive, available: liveAvailable } = useFollowingLive();
  const isDegraded = useHealthDegraded();
  const token = useAuth((s) => s.token);
  const email = useAuth((s) => s.email);
  const role = useAuth((s) => s.role);

  const visibleLinks = NAV_LINKS.filter((l) => !l.adminOnly || role === "admin");

  // Update --header-h CSS variable when pin count changes
  useEffect(() => {
    document.documentElement.style.setProperty(
      "--header-h",
      hasPins ? LAYOUT.HEADER_HEIGHT_WITH_PINS : LAYOUT.HEADER_HEIGHT_DEFAULT,
    );
  }, [hasPins]);

  return (
    <header data-testid="top-nav" className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-7xl items-center px-4 xl:px-6">
        <Link href="/" className="flex items-center gap-2.5 min-h-[44px]">
          <Image
            src="/app-icon.png"
            alt="Scroll Down Sports"
            width={32}
            height={32}
            className="rounded-lg"
            priority
          />
          <span className="text-lg font-bold tracking-tight">
            Scroll Down Sports
          </span>
        </Link>
        <div className="ml-8 hidden md:flex gap-6 text-sm text-neutral-400">
          {visibleLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "hover:text-neutral-50 transition",
                pathname === link.href && "text-neutral-50",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex-1" />
        {liveAvailable && ["/", "/golf", "/fairbet"].includes(pathname) && (
          isDegraded ? (
            <span
              className="flex items-center gap-1.5 mr-3 px-3 py-2 min-h-[44px] rounded-full text-xs font-medium bg-neutral-800/60 text-neutral-500"
              aria-label="Live updates unavailable — server connection issue"
              title="Live updates unavailable"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-neutral-600 shrink-0" />
              <span>LIVE</span>
            </span>
          ) : (
            <button
              data-testid="live-toggle"
              onClick={toggleLive}
              className={cn(
                "flex items-center gap-2 mr-3 px-3 py-2 min-h-[44px] rounded-full text-xs font-medium transition",
                followingLive
                  ? "bg-green-600/20 text-green-400 hover:bg-green-600/30"
                  : "bg-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700",
              )}
              aria-label={followingLive ? "Following Live on — score hiding paused, click to turn off" : "Live scores off — click to follow live scores"}
              title={followingLive ? "Following live — score hiding paused" : "Click to follow live scores"}
            >
              <span
                className={cn(
                  "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
                  followingLive ? "bg-green-500" : "bg-neutral-600",
                )}
              >
                <span
                  className={cn(
                    "inline-block h-3 w-3 rounded-full bg-white transition-transform",
                    followingLive ? "translate-x-3.5" : "translate-x-0.5",
                  )}
                />
              </span>
              <span className="flex flex-col items-start leading-none">
                <span>LIVE</span>
                <span className={cn("text-[9px] font-normal", followingLive ? "text-green-400/70" : "text-neutral-500")}>
                  {followingLive ? "Scores visible" : "Updates paused"}
                </span>
              </span>
            </button>
          )
        )}
        {token ? (
          <Link
            href="/account"
            className="hidden md:flex items-center justify-center h-8 w-8 min-h-[44px] min-w-[44px] mr-2 rounded-full bg-blue-600 text-xs font-semibold text-white hover:bg-blue-500 transition"
            title={email ?? "Account"}
            data-testid="nav-account-link"
          >
            {(email?.[0] ?? "U").toUpperCase()}
          </Link>
        ) : (
          <Link
            href="/login"
            className="hidden md:flex items-center text-sm text-neutral-400 hover:text-neutral-50 mr-3 min-h-[44px] px-2 transition"
          >
            Log In
          </Link>
        )}
        <button
          onClick={openSettings}
          className="hidden md:flex items-center justify-center min-h-[44px] min-w-[44px] p-1.5 rounded-full text-neutral-400 hover:text-neutral-50 hover:bg-neutral-800 transition"
          title="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </nav>
      {hasPins && (
        <div className="border-t border-neutral-800/50">
          <div className="mx-auto max-w-7xl">
            <PinnedBar />
          </div>
        </div>
      )}
    </header>
  );
}
