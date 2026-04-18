"use client";

import { useEffect } from "react";
import { useSession } from "@/stores/session";

/** Mounts once at app root; hydrates session state from the sd-session cookie. */
export function SessionProvider() {
  const refresh = useSession((s) => s.refresh);
  useEffect(() => {
    refresh();
  }, [refresh]);
  return null;
}
