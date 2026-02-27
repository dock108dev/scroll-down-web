import type { PlayEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TimelineRowProps {
  play: PlayEntry;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeColor?: string;
  awayColor?: string;
  /** @deprecated No longer needed — use play.scoreChanged instead */
  previousPlay?: PlayEntry;
}

// ─── Action keywords that get bold/semibold styling ────────
const BOLD_KEYWORDS = [
  "MISS",
  "makes",
  "GOAL",
  "TOUCHDOWN",
  "FIELD GOAL",
  "HOME RUN",
  "STRIKEOUT",
  "PENALTY",
  "FOUL",
  "TURNOVER",
  "STEAL",
  "BLOCK",
  "DUNK",
  "THREE",
  "FREE THROW",
];

// Build a regex that matches any of the bold keywords (case-insensitive for
// mixed-case terms like "makes") plus parenthetical content for de-emphasis.
const STYLED_PATTERN = new RegExp(
  `(${BOLD_KEYWORDS.map((k) => k.replace(/\s+/g, "\\s+")).join("|")})|(\\([^)]*\\))`,
  "gi",
);

/**
 * Renders a play description with styled action keywords (bold) and
 * parenthetical/location info (de-emphasized).
 */
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
    // Push plain text before this match
    if (idx > lastIndex) {
      parts.push(text.slice(lastIndex, idx));
    }

    if (match[1]) {
      // Bold keyword
      parts.push(
        <span key={idx} className="font-semibold">
          {match[0]}
        </span>,
      );
    } else if (match[2]) {
      // Parenthetical content - de-emphasized
      parts.push(
        <span key={idx} className="text-neutral-500">
          {match[0]}
        </span>,
      );
    }

    lastIndex = idx + match[0].length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <p
      className={cn(
        "leading-snug",
        tier === 1 && "text-sm font-semibold text-white",
        tier === 2 && "text-sm text-neutral-300 font-medium",
        tier === 3 && "text-xs text-neutral-500",
      )}
    >
      {parts}
    </p>
  );
}

/**
 * Returns the accent color for a play based on its team abbreviation.
 * Falls back to a default neutral accent.
 */
function getAccentColor(
  teamAbbr: string | undefined,
  homeTeamAbbr: string | undefined,
  awayTeamAbbr: string | undefined,
  homeColor: string | undefined,
  awayColor: string | undefined,
): string {
  if (!teamAbbr) return "#525252"; // neutral-600
  if (teamAbbr === homeTeamAbbr && homeColor) return homeColor;
  if (teamAbbr === awayTeamAbbr && awayColor) return awayColor;
  return "#525252";
}

// ─── Main component ─────────────────────────────────────────

export function TimelineRow({
  play,
  homeTeamAbbr,
  awayTeamAbbr,
  homeColor,
  awayColor,
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

  // ── Tier 1: Primary / high-impact ──
  if (tier === 1) {
    return (
      <div
        className="flex items-start gap-3 py-2 px-3 rounded-md bg-neutral-800/40"
        style={{ borderLeft: `4px solid ${accentColor}` }}
      >
        {/* Time label */}
        <span className="shrink-0 w-12 text-right text-xs text-neutral-400 font-mono pt-0.5">
          {play.timeLabel ?? play.gameClock ?? ""}
        </span>

        {/* Team abbreviation badge */}
        {play.teamAbbreviation && (
          <span
            className="shrink-0 inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: accentColor }}
          >
            {play.teamAbbreviation}
          </span>
        )}

        {/* Description */}
        <div className="flex-1 min-w-0">
          <StyledDescription text={play.description ?? ""} tier={1} />
        </div>

        {/* Score display */}
        {play.awayScore != null && play.homeScore != null && (
          <span className="shrink-0 text-sm font-bold tabular-nums flex items-center gap-0.5">
            <span style={{ color: awayColor ?? "#a3a3a3" }}>
              {play.awayScore}
            </span>
            <span className="text-neutral-600">-</span>
            <span style={{ color: homeColor ?? "#a3a3a3" }}>
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
      <div
        className="flex items-start gap-3 py-1.5 px-3 rounded ml-4"
        style={{ borderLeft: `2px solid ${accentColor}40` }}
      >
        {/* Time label */}
        <span className="shrink-0 w-12 text-right text-xs text-neutral-500 font-mono pt-0.5">
          {play.timeLabel ?? play.gameClock ?? ""}
        </span>

        {/* Team abbreviation badge at 50% opacity */}
        {play.teamAbbreviation && (
          <span
            className="shrink-0 inline-flex items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white/70"
            style={{ backgroundColor: `${accentColor}80` }}
          >
            {play.teamAbbreviation}
          </span>
        )}

        {/* Description */}
        <div className="flex-1 min-w-0">
          <StyledDescription text={play.description ?? ""} tier={2} />
        </div>

        {/* Score (muted) */}
        {play.awayScore != null && play.homeScore != null && (
          <span className="shrink-0 text-xs text-neutral-500 font-mono tabular-nums">
            {play.awayScore}-{play.homeScore}
          </span>
        )}
      </div>
    );
  }

  // ── Tier 3: Tertiary / low-signal ──
  return (
    <div className="flex items-start gap-2 py-1 px-2 ml-8">
      {/* Dot indicator */}
      <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-neutral-600" />

      {/* Time label */}
      <span className="shrink-0 w-10 text-right text-[10px] text-neutral-600 font-mono">
        {play.timeLabel ?? play.gameClock ?? ""}
      </span>

      {/* Description */}
      <div className="flex-1 min-w-0">
        <StyledDescription text={play.description ?? ""} tier={3} />
      </div>
    </div>
  );
}
