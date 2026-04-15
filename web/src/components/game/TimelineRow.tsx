import type { PlayEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TimelineRowProps {
  play: PlayEntry;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeColor?: string;
  awayColor?: string;
  scoresRevealed?: boolean;
}

// ─── Clean up common API description quirks ────────────────
function cleanDescription(text: string): string {
  let cleaned = text.replace(/ 's\b/g, "'s");
  cleaned = cleaned.replace(/\[([^\]]*)\]/g, "($1)");
  return cleaned;
}

// ─── Action keywords that get bold/semibold styling ────────
const BOLD_KEYWORDS = [
  // Basketball
  "MISS", "makes", "DUNK", "THREE", "FREE THROW", "BLOCK", "STEAL", "TURNOVER", "FOUL",
  // Hockey
  "GOAL", "PENALTY", "Shot on goal", "Missed shot", "Blocked shot",
  "Hit", "Giveaway", "Takeaway", "Faceoff", "Stoppage",
  // Football
  "TOUCHDOWN", "FIELD GOAL",
  // Baseball
  "HOME RUN", "TRIPLE", "DOUBLE", "SINGLE",
  "STRIKEOUT", "WALK", "HIT BY PITCH",
  "GROUND OUT", "FLY OUT", "LINE OUT", "POP OUT",
  "DOUBLE PLAY", "TRIPLE PLAY",
  "STOLEN BASE", "CAUGHT STEALING",
  "WILD PITCH", "PASSED BALL", "BALK", "ERROR",
  "SACRIFICE",
];

const STYLED_PATTERN = new RegExp(
  `(${BOLD_KEYWORDS.map((k) => k.replace(/\s+/g, "\\s+")).join("|")})|(\\([^)]*\\))`,
  "gi",
);

function StyledDescription({
  text,
  tier,
}: {
  text: string;
  tier: number;
}) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(STYLED_PATTERN)) {
    const idx = match.index!;
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }

    if (match[1]) {
      parts.push(
        <span key={idx} className="font-semibold">
          {match[0]}
        </span>,
      );
    } else if (match[2]) {
      parts.push(
        <span key={idx} className="text-neutral-500">
          {match[0]}
        </span>,
      );
    }

    lastIndex = idx + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <p
      className={cn(
        "leading-snug",
        tier === 1 && "text-sm font-semibold text-neutral-100",
        tier === 2 && "text-sm text-neutral-300 font-medium",
        tier === 3 && "text-sm text-neutral-500",
      )}
    >
      {parts}
    </p>
  );
}

function textColorForBg(hex: string): string {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55
    ? "#171717"
    : "#ffffff";
}

function getAccentColor(
  teamAbbr: string | undefined,
  homeTeamAbbr: string | undefined,
  awayTeamAbbr: string | undefined,
  homeColor: string | undefined,
  awayColor: string | undefined,
): string {
  if (!teamAbbr) return "#525252";
  if (teamAbbr === homeTeamAbbr && homeColor) return homeColor;
  if (teamAbbr === awayTeamAbbr && awayColor) return awayColor;
  return "#525252";
}

function splitDescription(text: string): { primary: string; stats: string | null } {
  const i = text.indexOf("(");
  if (i === -1) return { primary: text.trim(), stats: null };
  const primary = text.slice(0, i).trim();
  const groups: string[] = [];
  for (const m of text.slice(i).matchAll(/\(([^)]*)\)/g)) {
    if (m[1].trim()) groups.push(m[1].trim());
  }
  return { primary, stats: groups.length ? groups.join(" \u00B7 ") : null };
}

// ─── Main component ─────────────────────────────────────────

export function TimelineRow({
  play,
  homeTeamAbbr,
  awayTeamAbbr,
  homeColor,
  awayColor,
  scoresRevealed = true,
}: TimelineRowProps) {
  const tier = play.tier ?? 3;
  const accentColor = getAccentColor(
    play.teamAbbreviation,
    homeTeamAbbr,
    awayTeamAbbr,
    homeColor,
    awayColor,
  );
  const scoreChanged = tier === 1 && (play.scoreChanged ?? false);
  const showPlayScore = scoresRevealed && play.awayScore != null && play.homeScore != null;

  // ── Tier 1: Primary / high-impact ──
  if (tier === 1) {
    return (
      <div
        className="flex items-start gap-3 py-2 px-3 rounded-md bg-neutral-800/40"
        style={{ borderLeft: `4px solid ${accentColor}` }}
      >
        <span className="shrink-0 w-12 text-right text-xs text-neutral-400 tabular-nums pt-0.5">
          {play.timeLabel ?? play.gameClock ?? ""}
        </span>

        {play.teamAbbreviation && (
          <span
            className="shrink-0 inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide"
            style={{ backgroundColor: accentColor, color: textColorForBg(accentColor) }}
          >
            {play.teamAbbreviation}
          </span>
        )}

        <div className="flex-1 min-w-0">
          {(() => {
            const { primary, stats } = splitDescription(cleanDescription(play.description ?? ""));
            return (
              <>
                <p className="text-sm font-semibold text-neutral-100 leading-snug">{primary}</p>
                {stats && (
                  <p className="text-xs text-neutral-400 mt-0.5 leading-snug">{stats}</p>
                )}
              </>
            );
          })()}
        </div>

        {showPlayScore && (
          <span className="shrink-0 text-sm font-bold tabular-nums flex items-center gap-0.5">
            <span style={{ color: awayColor ?? "#a3a3a3", textShadow: "var(--ds-team-text-outline)" }}>
              {play.awayScore}
            </span>
            <span className="text-neutral-600">-</span>
            <span style={{ color: homeColor ?? "#a3a3a3", textShadow: "var(--ds-team-text-outline)" }}>
              {play.homeScore}
            </span>
            {scoreChanged && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            )}
          </span>
        )}
      </div>
    );
  }

  // ── Tier 2: Secondary / contextual ──
  if (tier === 2) {
    return (
      <div className="flex items-start gap-3 py-1.5 px-3 rounded">
        {play.teamAbbreviation && (
          <span className="shrink-0 text-xs font-medium uppercase text-neutral-500">
            {play.teamAbbreviation}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <StyledDescription text={cleanDescription(play.description ?? "")} tier={2} />
        </div>

        {showPlayScore && (
          <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
            {play.awayScore}-{play.homeScore}
          </span>
        )}
      </div>
    );
  }

  // ── Tier 3: Tertiary / low-signal ──
  return (
    <div className="flex items-start gap-2 py-1 px-2 ml-8">
      <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-neutral-600" />
      <div className="flex-1 min-w-0">
        <StyledDescription text={cleanDescription(play.description ?? "")} tier={3} />
      </div>
    </div>
  );
}
