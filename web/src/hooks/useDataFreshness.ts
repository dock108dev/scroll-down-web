"use client";

import { useState, useEffect } from "react";
import type { DataStalenessState } from "@/lib/types";

const RECALC_INTERVAL_MS = 30_000;

const LIVE_STALE_S = 60;
const LIVE_VERY_STALE_S = 300;
const PREGAME_STALE_S = 600;
const PREGAME_VERY_STALE_S = 1800;

type GameStateCategory = "live" | "pregame" | "final" | "other";

function categorize(status?: string, isLive?: boolean, isFinal?: boolean, isPregame?: boolean): GameStateCategory {
  if (isFinal) return "final";
  if (isLive) return "live";
  if (isPregame) return "pregame";
  if (!status) return "other";
  const s = status.toLowerCase();
  if (["final", "completed", "official", "archived"].includes(s)) return "final";
  if (["live", "in_progress", "halftime"].includes(s)) return "live";
  if (["scheduled", "pregame", "pre_game", "created"].includes(s)) return "pregame";
  return "other";
}

function computeClientStaleness(
  dataUpdatedAt: string | undefined,
  category: GameStateCategory,
): DataStalenessState {
  if (category === "final") return "fresh";
  if (!dataUpdatedAt) return "very_stale";

  const ageS = (Date.now() - new Date(dataUpdatedAt).getTime()) / 1000;

  if (category === "live") {
    if (ageS > LIVE_VERY_STALE_S) return "very_stale";
    if (ageS > LIVE_STALE_S) return "stale";
    return "fresh";
  }

  if (ageS > PREGAME_VERY_STALE_S) return "very_stale";
  if (ageS > PREGAME_STALE_S) return "stale";
  return "fresh";
}

export interface DataFreshnessResult {
  staleness: DataStalenessState;
  dataUpdatedAt: string | undefined;
  ageLabel: string | null;
}

function formatAge(dataUpdatedAt: string | undefined): string | null {
  if (!dataUpdatedAt) return null;
  const diffS = Math.max(0, Math.floor((Date.now() - new Date(dataUpdatedAt).getTime()) / 1000));
  if (diffS < 60) return "just now";
  const mins = Math.floor(diffS / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

interface FreshnessInput {
  dataUpdatedAt?: string;
  dataStalenessState?: DataStalenessState;
  status?: string;
  isLive?: boolean;
  isFinal?: boolean;
  isPregame?: boolean;
}

export function useDataFreshness(game: FreshnessInput | undefined): DataFreshnessResult {
  const category = game ? categorize(game.status, game.isLive, game.isFinal, game.isPregame) : "other";

  const [staleness, setStaleness] = useState<DataStalenessState>(() =>
    game?.dataStalenessState ?? computeClientStaleness(game?.dataUpdatedAt, category),
  );
  const [ageLabel, setAgeLabel] = useState<string | null>(() => formatAge(game?.dataUpdatedAt));

  useEffect(() => {
    const recalc = () => {
      setStaleness(computeClientStaleness(game?.dataUpdatedAt, category));
      setAgeLabel(formatAge(game?.dataUpdatedAt));
    };
    recalc();
    if (category === "final") return;
    const id = setInterval(recalc, RECALC_INTERVAL_MS);
    return () => clearInterval(id);
  }, [game?.dataUpdatedAt, category]);

  return {
    staleness,
    dataUpdatedAt: game?.dataUpdatedAt,
    ageLabel,
  };
}
