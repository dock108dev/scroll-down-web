import { create } from "zustand";
import type {
  GameSummary,
  GameDetailResponse,
  GameFlowResponse,
  GameStatus,
  PlayEntry,
} from "@/lib/types";
import { TERMINAL_STATUSES } from "@/lib/types";
import { CACHE } from "@/lib/config";
import type { TransportStatus } from "@/realtime/transport";
import { coreFromSummary, coreFromGame } from "./game-core";

// ─── Normalized core: union of GameSummary + Game fields ──────────

export interface GameCore {
  id: number;
  leagueCode: string;
  gameDate: string;
  status: GameStatus;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  currentPeriod?: number;
  gameClock?: string;
  currentPeriodLabel?: string;
  homeTeamAbbr?: string;
  awayTeamAbbr?: string;
  homeTeamColorLight?: string;
  homeTeamColorDark?: string;
  awayTeamColorLight?: string;
  awayTeamColorDark?: string;
  hasBoxscore?: boolean;
  hasPlayerStats?: boolean;
  hasOdds?: boolean;
  hasSocial?: boolean;
  hasPbp?: boolean;
  hasFlow?: boolean;
  hasAdvancedStats?: boolean;
  playCount?: number;
  socialPostCount?: number;
  hasRequiredData?: boolean;
  isLive?: boolean;
  isFinal?: boolean;
  isPregame?: boolean;
  isTrulyCompleted?: boolean;
  readEligible?: boolean;
  dateSection?: string;
  liveSnapshot?: {
    periodLabel?: string;
    timeLabel?: string;
    homeScore?: number;
    awayScore?: number;
    gameClock?: string;
  } | null;
  // Full Game fields (only set after detail fetch)
  season?: number;
  seasonType?: string;
  scrapeVersion?: number;
  lastScrapedAt?: string;
  lastIngestedAt?: string;
  lastPbpAt?: string;
  lastSocialAt?: string;
  lastOddsAt?: string;
  homeTeamXHandle?: string;
  awayTeamXHandle?: string;
  derivedMetrics?: Record<string, unknown>;
}

export interface GameEntry {
  core: GameCore;
  coreUpdatedAt: number;
  detail: { response: GameDetailResponse; fetchedAt: number } | null;
  flow: { response: GameFlowResponse; fetchedAt: number } | null;
}

interface ListFetchMeta {
  fetchedAt: number;
  gameIds: number[];
}

// ─── Sequence check result ───────────────────────────────────────

export type SeqCheckResult = "ok" | "duplicate" | "gap";

// ─── PBP dedup helper ────────────────────────────────────────────

function pbpKey(p: PlayEntry): string {
  if (p.eventId) return p.eventId;
  return `${p.playIndex}|${p.gameClock ?? ""}|${p.playType ?? ""}|${p.description?.slice(0, 40) ?? ""}`;
}

// ─── Store interface ──────────────────────────────────────────────

interface GameDataState {
  games: Map<number, GameEntry>;
  listFetches: Map<string, ListFetchMeta>;
  activeGameId: number | null;

  // Realtime state
  seqByChannel: Map<string, number>;
  desyncedByChannel: Map<string, boolean>;
  realtimeStatus: TransportStatus;

  // Recovery request flags (set by dispatcher, consumed by hooks)
  needsListRefresh: Set<string>;
  needsGameRefresh: Set<number>;
  needsPbpRefresh: Set<number>;
  needsFairbetRefresh: number; // counter, incremented per request

  // Mutations
  upsertFromList: (listKey: string, games: GameSummary[]) => void;
  upsertFromDetail: (gameId: number, response: GameDetailResponse) => void;
  upsertFlow: (gameId: number, response: GameFlowResponse) => void;
  setActiveGame: (gameId: number | null) => void;

  // Realtime mutations
  applyGamePatch: (gameId: number, patch: Partial<GameCore>) => void;
  appendPbp: (gameId: number, newPlays: PlayEntry[]) => void;
  checkSeq: (channel: string, seq: number) => SeqCheckResult;
  commitSeq: (channel: string, seq: number) => void;
  markDesynced: (channel: string, value: boolean) => void;
  setRealtimeStatus: (status: TransportStatus) => void;

  // Recovery flag mutations
  requestListRefresh: (listKey: string) => void;
  requestGameRefresh: (gameId: number) => void;
  requestPbpRefresh: (gameId: number) => void;
  requestFairbetRefresh: () => void;
  clearListRefresh: (listKey: string) => void;
  clearGameRefresh: (gameId: number) => void;
  clearPbpRefresh: (gameId: number) => void;
  clearFairbetRefresh: (counter: number) => void;

  // Selectors (stable references when data unchanged)
  getGame: (id: number) => GameEntry | undefined;
  getCore: (id: number) => GameCore | undefined;
  getDetail: (id: number) => GameDetailResponse | undefined;
  getFlow: (id: number) => GameFlowResponse | undefined;
  isDetailFresh: (id: number) => boolean;
  isFlowFresh: (id: number) => boolean;
}

// ─── Store ────────────────────────────────────────────────────────

export const useGameData = create<GameDataState>()((set, get) => ({
  games: new Map<number, GameEntry>(),
  listFetches: new Map<string, ListFetchMeta>(),
  activeGameId: null,
  seqByChannel: new Map<string, number>(),
  desyncedByChannel: new Map<string, boolean>(),
  realtimeStatus: { mode: "offline" as const, connected: false, lastEventAt: 0 },
  needsListRefresh: new Set<string>(),
  needsGameRefresh: new Set<number>(),
  needsPbpRefresh: new Set<number>(),
  needsFairbetRefresh: 0,

  upsertFromList: (listKey, summaries) => {
    set((s) => {
      const next = new Map(s.games);
      const ids: number[] = [];
      const now = Date.now();

      for (const g of summaries) {
        ids.push(g.id);
        const existing = next.get(g.id);
        const core = coreFromSummary(g);
        // Preserve clock/period from previous core when new data lacks them
        if (existing) {
          if (!core.gameClock && existing.core.gameClock) {
            core.gameClock = existing.core.gameClock;
          }
          if (!core.currentPeriodLabel && existing.core.currentPeriodLabel) {
            core.currentPeriodLabel = existing.core.currentPeriodLabel;
          }
        }
        if (existing) {
          // Don't overwrite core with list data when the detail page
          // recently polled fresher scores for this game.
          const detailIsFresh =
            existing.detail != null &&
            now - existing.detail.fetchedAt < CACHE.GAME_DETAIL_TTL_MS;
          next.set(g.id, {
            ...existing,
            core: detailIsFresh ? existing.core : core,
            coreUpdatedAt: detailIsFresh ? existing.coreUpdatedAt : now,
          });
        } else {
          next.set(g.id, {
            core,
            coreUpdatedAt: now,
            detail: null,
            flow: null,
          });
        }
      }

      const nextList = new Map(s.listFetches);
      nextList.set(listKey, { fetchedAt: now, gameIds: ids });

      return { games: next, listFetches: nextList };
    });
  },

  upsertFromDetail: (gameId, response) => {
    set((s) => {
      const next = new Map(s.games);
      const now = Date.now();
      const existing = next.get(gameId);
      const core = coreFromGame(response.game, response.plays);
      // Preserve clock/period from previous core when detail lacks them
      if (existing) {
        if (!core.gameClock && existing.core.gameClock) {
          core.gameClock = existing.core.gameClock;
        }
        if (!core.currentPeriodLabel && existing.core.currentPeriodLabel) {
          core.currentPeriodLabel = existing.core.currentPeriodLabel;
        }
      }

      next.set(gameId, {
        core,
        coreUpdatedAt: now,
        detail: { response, fetchedAt: now },
        flow: existing?.flow ?? null,
      });

      return { games: next };
    });
  },

  upsertFlow: (gameId, response) => {
    set((s) => {
      const next = new Map(s.games);
      const now = Date.now();
      const existing = next.get(gameId);
      if (!existing) return s;

      next.set(gameId, {
        ...existing,
        flow: { response, fetchedAt: now },
      });

      return { games: next };
    });
  },

  setActiveGame: (gameId) => set({ activeGameId: gameId }),

  // ── Realtime mutations ──────────────────────────────────────

  applyGamePatch: (gameId, patch) => {
    set((s) => {
      const next = new Map(s.games);
      const existing = next.get(gameId);
      if (existing) {
        const merged = { ...existing.core, ...patch };
        // PBP is the source of truth for scores. When we have PBP data,
        // don't let a game_patch overwrite scores with potentially stale
        // Game-object values — keep the PBP-derived scores instead.
        if (existing.detail?.response.plays?.length) {
          const plays = existing.detail.response.plays;
          const lastPlay = plays[plays.length - 1];
          if (lastPlay?.homeScore != null && lastPlay?.awayScore != null) {
            merged.homeScore = lastPlay.homeScore;
            merged.awayScore = lastPlay.awayScore;
          }
        }
        // Don't let a stale patch revert a terminal status back to live.
        if (TERMINAL_STATUSES.includes(existing.core.status) && !TERMINAL_STATUSES.includes(merged.status)) {
          merged.status = existing.core.status;
        }
        // Keep boolean flags consistent with status.
        if (TERMINAL_STATUSES.includes(merged.status)) {
          merged.isLive = false;
          merged.isFinal = true;
        }
        // liveSnapshot is SSOT for clock/period; fall back to patch/previous core.
        merged.gameClock =
          merged.liveSnapshot?.gameClock ??
          merged.liveSnapshot?.timeLabel ??
          merged.gameClock ??
          existing.core.gameClock;
        merged.currentPeriodLabel =
          merged.liveSnapshot?.periodLabel ??
          merged.currentPeriodLabel ??
          existing.core.currentPeriodLabel;
        next.set(gameId, {
          ...existing,
          core: merged,
          coreUpdatedAt: Date.now(),
        });
      } else {
        // Don't drop patches for unknown games — create a minimal entry so the patch applies
        const minimalCore: GameCore = {
          id: gameId,
          leagueCode: "",
          gameDate: "",
          status: "scheduled" as GameStatus,
          homeTeam: "",
          awayTeam: "",
          homeScore: null,
          awayScore: null,
          ...patch,
        };
        next.set(gameId, {
          core: minimalCore,
          coreUpdatedAt: Date.now(),
          detail: null,
          flow: null,
        });
      }
      return { games: next };
    });
  },

  appendPbp: (gameId, newPlays) => {
    set((s) => {
      const entry = s.games.get(gameId);
      if (!entry?.detail) return s;
      const existing = entry.detail.response.plays;
      // Prefer eventId for dedup, fallback to composite key (playIndex|gameClock|playType|description)
      const existingKeys = new Set(existing.map(pbpKey));
      const deduped = newPlays.filter((p) => !existingKeys.has(pbpKey(p)));
      if (deduped.length === 0) return s;
      const allPlays = [...existing, ...deduped];
      const lastPlay = allPlays[allPlays.length - 1];
      const clockFromPlay = lastPlay?.gameClock ?? lastPlay?.timeLabel;
      const periodFromPlay = lastPlay?.periodLabel;
      // PBP is the source of truth for scores — sync from the latest play
      const scoreFromPlay =
        lastPlay?.homeScore != null && lastPlay?.awayScore != null
          ? { homeScore: lastPlay.homeScore, awayScore: lastPlay.awayScore }
          : {};
      const next = new Map(s.games);
      next.set(gameId, {
        ...entry,
        core: {
          ...entry.core,
          // Keep clock up-to-date from the latest play (e.g. NCAAB
          // where the backend doesn't send a top-level gameClock)
          ...(clockFromPlay ? { gameClock: clockFromPlay } : {}),
          ...(periodFromPlay ? { currentPeriodLabel: periodFromPlay } : {}),
          ...scoreFromPlay,
        },
        detail: {
          ...entry.detail,
          response: {
            ...entry.detail.response,
            plays: allPlays,
          },
        },
      });
      return { games: next };
    });
  },

  // Separate seq check (read-only) from commit (mutate) so dispatcher can check before applying
  checkSeq: (channel, seq) => {
    const last = get().seqByChannel.get(channel) ?? 0;
    if (seq <= last) return "duplicate";
    if (last > 0 && seq > last + 1) return "gap";
    return "ok";
  },

  commitSeq: (channel, seq) => {
    const next = new Map(get().seqByChannel);
    next.set(channel, seq);
    set({ seqByChannel: next });
  },

  markDesynced: (channel, value) => {
    const next = new Map(get().desyncedByChannel);
    if (value) {
      next.set(channel, true);
    } else {
      next.delete(channel);
    }
    set({ desyncedByChannel: next });
  },

  setRealtimeStatus: (status) => set({ realtimeStatus: status }),

  // ── Recovery flag mutations ─────────────────────────────────

  requestListRefresh: (listKey) => {
    set((s) => {
      const next = new Set(s.needsListRefresh);
      next.add(listKey);
      return { needsListRefresh: next };
    });
  },

  requestGameRefresh: (gameId) => {
    set((s) => {
      const next = new Set(s.needsGameRefresh);
      next.add(gameId);
      return { needsGameRefresh: next };
    });
  },

  requestPbpRefresh: (gameId) => {
    set((s) => {
      const next = new Set(s.needsPbpRefresh);
      next.add(gameId);
      return { needsPbpRefresh: next };
    });
  },

  requestFairbetRefresh: () => {
    set((s) => ({ needsFairbetRefresh: s.needsFairbetRefresh + 1 }));
  },

  clearListRefresh: (listKey) => {
    set((s) => {
      const next = new Set(s.needsListRefresh);
      next.delete(listKey);
      return { needsListRefresh: next };
    });
  },

  clearGameRefresh: (gameId) => {
    set((s) => {
      const next = new Set(s.needsGameRefresh);
      next.delete(gameId);
      return { needsGameRefresh: next };
    });
  },

  clearPbpRefresh: (gameId) => {
    set((s) => {
      const next = new Set(s.needsPbpRefresh);
      next.delete(gameId);
      return { needsPbpRefresh: next };
    });
  },

  clearFairbetRefresh: (counter) => {
    set((s) => {
      // Only clear if no new requests came in since we started
      if (s.needsFairbetRefresh === counter) {
        return { needsFairbetRefresh: 0 };
      }
      return s;
    });
  },

  // ── Selectors ───────────────────────────────────────────────

  getGame: (id) => get().games.get(id),
  getCore: (id) => get().games.get(id)?.core,
  getDetail: (id) => get().games.get(id)?.detail?.response,
  getFlow: (id) => get().games.get(id)?.flow?.response,

  isDetailFresh: (id) => {
    const entry = get().games.get(id)?.detail;
    if (!entry) return false;
    return Date.now() - entry.fetchedAt < CACHE.GAME_DETAIL_TTL_MS;
  },

  isFlowFresh: (id) => {
    const entry = get().games.get(id)?.flow;
    if (!entry) return false;
    return Date.now() - entry.fetchedAt < CACHE.FLOW_TTL_MS;
  },
}));
