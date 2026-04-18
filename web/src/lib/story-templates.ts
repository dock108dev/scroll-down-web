import type { SalientEvent, NarrativeType, SalientEventResult } from "./salient-events";
import type { BoxScoreInput } from "./salient-events";
import { AI_STORY } from "./config";

// ─── Public types ──────────────────────────────────────────

/** Named slots extracted from salient events — never raw box-score JSON. */
export interface StorySlots {
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  winner: string;
  loser: string;
  winnerScore: number;
  loserScore: number;
  standoutStat1: string | null;
  standoutStat2: string | null;
  keyPlay1: string | null;
  scoringRun1: string | null;
  leadChange1: string | null;
  leadChange2: string | null;
}

export interface FilledTemplate {
  systemPrompt: string;
  userPrompt: string;
}

// ─── Slot extraction ───────────────────────────────────────

export function buildStorySlots(
  input: BoxScoreInput,
  result: SalientEventResult,
): StorySlots {
  const { homeTeam, awayTeam, homeScore, awayScore } = input;
  const { events } = result;

  const byType = (type: SalientEvent["type"]) =>
    events.filter((e) => e.type === type);
  const desc = (arr: SalientEvent[], n: number): string | null =>
    arr[n]?.description ?? null;

  const winner = homeScore >= awayScore ? homeTeam : awayTeam;
  const loser = homeScore >= awayScore ? awayTeam : homeTeam;

  return {
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    winner,
    loser,
    winnerScore: Math.max(homeScore, awayScore),
    loserScore: Math.min(homeScore, awayScore),
    standoutStat1: desc(byType("standout-stat"), 0),
    standoutStat2: desc(byType("standout-stat"), 1),
    keyPlay1: desc(byType("key-play"), 0),
    scoringRun1: desc(byType("scoring-run"), 0),
    leadChange1: desc(byType("lead-change"), 0),
    leadChange2: desc(byType("lead-change"), 1),
  };
}

// ─── Shared system prompt ──────────────────────────────────

const BANNED_LIST = AI_STORY.BANNED_PHRASES.map((p) => `"${p}"`).join(", ");

const SHARED_SYSTEM = `You are a sports journalist writing concise game recaps.

Requirements (strictly enforced):
- ≤${AI_STORY.MAX_SENTENCES} sentences total; ≤${AI_STORY.MAX_SENTENCES_PER_SECTION} sentences per topic section
- ≤${AI_STORY.MAX_WORDS} words total
- Never use these phrases (in any form or case): ${BANNED_LIST}
- Use only the facts provided — do not invent stats, players, or plays
- Past tense, third person
- Return only the story text — no headings, bullet points, or labels`;

// ─── Template helpers ──────────────────────────────────────

function line(label: string, value: string | null): string {
  return value ? `- ${label}: ${value}` : "";
}

function factBlock(slots: string[]): string {
  return slots.filter(Boolean).join("\n");
}

// ─── Five narrative templates ──────────────────────────────

function comebackTemplate(s: StorySlots): FilledTemplate {
  return {
    systemPrompt: SHARED_SYSTEM,
    userPrompt: `Write a comeback game recap (≤${AI_STORY.MAX_SENTENCES} sentences, ≤${AI_STORY.MAX_WORDS} words).

Outcome: ${s.winner} ${s.winnerScore}, ${s.loser} ${s.loserScore}
Narrative: ${s.winner} overcame a deficit to win

Game facts:
${factBlock([
  line("Standout performance", s.standoutStat1),
  line("Second standout", s.standoutStat2),
  line("Scoring run", s.scoringRun1),
  line("Lead change", s.leadChange1),
  line("Decisive play", s.keyPlay1),
])}`,
  };
}

function dominantTemplate(s: StorySlots): FilledTemplate {
  return {
    systemPrompt: SHARED_SYSTEM,
    userPrompt: `Write a dominant-win game recap (≤${AI_STORY.MAX_SENTENCES} sentences, ≤${AI_STORY.MAX_WORDS} words).

Outcome: ${s.winner} ${s.winnerScore}, ${s.loser} ${s.loserScore}
Narrative: ${s.winner} controlled the game throughout

Game facts:
${factBlock([
  line("Standout performance", s.standoutStat1),
  line("Second standout", s.standoutStat2),
  line("Key scoring run", s.scoringRun1),
  line("Key play", s.keyPlay1),
])}`,
  };
}

function blowoutTemplate(s: StorySlots): FilledTemplate {
  const margin = s.winnerScore - s.loserScore;
  return {
    systemPrompt: SHARED_SYSTEM,
    userPrompt: `Write a blowout game recap (≤${AI_STORY.MAX_SENTENCES} sentences, ≤${AI_STORY.MAX_WORDS} words).

Outcome: ${s.winner} ${s.winnerScore}, ${s.loser} ${s.loserScore} (margin: ${margin})
Narrative: ${s.winner} dominated from start to finish

Game facts:
${factBlock([
  line("Standout performance", s.standoutStat1),
  line("Second standout", s.standoutStat2),
  line("Key scoring run", s.scoringRun1),
  line("Key play", s.keyPlay1),
])}`,
  };
}

function backAndForthTemplate(s: StorySlots): FilledTemplate {
  return {
    systemPrompt: SHARED_SYSTEM,
    userPrompt: `Write a competitive game recap (≤${AI_STORY.MAX_SENTENCES} sentences, ≤${AI_STORY.MAX_WORDS} words).

Outcome: ${s.winner} ${s.winnerScore}, ${s.loser} ${s.loserScore}
Narrative: Multiple lead changes in a closely contested game

Game facts:
${factBlock([
  line("Lead change", s.leadChange1),
  line("Second lead change", s.leadChange2),
  line("Standout performance", s.standoutStat1),
  line("Decisive play", s.keyPlay1),
])}`,
  };
}

function defensiveTemplate(s: StorySlots): FilledTemplate {
  return {
    systemPrompt: SHARED_SYSTEM,
    userPrompt: `Write a defensive game recap (≤${AI_STORY.MAX_SENTENCES} sentences, ≤${AI_STORY.MAX_WORDS} words).

Outcome: ${s.winner} ${s.winnerScore}, ${s.loser} ${s.loserScore}
Narrative: Defense defined this low-scoring game

Game facts:
${factBlock([
  line("Standout performance", s.standoutStat1),
  line("Key play", s.keyPlay1),
  line("Scoring run", s.scoringRun1),
])}`,
  };
}

// ─── Public dispatcher ─────────────────────────────────────

const TEMPLATE_MAP: Record<NarrativeType, (s: StorySlots) => FilledTemplate> = {
  comeback: comebackTemplate,
  dominant: dominantTemplate,
  blowout: blowoutTemplate,
  "back-and-forth": backAndForthTemplate,
  defensive: defensiveTemplate,
};

/** Fill the template for the given narrative type with concrete event slots. */
export function fillTemplate(
  slots: StorySlots,
  narrativeType: NarrativeType,
): FilledTemplate {
  return TEMPLATE_MAP[narrativeType](slots);
}
