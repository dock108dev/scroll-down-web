import Link from "next/link";

const PRODUCT_LINKS = [
  { href: "/", label: "Games" },
  { href: "/golf", label: "Golf" },
  { href: "/fairbet", label: "FairBet" },
  { href: "/analytics", label: "Analytics" },
];

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function Footer() {
  return (
    <footer className="hidden md:block border-t border-neutral-800 bg-neutral-950 mt-auto">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-3 gap-8">
          {/* Brand */}
          <div>
            <p className="text-sm font-semibold text-neutral-200">
              Scroll Down Sports
            </p>
            <p className="mt-2 text-xs text-neutral-500 leading-relaxed max-w-xs">
              Catch up on games without spoilers. Real-time scores, play-by-play
              timelines, betting analytics, and matchup simulators for MLB, NBA,
              NHL, and NCAAB.
            </p>
            <p className="mt-3 text-[11px] text-neutral-500">
              Currently in beta &middot; v0.1.0
            </p>
          </div>

          {/* Product */}
          <div>
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
              Product
            </p>
            <ul className="space-y-1">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center min-h-[44px] text-sm text-neutral-500 hover:text-neutral-200 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal & Support */}
          <div>
            <p className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-3">
              Support
            </p>
            <ul className="space-y-1">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex items-center min-h-[44px] text-sm text-neutral-500 hover:text-neutral-200 transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/contact"
                  className="inline-flex items-center min-h-[44px] text-sm text-neutral-500 hover:text-neutral-200 transition-colors"
                >
                  Contact
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-neutral-800/50 text-center">
          <p className="text-[11px] text-neutral-500">
            &copy; {new Date().getFullYear()} Scroll Down Sports. All rights reserved.
            Data is delayed and provided for informational purposes only.
            Not financial advice. Gamble responsibly.
          </p>
        </div>
      </div>
    </footer>
  );
}
