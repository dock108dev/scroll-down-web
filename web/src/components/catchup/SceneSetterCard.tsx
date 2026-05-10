"use client";

import type { SceneSetterCard as SceneSetterCardData } from "@/lib/types";
import { findMlbTeam, teamLogoPath } from "@/lib/mlb-teams";
import { formatTimeET } from "@/lib/utils";

interface SceneSetterCardProps {
  card: SceneSetterCardData;
  isActive: boolean;
}

/**
 * Title-screen card. Establishes the retro-handheld theme: outer device
 * shell, three inset screens (banner / matchup / start prompt), amber LED
 * accents. Same visual vocabulary as the play card so the experience reads
 * as one device throughout.
 */
export function SceneSetterCard({ card }: SceneSetterCardProps) {
  const home = findMlbTeam(card.homeTeamAbbr);
  const away = findMlbTeam(card.awayTeamAbbr);

  return (
    <div data-testid="catchup-scene-setter" className="scene-setter-slide">
      <article className="scene-setter-device">
        <header className="scene-setter-screen scene-setter-banner">
          <p className="scene-setter-eyebrow">SCROLL DOWN MLB</p>
          <p className="scene-setter-firstpitch">
            FIRST PITCH · {formatTimeET(card.firstPitch)}
          </p>
        </header>

        <div className="scene-setter-screen scene-setter-matchup">
          <TeamColumn
            abbr={card.awayTeamAbbr}
            name={away?.name ?? card.awayTeam}
            color={away?.primaryColorDark}
          />
          <span className="scene-setter-vs">@</span>
          <TeamColumn
            abbr={card.homeTeamAbbr}
            name={home?.name ?? card.homeTeam}
            color={home?.primaryColorDark}
          />
        </div>

        {(card.awayProbablePitcher || card.homeProbablePitcher) && (
          <div className="scene-setter-screen scene-setter-pitchers">
            <PitcherLine label={card.awayTeamAbbr} name={card.awayProbablePitcher} />
            <PitcherLine label={card.homeTeamAbbr} name={card.homeProbablePitcher} />
          </div>
        )}

        {card.venue && (
          <p className="scene-setter-venue">{card.venue}</p>
        )}

        <div className="scene-setter-screen scene-setter-cta">
          <p className="scene-setter-cta-primary">SCROLL DOWN TO START</p>
          <p className="scene-setter-cta-sub">
            Scores update card by card. Final stays hidden until you reveal.
          </p>
        </div>
      </article>
    </div>
  );
}

function TeamColumn({ abbr, name, color }: { abbr: string; name: string; color?: string }) {
  return (
    <div className="scene-setter-team">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={teamLogoPath(abbr)}
        alt=""
        width={56}
        height={56}
        className="scene-setter-team-logo"
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
      />
      <p className="scene-setter-team-name" style={color ? { color } : undefined}>
        {name}
      </p>
      <p className="scene-setter-team-abbr">{abbr}</p>
    </div>
  );
}

function PitcherLine({ label, name }: { label: string; name?: string | null }) {
  return (
    <div className="scene-setter-pitcher">
      <p className="scene-setter-pitcher-label">{label} · SP</p>
      <p className="scene-setter-pitcher-name">{name || "TBA"}</p>
    </div>
  );
}
