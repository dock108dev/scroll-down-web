"use client";

import {
  createContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAuth } from "@/stores/auth";
import {
  TIER_CAPABILITIES,
  type Capabilities,
  type Tier,
} from "./capabilities";
import { STORAGE_KEYS } from "@/lib/config";

const OVERRIDE_KEY = STORAGE_KEYS.ENTITLEMENT_OVERRIDE;

export interface OverrideState {
  active: boolean;
  tier: Tier | null;
  overrides: Partial<Capabilities>;
}

const DEFAULT_OVERRIDE: OverrideState = {
  active: false,
  tier: null,
  overrides: {},
};

export interface EntitlementContextValue {
  capabilities: Capabilities;
  isSimulated: boolean;
}

export const EntitlementContext = createContext<EntitlementContextValue>({
  capabilities: TIER_CAPABILITIES.free,
  isSimulated: false,
});

function readOverride(): OverrideState {
  if (typeof window === "undefined") return DEFAULT_OVERRIDE;
  try {
    const raw = sessionStorage.getItem(OVERRIDE_KEY);
    if (!raw) return DEFAULT_OVERRIDE;
    const parsed = JSON.parse(raw) as OverrideState;
    if (typeof parsed.active !== "boolean") return DEFAULT_OVERRIDE;
    return parsed;
  } catch {
    return DEFAULT_OVERRIDE;
  }
}

function subscribeToStorage(cb: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.storageArea === sessionStorage && e.key === OVERRIDE_KEY) cb();
  };
  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
}

function getServerSnapshot(): OverrideState {
  return DEFAULT_OVERRIDE;
}

function resolveSubscriptionTier(role: string): Tier {
  return role === "admin" ? "pro" : "free";
}

export function EntitlementProvider({ children }: { children: ReactNode }) {
  const role = useAuth((s) => s.role);

  const override = useSyncExternalStore(
    subscribeToStorage,
    readOverride,
    getServerSnapshot,
  );

  const realTier = resolveSubscriptionTier(role);

  const capabilities = useMemo<Capabilities>(() => {
    if (!override.active) {
      return TIER_CAPABILITIES[realTier];
    }
    const base = override.tier
      ? TIER_CAPABILITIES[override.tier]
      : TIER_CAPABILITIES[realTier];
    return { ...base, ...override.overrides };
  }, [realTier, override]);

  const value = useMemo<EntitlementContextValue>(
    () => ({
      capabilities,
      isSimulated: override.active,
    }),
    [capabilities, override.active],
  );

  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  );
}
