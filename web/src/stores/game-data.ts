import { create } from "zustand";
import type {
  GameSummary,
  Game,
  GameDetailResponse,
  GameFlowResponse,
  GameStatus,
} from "@/lib/types";
import { CACHE } from "@/lib/config";

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

// ─── Store interface ──────────────────────────────────────────────

interface GameDataState {
  games: Map<number, GameEntry>;
  listFetches: Map<string, ListFetchMeta>;
  activeGameId: number | null;

  // Mutations
  upsertFromList: (league: string, games: GameSummary[]) => void;
  upsertFromDetail: (gameId: number, response: GameDetailResponse) => void;
  upsertFlow: (gameId: number, response: GameFlowResponse) => void;
  setActiveGame: (gameId: number | null) => void;

  // Selectors (stable references when data unchanged)
  getGame: (id: number) => GameEntry | undefined;
  getCore: (id: number) => GameCore | undefined;
  getDetail: (id: number) => GameDetailResponse | undefined;
  getFlow: (id: number) => GameFlowResponse | undefined;
  getListGameIds: (league: string) => number[];
  isDetailFresh: (id: number) => boolean;
  isFlowFresh: (id: number) => boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────

function coreFromSummary(g: GameSummary): GameCore {
  return {
    id: g.id,
    leagueCode: g.leagueCode,
    gameDate: g.gameDate,
    status: g.status,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    homeScore: g.homeScore ?? null,
    awayScore: g.awayScore ?? null,
    currentPeriod: g.currentPeriod,
    gameClock: g.gameClock,
    currentPeriodLabel: g.currentPeriodLabel,
    homeTeamAbbr: g.homeTeamAbbr,
    awayTeamAbbr: g.awayTeamAbbr,
    homeTeamColorLight: g.homeTeamColorLight,
    homeTeamColorDark: g.homeTeamColorDark,
    awayTeamColorLight: g.awayTeamColorLight,
    awayTeamColorDark: g.awayTeamColorDark,
    hasBoxscore: g.hasBoxscore,
    hasPlayerStats: g.hasPlayerStats,
    hasOdds: g.hasOdds,
    hasSocial: g.hasSocial,
    hasPbp: g.hasPbp,
    hasFlow: g.hasFlow,
    hasAdvancedStats: g.hasAdvancedStats,
    playCount: g.playCount,
    socialPostCount: g.socialPostCount,
    hasRequiredData: g.hasRequiredData,
    isLive: g.isLive,
    isFinal: g.isFinal,
    isPregame: g.isPregame,
    isTrulyCompleted: g.isTrulyCompleted,
    readEligible: g.readEligible,
    dateSection: g.dateSection,
    liveSnapshot: g.liveSnapshot,
  };
}

function coreFromGame(g: Game, plays?: { homeScore?: number; awayScore?: number }[]): GameCore {
  // Enrich with last play scores if available
  const lastPlay = plays?.length ? plays[plays.length - 1] : null;
  return {
    id: g.id,
    leagueCode: g.leagueCode,
    gameDate: g.gameDate,
    status: g.status,
    homeTeam: g.homeTeam,
    awayTeam: g.awayTeam,
    homeScore: lastPlay?.homeScore ?? g.homeScore ?? null,
    awayScore: lastPlay?.awayScore ?? g.awayScore ?? null,
    currentPeriod: g.currentPeriod,
    gameClock: g.gameClock,
    currentPeriodLabel: g.currentPeriodLabel,
    homeTeamAbbr: g.homeTeamAbbr,
    awayTeamAbbr: g.awayTeamAbbr,
    homeTeamColorLight: g.homeTeamColorLight,
    homeTeamColorDark: g.homeTeamColorDark,
    awayTeamColorLight: g.awayTeamColorLight,
    awayTeamColorDark: g.awayTeamColorDark,
    hasBoxscore: g.hasBoxscore,
    hasPlayerStats: g.hasPlayerStats,
    hasOdds: g.hasOdds,
    hasSocial: g.hasSocial,
    hasPbp: g.hasPbp,
    hasFlow: g.hasFlow,
    hasAdvancedStats: g.hasAdvancedStats,
    playCount: g.playCount,
    socialPostCount: g.socialPostCount,
    isLive: g.isLive,
    isFinal: g.isFinal,
    isPregame: g.isPregame,
    isTrulyCompleted: g.isTrulyCompleted,
    readEligible: g.readEligible,
    dateSection: g.dateSection,
    liveSnapshot: g.liveSnapshot,
    season: g.season,
    seasonType: g.seasonType,
    scrapeVersion: g.scrapeVersion,
    lastScrapedAt: g.lastScrapedAt,
    lastIngestedAt: g.lastIngestedAt,
    lastPbpAt: g.lastPbpAt,
    lastSocialAt: g.lastSocialAt,
    lastOddsAt: g.lastOddsAt,
    homeTeamXHandle: g.homeTeamXHandle,
    awayTeamXHandle: g.awayTeamXHandle,
  };
}

// ─── Store ────────────────────────────────────────────────────────

export const useGameData = create<GameDataState>()((set, get) => ({
  games: new Map<number, GameEntry>(),
  listFetches: new Map<string, ListFetchMeta>(),
  activeGameId: null,

  upsertFromList: (league, summaries) => {
    set((s) => {
      const next = new Map(s.games);
      const ids: number[] = [];
      const now = Date.now();

      for (const g of summaries) {
        ids.push(g.id);
        const existing = next.get(g.id);
        const core = coreFromSummary(g);
        if (existing) {
          next.set(g.id, {
            ...existing,
            core,
            coreUpdatedAt: now,
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
      nextList.set(league, { fetchedAt: now, gameIds: ids });

      return { games: next, listFetches: nextList };
    });
  },

  upsertFromDetail: (gameId, response) => {
    set((s) => {
      const next = new Map(s.games);
      const now = Date.now();
      const existing = next.get(gameId);
      const core = coreFromGame(response.game, response.plays);

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

  getGame: (id) => get().games.get(id),
  getCore: (id) => get().games.get(id)?.core,
  getDetail: (id) => get().games.get(id)?.detail?.response,
  getFlow: (id) => get().games.get(id)?.flow?.response,
  getListGameIds: (league) => get().listFetches.get(league)?.gameIds ?? [],

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
