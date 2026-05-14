import { describe, expect, it } from "vitest";
import { diffBaseStates } from "@/lib/runner-state";

const empty = { first: false, second: false, third: false };

describe("diffBaseStates", () => {
  it("emits no movement for empty bases", () => {
    expect(diffBaseStates(empty, empty)).toEqual([]);
  });

  it("emits no movement when a runner stays on first", () => {
    expect(diffBaseStates(
      { first: true, second: false, third: false },
      { first: true, second: false, third: false },
      {
        runnerNamesBefore: { first: "Corbin Carroll" },
        runnerNamesAfter: { first: "Corbin Carroll" },
      },
    )).toEqual([]);
  });

  it("detects a named runner advancing from first to second", () => {
    expect(diffBaseStates(
      { first: true, second: false, third: false },
      { first: false, second: true, third: false },
      {
        runnerNamesBefore: { first: "Josh Jung" },
        runnerNamesAfter: { second: "Josh Jung" },
      },
    )).toMatchObject([
      { runnerName: "Josh Jung", from: "first", to: "second" },
    ]);
  });

  it("detects a scoring runner only when the play scored", () => {
    expect(diffBaseStates(
      { first: false, second: false, third: true },
      empty,
      {
        runnerNamesBefore: { third: "Gabriel Moreno" },
        runsScored: 1,
      },
    )).toMatchObject([
      { runnerName: "Gabriel Moreno", from: "third", to: "home" },
    ]);
  });

  it("does not guess a stranded runner disappearance as movement", () => {
    expect(diffBaseStates(
      { first: true, second: false, third: false },
      empty,
      {
        runnerNamesBefore: { first: "Maxwell Waldschmidt" },
        eventType: "field_out",
        outsRecorded: 1,
      },
    )).toEqual([]);
  });

  it("handles a walk with empty bases", () => {
    expect(diffBaseStates(empty, { first: true, second: false, third: false }, {
      runnerNamesAfter: { first: "Corbin Carroll" },
      eventType: "walk",
    })).toMatchObject([
      { runnerName: "Corbin Carroll", from: "home", to: "first" },
    ]);
  });

  it("handles a walk with a runner forced from first to second", () => {
    expect(diffBaseStates(
      { first: true, second: false, third: false },
      { first: true, second: true, third: false },
      {
        runnerNamesBefore: { first: "Josh Jung" },
        runnerNamesAfter: { first: "Gabriel Moreno", second: "Josh Jung" },
        eventType: "walk",
      },
    )).toMatchObject([
      { runnerName: "Josh Jung", from: "first", to: "second" },
      { runnerName: "Gabriel Moreno", from: "home", to: "first" },
    ]);
  });
});
