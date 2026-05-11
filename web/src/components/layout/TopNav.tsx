"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { LAYOUT } from "@/lib/config";

export function TopNav() {
  useEffect(() => {
    document.documentElement.style.setProperty("--header-h", LAYOUT.HEADER_HEIGHT_DEFAULT);
  }, []);

  return (
    <header
      data-testid="top-nav"
      className="sticky top-0 z-40 border-b border-[rgba(245,239,220,0.12)] bg-[#050807]/85 text-[#f5efdc] backdrop-blur"
    >
      <nav className="mx-auto flex h-14 max-w-3xl items-center px-4">
        <Link href="/" className="flex items-center gap-2.5 min-h-[44px] text-[#f5efdc]">
          <Image
            src="/app-icon.png"
            alt="Scroll Down MLB"
            width={28}
            height={28}
            className="rounded-md"
            priority
          />
          <span className="text-base font-bold tracking-tight">Scroll Down MLB</span>
        </Link>
        <div className="flex-1" />
        <Link
          href="/settings"
          className="flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full text-[rgba(245,239,220,0.55)] hover:text-[#f5efdc] hover:bg-[rgba(245,239,220,0.06)] transition"
          aria-label="Settings"
          title="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </nav>
    </header>
  );
}
