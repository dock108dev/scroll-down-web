"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUI } from "@/stores/ui";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/", label: "Games" },
  { href: "/fairbet", label: "FairBet" },
];

export function TopNav() {
  const pathname = usePathname();
  const openSettings = useUI((s) => s.openSettings);

  return (
    <header className="sticky top-0 z-50 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-7xl items-center px-4 xl:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image
            src="/app-icon.png"
            alt="Scroll Down Sports"
            width={32}
            height={32}
            className="rounded-lg"
          />
          <span className="text-lg font-bold tracking-tight">
            Scroll Down Sports
          </span>
        </Link>
        <div className="ml-8 hidden md:flex gap-6 text-sm text-neutral-400">
          {NAV_LINKS.map((link) => (
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
        <button
          onClick={openSettings}
          className="hidden md:flex p-1.5 rounded-full text-neutral-400 hover:text-neutral-50 hover:bg-neutral-800 transition"
          title="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </nav>
    </header>
  );
}
