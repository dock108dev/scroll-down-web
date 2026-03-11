"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/stores/auth";

/**
 * Validates the stored JWT once after the auth store rehydrates.
 * Zustand persist rehydrates async — token is null on first render,
 * then populated from localStorage. We wait for a truthy token and
 * validate it exactly once via refreshMe().
 */
export function AuthProvider() {
  const token = useAuth((s) => s.token);
  const refreshMe = useAuth((s) => s.refreshMe);
  const validated = useRef(false);

  useEffect(() => {
    if (token && !validated.current) {
      validated.current = true;
      refreshMe();
    }
  }, [token, refreshMe]);

  return null;
}
