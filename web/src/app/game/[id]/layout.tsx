import type { Metadata } from "next";
import { apiFetch } from "@/lib/api-server";
import type { GameDetailResponse } from "@/lib/types";

interface GameMeta {
  homeTeam: string;
  awayTeam: string;
  leagueCode: string;
}

async function fetchGameMeta(id: string): Promise<GameMeta | null> {
  try {
    const data = await apiFetch<GameDetailResponse>(
      `/api/admin/sports/games/${id}`,
      { revalidate: 300 },
    );
    return {
      homeTeam: data.game.homeTeam,
      awayTeam: data.game.awayTeam,
      leagueCode: data.game.leagueCode,
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
    return {
      title: "Game — Scroll Down Sports",
      description: "Follow the game without spoilers on Scroll Down Sports.",
    };
  }

  const title = `${game.awayTeam} vs ${game.homeTeam}`;
  const description = `Follow ${game.awayTeam} vs ${game.homeTeam} without spoilers. Play-by-play timeline, live scores, and game flow.`;

  return {
    title,
    description,
    openGraph: {
      title: `${title} — Game Flow`,
      description,
    },
  };
}

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
