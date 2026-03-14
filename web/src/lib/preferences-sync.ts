/**
 * Preference sync layer.
 *
 * - On login: pulls preferences from server → hydrates local stores.
 * - On store changes (while authed): debounced push to server.
 * - On logout: stops syncing, localStorage stays as-is.
 */

import { useAuth } from "@/stores/auth";
import { useSettings } from "@/stores/settings";
import { usePinnedGames } from "@/stores/pinned-games";
import { useReveal } from "@/stores/reveal";

const TAG = "[prefs-sync]";

// ─── Types ──────────────────────────────────────────────────────────

interface ServerPreferences {
  settings: {
    theme: string;
    scoreRevealMode: string;
    preferredSportsbook: string;
    oddsFormat: string;
    autoResumePosition: boolean;
    homeExpandedSections: string[];
    hideLimitedData: boolean;
    timelineDefaultTiers: number[];
    followingLive: boolean;
    followingLiveAt: number;
  };
  pinnedGameIds: number[];
  revealedGameIds: number[];
  updatedAt?: string;
}

// ─── Hydration guard ────────────────────────────────────────────────

let isHydrating = false;

// ─── API helpers ────────────────────────────────────────────────────

async function fetchPreferences(): Promise<ServerPreferences | null> {
  const token = useAuth.getState().token;
  if (!token) return null;

  const res = await fetch("/api/auth/me/preferences", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    console.warn(`${TAG} fetchPreferences failed: ${res.status} ${res.statusText}`);
    return null;
  }
  return res.json();
}

async function pushPreferences(prefs: Omit<ServerPreferences, "updatedAt">): Promise<void> {
  const token = useAuth.getState().token;
  if (!token) return;

  const res = await fetch("/api/auth/me/preferences", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(prefs),
  });

  if (!res.ok) {
    console.warn(`${TAG} pushPreferences failed: ${res.status} ${res.statusText}`);
    throw new Error(`Push failed: ${res.status}`);
  }
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
      followingLive: settings.followingLive,
      followingLiveAt: settings.followingLiveAt,
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
  if (s.followingLive !== undefined) setters.setFollowingLive(s.followingLive);

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

  // Revealed games — server is SSOT for the ID set.
  // Local snapshots are kept (they're display-only cache).
  const revealStore = useReveal.getState();
  const serverRevealedSet = new Set(prefs.revealedGameIds ?? []);

  // Hide local reveals not on server
  const toHide = [...revealStore.revealedIds].filter((id) => !serverRevealedSet.has(id));
  if (toHide.length > 0) {
    revealStore.hideBatch(toHide);
  }

  // Add server reveals not in local
  const toReveal = [...serverRevealedSet].filter((id) => !revealStore.revealedIds.has(id));
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
  if (isHydrating) return;

  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    pushTimer = null;
    pushPreferences(snapshotLocal())
      .then(() => {
        console.info(`${TAG} pushed preferences to server`);
      })
      .catch((err) => {
        console.warn(`${TAG} push failed:`, err);
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
      isHydrating = true;
      try {
        hydrateFromServer(prefs);
      } finally {
        isHydrating = false;
      }
      console.info(`${TAG} pulled preferences from server`);
    }
  } catch (err) {
    console.warn(`${TAG} pull failed:`, err);
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
 * Uses keepalive so the request survives page unload.
 */
export function flushPreferences(): void {
  const token = useAuth.getState().token;
  if (!token) return;

  if (pushTimer) {
    clearTimeout(pushTimer);
    pushTimer = null;
  }

  const body = JSON.stringify(snapshotLocal());

  try {
    fetch("/api/auth/me/preferences", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body,
      keepalive: true,
    });
  } catch {
    // best-effort on unload
  }
}
