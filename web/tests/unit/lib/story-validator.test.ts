import { describe, it, expect } from "vitest";
import {
  countSentences,
  countWords,
  validateStory,
} from "@/lib/story-validator";
import { AI_STORY } from "@/lib/config";

describe("story-validator", () => {
  it("counts words and sentences", () => {
    expect(countWords("  one two three  ")).toBe(3);
    expect(countWords("")).toBe(0);
    expect(countSentences("Hello world.")).toBe(1);
    expect(countSentences("First. Second! Third?")).toBeGreaterThanOrEqual(2);
  });

  it("rejects banned phrases", () => {
    const r = validateStory(`Intro text. both teams fought hard and more.`);
    expect(r.valid).toBe(false);
    if (!r.valid) expect(r.reason).toBe("phrase_match");
  });

  it("rejects sentence and word overflow", () => {
    const tooManySents = Array.from({ length: AI_STORY.MAX_SENTENCES + 2 }, (_, i) => `S${i}.`).join(" ");
    const rs = validateStory(tooManySents);
    expect(rs.valid).toBe(false);
    if (!rs.valid) expect(rs.reason).toBe("sentence_overflow");

    const words = Array.from({ length: AI_STORY.MAX_WORDS + 5 }, (_, i) => `w${i}`).join(" ");
    const rw = validateStory(words);
    expect(rw.valid).toBe(false);
    if (!rw.valid) expect(rw.reason).toBe("word_overflow");
  });

  it("accepts text within limits", () => {
    const r = validateStory("Short neutral recap. Two sentences here.");
    expect(r.valid).toBe(true);
    if (r.valid) {
      expect(r.sentenceCount).toBeGreaterThan(0);
      expect(r.wordCount).toBeGreaterThan(0);
    }
  });
});
