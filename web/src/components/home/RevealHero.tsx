"use client";

import { useSettings } from "@/stores/settings";
import { HOME_COPY } from "./copy";

export function RevealHero() {
  const scoreRevealMode = useSettings((s) => s.scoreRevealMode);
  const followingLive = useSettings((s) => s.followingLive);
  const hiddenLeagueCount = useSettings((s) => s.scoreHideLeagues.length);
  const hiddenTeamCount = useSettings((s) => s.scoreHideTeams.length);

  if (followingLive || scoreRevealMode === "always") return null;

  const blacklistHasRules = hiddenLeagueCount + hiddenTeamCount > 0;
  const copy = scoreRevealMode === "blacklist"
    ? blacklistHasRules
      ? HOME_COPY.revealHero.blacklistWithRules
      : HOME_COPY.revealHero.blacklistEmpty
    : HOME_COPY.revealHero.default;

  return (
    <div
      data-testid="reveal-hero"
      className="px-4 py-2.5 flex items-center gap-2.5 border-b border-neutral-800/40"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="shrink-0 text-neutral-500"
        aria-hidden="true"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
      <p className="text-xs text-neutral-500 leading-snug">
        <span className="font-medium text-neutral-300">{copy.lead}</span>
        {" "}{copy.body}
      </p>
    </div>
  );
}
