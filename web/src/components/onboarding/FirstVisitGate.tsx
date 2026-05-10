"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useOnboarding } from "@/stores/onboarding";
import { useGamesList } from "@/hooks/useGamesList";
import { TeamPickerOverlay } from "@/components/onboarding/TeamPickerOverlay";
import type { GameSummary } from "@/lib/types";

/**
 * On first visit, show the team picker overlay. Picking a team routes to that
 * team's most recent game's catch-up view; skipping lands the user on the
 * normal home screen.
 */
function mostRecentGameForTeam(
  games: GameSummary[],
  abbr: string,
  now: number,
): GameSummary | null {
  const candidates = games
    .filter((g) => g.homeTeamAbbr === abbr || g.awayTeamAbbr === abbr)
    .filter((g) => Date.parse(g.gameDate) <= now)
    .sort((a, b) => Date.parse(b.gameDate) - Date.parse(a.gameDate));
  return candidates[0] ?? null;
}

export function FirstVisitGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const onboarded = useOnboarding((s) => s.onboarded);
  const setFavoriteTeam = useOnboarding((s) => s.setFavoriteTeam);
  const skipOnboarding = useOnboarding((s) => s.skipOnboarding);

  // Wait for zustand-persist to rehydrate before deciding whether to gate the
  // app — otherwise we'd flash the picker for already-onboarded users on every
  // hard reload.
  const hydrated = useSyncExternalStore(
    (cb) => useOnboarding.persist.onFinishHydration(cb),
    () => useOnboarding.persist.hasHydrated(),
    () => false,
  );

  const { games, loading } = useGamesList();

  if (!hydrated) return <>{children}</>;
  if (onboarded) return <>{children}</>;

  const handlePick = (abbr: string) => {
    setFavoriteTeam(abbr);
    if (loading || games.length === 0) {
      router.replace("/");
      return;
    }
    const recent = mostRecentGameForTeam(games, abbr, Date.now());
    if (recent) router.replace(`/catchup/${recent.id}`);
    else router.replace("/");
  };

  const handleSkip = () => {
    skipOnboarding();
    router.replace("/");
  };

  return (
    <TeamPickerOverlay
      heading="Pick your team to get started"
      subhead="We'll start you on their most recent game — no scores spoiled."
      onPick={handlePick}
      onSkip={handleSkip}
    />
  );
}
