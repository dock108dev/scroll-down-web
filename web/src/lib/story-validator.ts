import { AI_STORY } from "./config";

// ─── Types ─────────────────────────────────────────────────

export type RejectionReason = "phrase_match" | "sentence_overflow" | "word_overflow";

export interface ValidationResult {
  valid: true;
  sentenceCount: number;
  wordCount: number;
}

export interface RejectionResult {
  valid: false;
  reason: RejectionReason;
  detail: string;
  sentenceCount: number;
  wordCount: number;
}

export type StoryValidation = ValidationResult | RejectionResult;

// ─── Counters ──────────────────────────────────────────────

/** Count sentences by splitting on terminal punctuation (.!?) not inside abbreviations. */
export function countSentences(text: string): number {
  // Match sentence-ending punctuation followed by whitespace or end of string.
  const matches = text.match(/[.!?]['")\s]|[.!?]$/g);
  return matches ? matches.length : (text.trim().length > 0 ? 1 : 0);
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Validator ─────────────────────────────────────────────

/**
 * Post-generation rule check. Returns rejection with reason if any constraint is
 * violated; callers must log the result before acting on it.
 */
export function validateStory(text: string): StoryValidation {
  const sentenceCount = countSentences(text);
  const wordCount = countWords(text);
  const lower = text.toLowerCase();

  // 1. Banned phrases (checked first — highest priority)
  for (const phrase of AI_STORY.BANNED_PHRASES) {
    if (lower.includes(phrase.toLowerCase())) {
      return {
        valid: false,
        reason: "phrase_match",
        detail: `Matched banned phrase: "${phrase}"`,
        sentenceCount,
        wordCount,
      };
    }
  }

  // 2. Sentence overflow
  if (sentenceCount > AI_STORY.MAX_SENTENCES) {
    return {
      valid: false,
      reason: "sentence_overflow",
      detail: `${sentenceCount} sentences exceeds maximum of ${AI_STORY.MAX_SENTENCES}`,
      sentenceCount,
      wordCount,
    };
  }

  // 3. Word overflow
  if (wordCount > AI_STORY.MAX_WORDS) {
    return {
      valid: false,
      reason: "word_overflow",
      detail: `${wordCount} words exceeds maximum of ${AI_STORY.MAX_WORDS}`,
      sentenceCount,
      wordCount,
    };
  }

  return { valid: true, sentenceCount, wordCount };
}
