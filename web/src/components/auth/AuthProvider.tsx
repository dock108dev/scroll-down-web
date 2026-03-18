"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/stores/auth";
import { POLLING } from "@/lib/config";
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
 *
 * When "Stay logged in" is active, silently refreshes the JWT on a
 * background interval so the session doesn't expire mid-use.
 */
export function AuthProvider() {
  const token = useAuth((s) => s.token);
  const rememberMe = useAuth((s) => s.rememberMe);
  const refreshMe = useAuth((s) => s.refreshMe);
  const refreshToken = useAuth((s) => s.refreshToken);
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

  // Background token refresh — keeps session alive when "Stay logged in" is on
  useEffect(() => {
    if (!token || !rememberMe) return;
    const id = setInterval(() => {
      refreshToken();
    }, POLLING.TOKEN_REFRESH_MS);
    return () => clearInterval(id);
  }, [token, rememberMe, refreshToken]);

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
