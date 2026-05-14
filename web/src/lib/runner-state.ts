import type { BaseballBaseState, PlayEventType, RunnerAdvance, RunnerNames } from "./types";

type Base = "first" | "second" | "third";
type MovementBase = "home" | Base;

export type RunnerMovement = {
  runnerId?: string;
  runnerName?: string;
  from: MovementBase;
  to: Base | "home" | "out";
  reason?: string;
};

export interface RunnerDiffContext {
  runnerNamesBefore?: RunnerNames;
  runnerNamesAfter?: RunnerNames;
  eventType?: PlayEventType;
  runsScored?: number;
  outsRecorded?: number;
}

const BASES: Base[] = ["first", "second", "third"];
const LEAD_BASES: Base[] = ["third", "second", "first"];
const DEST_BASES: Base[] = ["third", "second", "first"];

export function diffBaseStates(
  before: BaseballBaseState,
  after: BaseballBaseState,
  context: RunnerDiffContext = {},
): RunnerMovement[] {
  const namesBefore = context.runnerNamesBefore ?? {};
  const namesAfter = context.runnerNamesAfter ?? {};
  const movements: RunnerMovement[] = [];
  const usedAfter = new Set<Base>();
  const usedBefore = new Set<Base>();
  let scoringSlots = Math.max(0, context.runsScored ?? 0);

  for (const from of BASES) {
    if (!before[from]) continue;
    const beforeName = cleanName(namesBefore[from]);
    if (!beforeName) continue;

    const to = BASES.find((base) => (
      after[base] &&
      !usedAfter.has(base) &&
      sameRunner(beforeName, namesAfter[base])
    ));

    if (!to) continue;
    usedBefore.add(from);
    usedAfter.add(to);
    if (from !== to) {
      movements.push({
        runnerId: runnerKey(beforeName),
        runnerName: beforeName,
        from,
        to,
        reason: "base_changed",
      });
    }
  }

  for (const from of LEAD_BASES) {
    if (!before[from] || usedBefore.has(from)) continue;
    if (after[from] && sameRunner(namesBefore[from], namesAfter[from])) {
      usedBefore.add(from);
      usedAfter.add(from);
      continue;
    }

    const to = DEST_BASES.find((base) => (
      after[base] &&
      !usedAfter.has(base) &&
      isForwardMove(from, base)
    ));

    const beforeName = cleanName(namesBefore[from]);
    if (to) {
      usedBefore.add(from);
      usedAfter.add(to);
      movements.push({
        runnerId: runnerKey(beforeName) ?? `${from}-runner`,
        runnerName: beforeName,
        from,
        to,
        reason: "base_changed",
      });
      continue;
    }

    if (!after[from] && scoringSlots > 0) {
      scoringSlots -= 1;
      usedBefore.add(from);
      movements.push({
        runnerId: runnerKey(beforeName) ?? `${from}-runner`,
        runnerName: beforeName,
        from,
        to: "home",
        reason: "scored",
      });
      continue;
    }

    if (!after[from] && isRunnerOutContext(context.eventType) && (context.outsRecorded ?? 0) > 0) {
      usedBefore.add(from);
      movements.push({
        runnerId: runnerKey(beforeName) ?? `${from}-runner`,
        runnerName: beforeName,
        from,
        to: "out",
        reason: "runner_out",
      });
    }
  }

  for (const to of BASES) {
    if (!after[to] || usedAfter.has(to)) continue;
    const afterName = cleanName(namesAfter[to]);
    const beforeName = cleanName(namesBefore[to]);
    if (before[to] && sameRunner(beforeName, afterName)) continue;
    if (before[to] && !usedBefore.has(to) && !isForcedBatterArrival(to, before, after, context.eventType)) {
      continue;
    }
    movements.push({
      runnerId: runnerKey(afterName) ?? `batter-to-${to}`,
      runnerName: afterName,
      from: "home",
      to,
      reason: "batter_reached",
    });
    usedAfter.add(to);
  }

  return movements.filter((movement) => movement.from !== movement.to);
}

function isForcedBatterArrival(
  to: Base,
  before: BaseballBaseState,
  after: BaseballBaseState,
  eventType: PlayEventType | undefined,
): boolean {
  return (
    to === "first" &&
    before.first &&
    after.second &&
    (
      eventType === "walk" ||
      eventType === "hit_by_pitch" ||
      eventType === "catcher_interference"
    )
  );
}

export function diffBaseStatesToAdvances(
  before: BaseballBaseState,
  after: BaseballBaseState,
  context: RunnerDiffContext = {},
): RunnerAdvance[] {
  return diffBaseStates(before, after, context).map((movement) => ({
    from: movement.from,
    to: movement.to,
    runnerId: movement.runnerId,
    runnerName: movement.runnerName,
    reason: movement.reason,
    outAt: movement.to === "out" && movement.from !== "home" ? movement.from : undefined,
  }));
}

function isForwardMove(from: Base, to: Base): boolean {
  const order: Record<Base, number> = { first: 1, second: 2, third: 3 };
  return order[to] > order[from];
}

function cleanName(name: string | undefined): string | undefined {
  const trimmed = name?.trim();
  return trimmed || undefined;
}

function sameRunner(a: string | undefined, b: string | undefined): boolean {
  const left = runnerKey(a);
  const right = runnerKey(b);
  return Boolean(left && right && left === right);
}

function runnerKey(name: string | undefined): string | undefined {
  const cleaned = cleanName(name);
  return cleaned?.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function isRunnerOutContext(eventType: PlayEventType | undefined): boolean {
  return (
    eventType === "caught_stealing" ||
    eventType === "pickoff" ||
    eventType === "fielders_choice" ||
    eventType === "double_play" ||
    eventType === "triple_play"
  );
}
