import { create } from "zustand";

export type SessionStatus = "loading" | "authenticated" | "anonymous";

interface SessionResponse {
  authenticated: boolean;
  userId?: string;
  email?: string;
  tier?: "free" | "pro";
}

interface SessionState {
  status: SessionStatus;
  email: string | null;
  tier: "free" | "pro";
  userId: string | null;
  /** Fetch /api/auth/session and hydrate store from the HttpOnly cookie */
  refresh: () => Promise<void>;
  /** POST /api/auth/sign-out, clear cookie, reset to anonymous */
  signOut: () => Promise<void>;
}

export const useSession = create<SessionState>()((set) => ({
  status: "loading",
  email: null,
  tier: "free",
  userId: null,

  refresh: async () => {
    try {
      const res = await fetch("/api/auth/session", { credentials: "same-origin" });
      if (!res.ok) {
        set({ status: "anonymous", email: null, tier: "free", userId: null });
        return;
      }
      const data = (await res.json()) as SessionResponse;
      if (data.authenticated) {
        set({
          status: "authenticated",
          email: data.email ?? null,
          tier: data.tier ?? "free",
          userId: data.userId ?? null,
        });
      } else {
        set({ status: "anonymous", email: null, tier: "free", userId: null });
      }
    } catch {
      set({ status: "anonymous", email: null, tier: "free", userId: null });
    }
  },

  signOut: async () => {
    try {
      await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin" });
    } catch {
      // Ignore network errors — reset local state regardless
    }
    set({ status: "anonymous", email: null, tier: "free", userId: null });
  },
}));
