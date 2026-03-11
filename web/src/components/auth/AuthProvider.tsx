"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/stores/auth";
import {
  pullAndStartSync,
  stopPreferenceSync,
  flushPreferences,
} from "@/lib/preferences-sync";

/**
 * Validates the stored JWT once after the auth store rehydrates.
 * Zustand persist rehydrates async — token is null on first render,
 * then populated from localStorage. We wait for a truthy token and
 * validate it exactly once via refreshMe().
 *
 * After validation, pulls server preferences and starts syncing
 * local changes back to the server.
 */
export function AuthProvider() {
  const token = useAuth((s) => s.token);
  const refreshMe = useAuth((s) => s.refreshMe);
  const validated = useRef(false);

  // Validate token + start preference sync on mount / login
  useEffect(() => {
    if (token && !validated.current) {
      validated.current = true;
      refreshMe().then(() => {
        // Only start sync if still authenticated after validation
        if (useAuth.getState().token) {
          pullAndStartSync();
        }
      });
    }
  }, [token, refreshMe]);

  // Stop syncing when user logs out (token goes null)
  useEffect(() => {
    if (!token && validated.current) {
      validated.current = false;
      stopPreferenceSync();
    }
  }, [token]);

  // Flush pending changes on tab close / navigate away
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushPreferences();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  return null;
}
