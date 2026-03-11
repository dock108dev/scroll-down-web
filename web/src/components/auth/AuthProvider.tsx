"use client";

import { useEffect } from "react";
import { useAuth } from "@/stores/auth";

/** Validates the stored JWT on app mount. Clears expired tokens. */
export function AuthProvider() {
  const token = useAuth((s) => s.token);
  const refreshMe = useAuth((s) => s.refreshMe);

  useEffect(() => {
    if (token) refreshMe();
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
