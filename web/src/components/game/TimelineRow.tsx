import type { PlayEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TimelineRowProps {
  play: PlayEntry;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeColor?: string;
  awayColor?: string;
}

// ─── Clean up common API description quirks ────────────────
function cleanDescription(text: string): string {
  // "Bucknell 's Spadone" → "Bucknell's Spadone"
  let cleaned = text.replace(/ 's\b/g, "'s");
  // "Turnover by Team [shot clock violation]" → "Turnover by Team (shot clock violation)"
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
        tier === 1 && "text-sm font-semibold text-neutral-100",
        tier === 2 && "text-sm text-neutral-300 font-medium",
        tier === 3 && "text-sm text-neutral-500",
      )}
    >
      {parts}
    </p>
  );
}

/**
 * Returns black or white text depending on background luminance.
 */
function textColorForBg(hex: string): string {
  const n = parseInt(hex.replace("#", "").slice(0, 6), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55
    ? "#171717"
    : "#ffffff";
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

/**
 * Resolve the score line "after" this play. The API ships either flat
 * homeScore/awayScore (older shape) or score: { home, away } / scoreBefore: {...}
 * objects (NHL, MLB). For scoring plays where only `scoreBefore` is sent,
 * derive the after-score from the before + delta + scoringTeamAbbr.
 */
function resolveScoreAfter(
  play: PlayEntry,
  homeAbbr: string | undefined,
  awayAbbr: string | undefined,
): { home: number; away: number } | null {
  // Flat after-score (legacy)
  if (play.homeScore != null && play.awayScore != null) {
    return { home: play.homeScore, away: play.awayScore };
  }
  // Object after-score
  if (play.score && play.score.home != null && play.score.away != null) {
    return { home: play.score.home, away: play.score.away };
  }
  // Resolve before-score (flat or object form)
  const beforeHome = play.homeScoreBefore ?? play.scoreBefore?.home;
  const beforeAway = play.awayScoreBefore ?? play.scoreBefore?.away;
  if (beforeHome == null || beforeAway == null) return null;

  // Non-scoring play: running score is just the before-score
  if (!play.scoreChanged && !play.scoringTeamAbbr) {
    return { home: beforeHome, away: beforeAway };
  }
  // Scoring play: add the delta to the scoring team
  if (play.scoringTeamAbbr) {
    const delta = play.pointsScored ?? 1;
    if (play.scoringTeamAbbr === homeAbbr) {
      return { home: beforeHome + delta, away: beforeAway };
    }
    if (play.scoringTeamAbbr === awayAbbr) {
      return { home: beforeHome, away: beforeAway + delta };
    }
  }
  // scoreChanged with no scoringTeamAbbr — still useful: show before-score
  return { home: beforeHome, away: beforeAway };
}

/**
 * Splits a play description into a primary action line and optional stats.
 * E.g. "J. Brown 25' 3PT (5 PTS) (Pritchard 4 AST)" →
 *   { primary: "J. Brown 25' 3PT", stats: "5 PTS · Pritchard 4 AST" }
 *
 * Drops parentheticals that are bare numbers / punctuation — those are usually
 * raw API fields (inning number, period) leaking into the description and would
 * otherwise render as an unlabeled "6" under the play.
 */
function splitDescription(text: string): { primary: string; stats: string | null } {
  const i = text.indexOf("(");
  if (i === -1) return { primary: text.trim(), stats: null };
  const primary = text.slice(0, i).trim();
  const groups: string[] = [];
  for (const m of text.slice(i).matchAll(/\(([^)]*)\)/g)) {
    const content = m[1].trim();
    if (!content) continue;
    if (!/[a-zA-Z]/.test(content)) continue;
    groups.push(content);
  }
  return { primary, stats: groups.length ? groups.join(" · ") : null };
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
  const isScoringPlay = (play.scoreChanged ?? false) || play.scoringTeamAbbr != null;
  const scoreChanged = tier === 1 && (play.scoreChanged ?? false);
  const scoreAfter = isScoringPlay ? resolveScoreAfter(play, homeTeamAbbr, awayTeamAbbr) : null;

  // ── Tier 1: Primary / high-impact ──
  if (tier === 1) {
    return (
      <div
        data-play-index={play.playIndex}
        className="flex items-start gap-3 py-2 px-3 rounded-md bg-neutral-800/40"
        style={{ borderLeft: `4px solid ${accentColor}` }}
      >
        {/* Time label */}
        <span className="shrink-0 w-12 text-right text-xs text-neutral-400 tabular-nums pt-0.5">
          {play.timeLabel ?? play.gameClock ?? ""}
        </span>

        {/* Team abbreviation badge */}
        {play.teamAbbreviation && (
          <span
            className="shrink-0 inline-flex items-center justify-center rounded px-1.5 py-0.5 text-xs font-bold uppercase tracking-wide"
            style={{ backgroundColor: accentColor, color: textColorForBg(accentColor) }}
          >
            {play.teamAbbreviation}
          </span>
        )}

        {/* Description — two-line: action + stats */}
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

        {/* Score display — AWY 4 · HME 6 with team abbrs so the number is never bare */}
        {scoreAfter && (
          <span className="shrink-0 text-xs font-semibold tabular-nums flex items-center gap-1.5 pt-0.5">
            <span style={{ color: awayColor ?? "#a3a3a3", textShadow: "var(--ds-team-text-outline)" }}>
              {awayTeamAbbr ? `${awayTeamAbbr} ${scoreAfter.away}` : scoreAfter.away}
            </span>
            <span className="text-neutral-600">·</span>
            <span style={{ color: homeColor ?? "#a3a3a3", textShadow: "var(--ds-team-text-outline)" }}>
              {homeTeamAbbr ? `${homeTeamAbbr} ${scoreAfter.home}` : scoreAfter.home}
            </span>
            {scoreChanged && (
              <span className="ml-1 w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            )}
          </span>
        )}
      </div>
    );
  }

  // ── Tier 2: Secondary / contextual — no border, no colored badge, no time ──
  if (tier === 2) {
    return (
      <div data-play-index={play.playIndex} className="flex items-start gap-3 py-1.5 px-3 rounded">
        {/* Plain team abbreviation (no colored badge) */}
        {play.teamAbbreviation && (
          <span className="shrink-0 text-xs font-medium uppercase text-neutral-500">
            {play.teamAbbreviation}
          </span>
        )}

        {/* Description */}
        <div className="flex-1 min-w-0">
          <StyledDescription text={cleanDescription(play.description ?? "")} tier={2} />
        </div>

        {/* Score (muted) */}
        {scoreAfter && (
          <span className="shrink-0 text-xs text-neutral-500 tabular-nums">
            {awayTeamAbbr ? `${awayTeamAbbr} ${scoreAfter.away}` : scoreAfter.away}
            {" · "}
            {homeTeamAbbr ? `${homeTeamAbbr} ${scoreAfter.home}` : scoreAfter.home}
          </span>
        )}
      </div>
    );
  }

  // ── Tier 3: Tertiary / low-signal — no time label ──
  return (
    <div data-play-index={play.playIndex} className="flex items-start gap-2 py-1 px-2 ml-8">
      {/* Dot indicator */}
      <span className="shrink-0 mt-1.5 w-1 h-1 rounded-full bg-neutral-600" />

      {/* Description */}
      <div className="flex-1 min-w-0">
        <StyledDescription text={cleanDescription(play.description ?? "")} tier={3} />
      </div>
    </div>
  );
}
