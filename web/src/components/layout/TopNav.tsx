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
          <button
            onClick={openSettings}
            className="hover:text-neutral-50 transition"
          >
            Settings
          </button>
        </div>
      </nav>
    </header>
  );
}
