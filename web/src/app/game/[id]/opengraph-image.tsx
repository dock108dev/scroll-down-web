import { ImageResponse } from "next/og";
import { apiFetch } from "@/lib/api-server";
import type { GameDetailResponse } from "@/lib/types";

export const runtime = "edge";
export const alt = "Game preview — Scroll Down Sports";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let away = "Away";
  let home = "Home";
  let league = "";

  try {
    const data = await apiFetch<GameDetailResponse>(
      `/api/admin/sports/games/${id}`,
      { revalidate: 300 },
    );
    away = data.game.awayTeam;
    home = data.game.homeTeam;
    league = data.game.leagueCode?.toUpperCase() ?? "";
  } catch {
    // Use fallback text
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          backgroundColor: "#0a0a0a",
          color: "#fafafa",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {league && (
          <div
            style={{
              fontSize: 24,
              color: "#737373",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              marginBottom: 16,
            }}
          >
            {league}
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 32,
            fontSize: 56,
            fontWeight: 700,
          }}
        >
          <span>{away}</span>
          <span style={{ color: "#525252", fontSize: 40 }}>vs</span>
          <span>{home}</span>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 20,
            color: "#737373",
          }}
        >
          Scroll Down Sports — Follow without spoilers
        </div>
      </div>
    ),
    { ...size },
  );
}
