import type { BlockMiniBox, BlockPlayerStat } from "@/lib/types";

interface MiniBoxScoreProps {
  miniBox: BlockMiniBox;
  scoreAfter?: number[];
  homeTeam?: string;
  awayTeam?: string;
  homeColor?: string;
  awayColor?: string;
  isFirstBlock?: boolean;
}

/** Format a player's cumulative stat line */
function statLine(p: BlockPlayerStat): string {
  const parts: string[] = [];
  if (p.pts != null) parts.push(`${p.pts}p`);
  if (p.reb != null) parts.push(`${p.reb}r`);
  if (p.ast != null) parts.push(`${p.ast}a`);
  if (p.goals != null) parts.push(`${p.goals}g`);
  if (p.assists != null) parts.push(`${p.assists}a`);
  if (p.sog != null) parts.push(`${p.sog}sog`);
  return parts.join(" ");
}

/** Format a player's delta stat line (what they did in this block) */
function deltaLine(p: BlockPlayerStat): string {
  const parts: string[] = [];
  if (p.delta_pts != null && p.delta_pts !== 0) parts.push(`+${p.delta_pts}p`);
  if (p.delta_reb != null && p.delta_reb !== 0) parts.push(`+${p.delta_reb}r`);
  if (p.delta_ast != null && p.delta_ast !== 0) parts.push(`+${p.delta_ast}a`);
  if (p.delta_goals != null && p.delta_goals !== 0) parts.push(`+${p.delta_goals}g`);
  if (p.delta_assists != null && p.delta_assists !== 0) parts.push(`+${p.delta_assists}a`);
  return parts.join(" ");
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
  const blockStars = new Set(miniBox.block_stars);
  const awayPlayers = miniBox.away.players.slice(0, 2);
  const homePlayers = miniBox.home.players.slice(0, 2);

  return (
    <div className="mt-3 pt-3 border-t border-neutral-800 text-xs">
      {/* Away team row */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold" style={{ color: awayColor ?? "#a3a3a3" }}>
            {miniBox.away.team || awayTeam || "AWAY"}
          </span>
          {scoreAfter && (
            <span className="font-mono tabular-nums text-neutral-300 font-semibold">
              {scoreAfter[0]}
            </span>
          )}
        </div>
        {awayPlayers.map((p) => {
          const isStar = blockStars.has(p.name);
          const delta = !isFirstBlock ? deltaLine(p) : "";
          return (
            <div key={p.name} className="flex items-baseline justify-between py-0.5">
              <span className={isStar ? "text-yellow-500" : "text-neutral-400"}>
                {p.name}
                {isStar && <span className="ml-1 text-[9px]">&#9733;</span>}
              </span>
              <span className="font-mono text-neutral-500 ml-2 shrink-0">
                {statLine(p)}
                {delta && (
                  <span className="text-green-500 ml-1.5">{delta}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {/* Home team row */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold" style={{ color: homeColor ?? "#a3a3a3" }}>
            {miniBox.home.team || homeTeam || "HOME"}
          </span>
          {scoreAfter && (
            <span className="font-mono tabular-nums text-neutral-300 font-semibold">
              {scoreAfter[1]}
            </span>
          )}
        </div>
        {homePlayers.map((p) => {
          const isStar = blockStars.has(p.name);
          const delta = !isFirstBlock ? deltaLine(p) : "";
          return (
            <div key={p.name} className="flex items-baseline justify-between py-0.5">
              <span className={isStar ? "text-yellow-500" : "text-neutral-400"}>
                {p.name}
                {isStar && <span className="ml-1 text-[9px]">&#9733;</span>}
              </span>
              <span className="font-mono text-neutral-500 ml-2 shrink-0">
                {statLine(p)}
                {delta && (
                  <span className="text-green-500 ml-1.5">{delta}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
