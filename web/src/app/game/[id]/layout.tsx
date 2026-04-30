import type { Metadata } from "next";
import { apiFetch } from "@/lib/api-server";
import type { GameDetailResponse } from "@/lib/types";
import {
  buildSeoMetadata,
  jsonLdScript,
  spoilerSafeGameDescription,
  spoilerSafeGameTitle,
  sportsEventJsonLd,
} from "@/lib/seo";

interface GameMeta {
  id: number;
  homeTeam: string;
  awayTeam: string;
  leagueCode: string;
  gameDate: string;
  status: GameDetailResponse["game"]["status"];
  isLive?: boolean;
  isFinal?: boolean;
  isPregame?: boolean;
}

async function fetchGameMeta(id: string): Promise<GameMeta | null> {
  try {
    const data = await apiFetch<GameDetailResponse>(
      `/api/admin/sports/games/${id}`,
      { revalidate: 300 },
    );
    return {
      id: data.game.id,
      homeTeam: data.game.homeTeam,
      awayTeam: data.game.awayTeam,
      leagueCode: data.game.leagueCode,
      gameDate: data.game.gameDate,
      status: data.game.status,
      isLive: data.game.isLive,
      isFinal: data.game.isFinal,
      isPregame: data.game.isPregame,
    };
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const game = await fetchGameMeta(id);

  if (!game) {
    return buildSeoMetadata({
      title: "Game - Scroll Down Sports",
      description: "Follow the game without spoilers on Scroll Down Sports.",
      path: `/game/${id}`,
      noIndex: true,
    });
  }

  return buildSeoMetadata({
    title: spoilerSafeGameTitle(game),
    description: spoilerSafeGameDescription(game),
    path: `/game/${id}`,
  });
}

export default async function GameLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const game = await fetchGameMeta(id);

  return (
    <>
      {children}
      {game && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(sportsEventJsonLd(game))}
        />
      )}
    </>
  );
}
