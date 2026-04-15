"use client";

import { useCallback, useContext } from "react";
import { useAuth } from "@/stores/auth";
import { EntitlementContext, type OverrideState } from "./EntitlementProvider";
import { STORAGE_KEYS } from "@/lib/config";
import type { Capabilities, Tier } from "./capabilities";

export interface EntitlementAdminControls {
  capabilities: Capabilities;
  isSimulated: boolean;
  isAdmin: boolean;
  setTierOverride: (tier: Tier) => void;
  setCapabilityOverride: <K extends keyof Capabilities>(
    key: K,
    value: Capabilities[K],
  ) => void;
  resetOverride: () => void;
}

function writeOverride(state: OverrideState): void {
  sessionStorage.setItem(STORAGE_KEYS.ENTITLEMENT_OVERRIDE, JSON.stringify(state));
  window.dispatchEvent(
    new StorageEvent("storage", {
      key: STORAGE_KEYS.ENTITLEMENT_OVERRIDE,
      storageArea: sessionStorage,
    }),
  );
}

function readCurrentOverride(): OverrideState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEYS.ENTITLEMENT_OVERRIDE);
    if (!raw) return { active: false, tier: null, overrides: {} };
    return JSON.parse(raw) as OverrideState;
  } catch {
    return { active: false, tier: null, overrides: {} };
  }
}

export function useEntitlementAdmin(): EntitlementAdminControls {
  const { capabilities, isSimulated } = useContext(EntitlementContext);
  const role = useAuth((s) => s.role);
  const isAdmin = role === "admin";

  const setTierOverride = useCallback((tier: Tier) => {
    writeOverride({ active: true, tier, overrides: {} });
  }, []);

  const setCapabilityOverride = useCallback(
    <K extends keyof Capabilities>(key: K, value: Capabilities[K]) => {
      const current = readCurrentOverride();
      writeOverride({
        ...current,
        active: true,
        overrides: { ...current.overrides, [key]: value },
      });
    },
    [],
  );

  const resetOverride = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEYS.ENTITLEMENT_OVERRIDE);
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: STORAGE_KEYS.ENTITLEMENT_OVERRIDE,
        storageArea: sessionStorage,
      }),
    );
  }, []);

  return {
    capabilities,
    isSimulated,
    isAdmin,
    setTierOverride,
    setCapabilityOverride,
    resetOverride,
  };
}
