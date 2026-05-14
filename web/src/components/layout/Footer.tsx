import Link from "next/link";

const LEGAL_LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
];

export function Footer() {
  return (
    <footer className="hidden md:block border-t border-neutral-800 bg-neutral-950 mt-auto pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="grid grid-cols-2 gap-8">
          <div>
            <p className="text-sm font-semibold text-neutral-200">
              Scroll Down MLB
            </p>
            <p className="mt-2 text-xs text-neutral-500 leading-relaxed max-w-xs">
              Catch up on MLB games on your own time. Today&apos;s schedule and
              the prior 48 hours, with spoiler-free play-by-play timelines.
            </p>
            <p className="mt-3 text-[11px] text-neutral-500">
              Currently in beta &middot; v0.1.0
            </p>
          </div>

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
            &copy; {new Date().getFullYear()} Scroll Down MLB. All rights reserved.
            Data is delayed and provided for informational purposes only.
          </p>
        </div>
      </div>
    </footer>
  );
}
