/**
 * Preference sync layer.
 *
 * - On login: pulls preferences from server → hydrates local stores.
 * - On store changes (while authed): debounced push to server.
 * - On logout: stops syncing, localStorage stays as-is.
 *
 * The backend endpoints (GET/PUT /auth/me/preferences) may not exist yet.
 * All calls are wrapped in try/catch so the app degrades gracefully.
 */

import { useAuth } from "@/stores/auth";
import { useSettings } from "@/stores/settings";
import { usePinnedGames } from "@/stores/pinned-games";
import { useReveal } from "@/stores/reveal";

// ─── Types ──────────────────────────────────────────────────────────

export interface ServerPreferences {
  settings: {
    theme: string;
    scoreRevealMode: string;
    preferredSportsbook: string;
    oddsFormat: string;
    autoResumePosition: boolean;
    homeExpandedSections: string[];
    hideLimitedData: boolean;
    timelineDefaultTiers: number[];
  };
  pinnedGameIds: number[];
  revealedGameIds: number[];
  updatedAt?: string;
}

// ─── API helpers ────────────────────────────────────────────────────

async function fetchPreferences(): Promise<ServerPreferences | null> {
  const token = useAuth.getState().token;
  if (!token) return null;

  const res = await fetch("/api/auth/me/preferences", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;
  return res.json();
}

async function pushPreferences(prefs: Omit<ServerPreferences, "updatedAt">): Promise<void> {
  const token = useAuth.getState().token;
  if (!token) return;

  await fetch("/api/auth/me/preferences", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(prefs),
  });
}

// ─── Snapshot current local state ───────────────────────────────────

function snapshotLocal(): Omit<ServerPreferences, "updatedAt"> {
  const settings = useSettings.getState();
  const pinned = usePinnedGames.getState();
  const reveal = useReveal.getState();

  return {
    settings: {
      theme: settings.theme,
      scoreRevealMode: settings.scoreRevealMode,
      preferredSportsbook: settings.preferredSportsbook,
      oddsFormat: settings.oddsFormat,
      autoResumePosition: settings.autoResumePosition,
      homeExpandedSections: settings.homeExpandedSections,
      hideLimitedData: settings.hideLimitedData,
      timelineDefaultTiers: settings.timelineDefaultTiers,
    },
    pinnedGameIds: [...pinned.pinnedIds],
    revealedGameIds: [...reveal.revealedIds],
  };
}

// ─── Hydrate local stores from server data ──────────────────────────

function hydrateFromServer(prefs: ServerPreferences) {
  const s = prefs.settings;

  // Settings store
  const setters = useSettings.getState();
  if (s.theme) setters.setTheme(s.theme as "system" | "light" | "dark");
  if (s.scoreRevealMode) setters.setScoreRevealMode(s.scoreRevealMode as "always" | "onMarkRead");
  if (s.preferredSportsbook !== undefined) setters.setPreferredSportsbook(s.preferredSportsbook);
  if (s.oddsFormat) setters.setOddsFormat(s.oddsFormat as "american" | "decimal" | "fractional");
  if (s.autoResumePosition !== undefined) setters.setAutoResumePosition(s.autoResumePosition);
  if (s.homeExpandedSections) setters.setHomeExpandedSections(s.homeExpandedSections);
  if (s.hideLimitedData !== undefined) setters.setHideLimitedData(s.hideLimitedData);
  if (s.timelineDefaultTiers) setters.setTimelineDefaultTiers(s.timelineDefaultTiers);

  // Pinned games — replace current set with server set.
  // We don't sync pinMeta (derived from game data on render).
  const pinnedStore = usePinnedGames.getState();
  const currentPins = pinnedStore.pinnedIds;
  const serverPins = new Set(prefs.pinnedGameIds ?? []);

  // Remove pins not on server
  for (const id of currentPins) {
    if (!serverPins.has(id)) pinnedStore.togglePin(id);
  }
  // Add pins from server
  for (const id of serverPins) {
    if (!currentPins.has(id)) pinnedStore.togglePin(id);
  }

  // Revealed games — union local + server (last-write-wins on the set)
  const revealStore = useReveal.getState();
  const serverRevealed = prefs.revealedGameIds ?? [];
  const toReveal = serverRevealed.filter((id) => !revealStore.revealedIds.has(id));
  if (toReveal.length > 0) {
    revealStore.revealBatch(
      toReveal.map((gameId) => ({
        gameId,
        snapshot: {
          homeScore: 0,
          awayScore: 0,
          status: "unknown",
          snapshotAt: new Date().toISOString(),
        },
      })),
    );
  }
}

// ─── Debounced push ─────────────────────────────────────────────────

let pushTimer: ReturnType<typeof setTimeout> | null = null;
const PUSH_DEBOUNCE_MS = 2_000;

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushPreferences(snapshotLocal()).catch(() => {
      // Silently fail — server may not support this yet
    });
  }, PUSH_DEBOUNCE_MS);
}

// ─── Subscription management ────────────────────────────────────────

let unsubscribers: (() => void)[] = [];

function startSyncing() {
  stopSyncing(); // Ensure clean state

  // Subscribe to each store's state changes (skip actions via shallow check)
  const unsubSettings = useSettings.subscribe(schedulePush);
  const unsubPinned = usePinnedGames.subscribe(schedulePush);
  const unsubReveal = useReveal.subscribe(schedulePush);

  unsubscribers = [unsubSettings, unsubPinned, unsubReveal];
}

function stopSyncing() {
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  for (const unsub of unsubscribers) unsub();
  unsubscribers = [];
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Called after a successful login / refreshMe.
 * Pulls server preferences then starts watching for local changes.
 */
export async function pullAndStartSync(): Promise<void> {
  try {
    const prefs = await fetchPreferences();
    if (prefs) {
      hydrateFromServer(prefs);
    }
  } catch {
    // Server may not support preferences yet — continue silently
  }

  startSyncing();
}

/**
 * Called on logout. Stops pushing changes.
 * localStorage is left as-is so non-authed browsing retains state.
 */
export function stopPreferenceSync(): void {
  stopSyncing();
}

/**
 * Immediately push current state to server (e.g. before tab close).
 */
export async function flushPreferences(): Promise<void> {
  if (!useAuth.getState().token) return;
  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }
  try {
    await pushPreferences(snapshotLocal());
  } catch {
    // best-effort
  }
}
