import { describe, it } from "vitest";
import { buildCatchupCards } from "@/lib/catchup-cards";
import { SCENARIOS } from "./scenarios";

/**
 * Game-reconstruction QA. Each scenario synthesizes a game shape
 * (famous / boring / weird), runs it through the card builder, and
 * asserts on narrative-level properties. As real-game JSON fixtures get
 * captured, they slot in here as additional scenarios — the assertions
 * stay the same.
 */
describe("game-reconstruction QA", () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.category}: ${scenario.name}`, () => {
      const input = scenario.build();
      const deck = buildCatchupCards({
        game: input.game,
        plays: input.plays,
        isFinal: true,
      });
      scenario.assertions(deck, input);
    });
  }
});
