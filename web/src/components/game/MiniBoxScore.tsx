import type { BlockMiniBox, BlockPlayerStat } from "@/lib/types";

/**
 * Returns a readable foreground color for dark mode.
 * If the hex color is too dark (low luminance), returns white instead.
 */
function readableColor(hex: string, fallback: string): string {
  const clean = hex.replace("#", "").slice(0, 6);
  if (clean.length !== 6) return fallback;
  const n = parseInt(clean, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.35 ? "#ffffff" : hex;
}

interface MiniBoxScoreProps {
  miniBox: BlockMiniBox;
  scoreAfter?: number[];
  homeTeam?: string;
  awayTeam?: string;
  homeColor?: string;
  awayColor?: string;
  isFirstBlock?: boolean;
}

interface StatEntry {
  cum: string;
  delta?: string;
}

/** Build stat entries with optional inline deltas */
function statEntries(p: BlockPlayerStat, showDeltas: boolean): StatEntry[] {
  const entries: StatEntry[] = [];

  // Basketball
  if (p.pts != null) {
    const d = showDeltas && p.deltaPts != null && p.deltaPts !== 0 ? `+${p.deltaPts}` : undefined;
    entries.push({ cum: `${p.pts}p`, delta: d });
  }
  if (p.reb != null) {
    const d = showDeltas && p.deltaReb != null && p.deltaReb !== 0 ? `+${p.deltaReb}` : undefined;
    entries.push({ cum: `${p.reb}r`, delta: d });
  }
  if (p.ast != null) {
    const d = showDeltas && p.deltaAst != null && p.deltaAst !== 0 ? `+${p.deltaAst}` : undefined;
    entries.push({ cum: `${p.ast}a`, delta: d });
  }

  // Hockey
  if (p.goals != null) {
    const d = showDeltas && p.deltaGoals != null && p.deltaGoals !== 0 ? `+${p.deltaGoals}` : undefined;
    entries.push({ cum: `${p.goals}g`, delta: d });
  }
  if (p.assists != null) {
    const d = showDeltas && p.deltaAssists != null && p.deltaAssists !== 0 ? `+${p.deltaAssists}` : undefined;
    entries.push({ cum: `${p.assists}a`, delta: d });
  }
  if (p.sog != null) {
    entries.push({ cum: `${p.sog}sog` });
  }

  // Baseball
  if (p.hits != null) {
    const d = showDeltas && p.deltaHits != null && p.deltaHits !== 0 ? `+${p.deltaHits}` : undefined;
    entries.push({ cum: `${p.hits}h`, delta: d });
  }
  if (p.rbi != null) {
    const d = showDeltas && p.deltaRbi != null && p.deltaRbi !== 0 ? `+${p.deltaRbi}` : undefined;
    entries.push({ cum: `${p.rbi}rbi`, delta: d });
  }
  if (p.hr != null) {
    const d = showDeltas && p.deltaHr != null && p.deltaHr !== 0 ? `+${p.deltaHr}` : undefined;
    entries.push({ cum: `${p.hr}hr`, delta: d });
  }
  if (p.k != null) {
    const d = showDeltas && p.deltaK != null && p.deltaK !== 0 ? `+${p.deltaK}` : undefined;
    entries.push({ cum: `${p.k}k`, delta: d });
  }
  if (p.ip != null) {
    entries.push({ cum: `${p.ip}ip` });
  }
  if (p.er != null) {
    entries.push({ cum: `${p.er}er` });
  }
  if (p.sb != null && p.sb > 0) {
    entries.push({ cum: `${p.sb}sb` });
  }

  return entries;
}

/** Render a player's stat line with inline deltas: "13p(+2) 4r 2a(+1)" */
function StatLine({ player, showDeltas }: { player: BlockPlayerStat; showDeltas: boolean }) {
  const entries = statEntries(player, showDeltas);
  return (
    <>
      {entries.map((e, i) => (
        <span key={i}>
          {i > 0 && " "}
          {e.cum}
          {e.delta && <span className="text-green-500">({e.delta})</span>}
        </span>
      ))}
    </>
  );
}

function PlayerRow({
  player,
  isStar,
  showDeltas,
}: {
  player: BlockPlayerStat;
  isStar: boolean;
  showDeltas: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-0.5 text-[13px]">
      <span className={isStar ? "text-yellow-500" : "text-neutral-400"}>
        {player.name}
      </span>
      <span className="text-[13px] text-neutral-500 ml-2 shrink-0">
        <StatLine player={player} showDeltas={showDeltas} />
      </span>
    </div>
  );
}

export function MiniBoxScore({
  miniBox,
  scoreAfter,
  homeTeam,
  awayTeam,
  homeColor,
  awayColor,
  isFirstBlock,
}: MiniBoxScoreProps) {
  const blockStars = new Set(miniBox.blockStars);
  const awayPlayers = miniBox.away.players.slice(0, 2);
  const homePlayers = miniBox.home.players.slice(0, 2);

  return (
    <div className="mt-3 pt-3 border-t border-neutral-800">
      {/* Away team row */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[15px] font-semibold" style={{ color: awayColor ? readableColor(awayColor, "#a3a3a3") : "#a3a3a3" }}>
            {miniBox.away.team || awayTeam || "AWAY"}
          </span>
          {scoreAfter && (
            <span className="text-[15px] tabular-nums text-neutral-200 font-bold">
              {scoreAfter[0]}
            </span>
          )}
        </div>
        {awayPlayers.map((p) => (
          <PlayerRow
            key={p.name}
            player={p}
            isStar={blockStars.has(p.name)}
            showDeltas={!isFirstBlock}
          />
        ))}
      </div>

      {/* Home team row */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[15px] font-semibold" style={{ color: homeColor ? readableColor(homeColor, "#a3a3a3") : "#a3a3a3" }}>
            {miniBox.home.team || homeTeam || "HOME"}
          </span>
          {scoreAfter && (
            <span className="text-[15px] tabular-nums text-neutral-200 font-bold">
              {scoreAfter[1]}
            </span>
          )}
        </div>
        {homePlayers.map((p) => (
          <PlayerRow
            key={p.name}
            player={p}
            isStar={blockStars.has(p.name)}
            showDeltas={!isFirstBlock}
          />
        ))}
      </div>
    </div>
  );
}
