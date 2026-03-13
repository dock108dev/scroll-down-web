import { create } from "zustand";
import { persist } from "zustand/middleware";
import { STORAGE_KEYS } from "@/lib/config";
import { stopPreferenceSync } from "@/lib/preferences-sync";

export type Role = "guest" | "user" | "admin";

interface AuthState {
  token: string | null;
  role: Role;
  email: string | null;
  userId: number | null;
  isLoading: boolean;

  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
  updateEmail: (
    email: string,
    password: string,
  ) => Promise<void>;
  updatePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  deleteAccount: (password: string) => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  requestMagicLink: (email: string) => Promise<void>;
  verifyMagicLink: (token: string) => Promise<void>;
}

async function authFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: "Request failed" }));
    throw new AuthError(res.status, body.detail ?? "Request failed");
  }
  return res.json();
}

/** Build headers for authenticated JSON requests. Throws if no token. */
function authedJson(token: string | null): Record<string, string> {
  if (!token) throw new AuthError(401, "Not authenticated");
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      role: "guest" as Role,
      email: null,
      userId: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const data = await authFetch<{
            access_token: string;
            role: string;
          }>("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          set({
            token: data.access_token,
            role: data.role as Role,
          });
          // Populate email/userId from /auth/me
          await get().refreshMe();
        } finally {
          set({ isLoading: false });
        }
      },

      signup: async (email, password) => {
        set({ isLoading: true });
        try {
          const data = await authFetch<{
            access_token: string;
            role: string;
          }>("/api/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          set({
            token: data.access_token,
            role: data.role as Role,
          });
          await get().refreshMe();
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        stopPreferenceSync();
        set({
          token: null,
          role: "guest",
          email: null,
          userId: null,
        });
      },

      refreshMe: async () => {
        const { token } = get();
        if (!token) return;
        try {
          const data = await authFetch<{
            id: number | null;
            email: string | null;
            role: string;
          }>("/api/auth/me", {
            headers: authedJson(token),
          });
          set({
            email: data.email,
            userId: data.id,
            role: data.role as Role,
          });
        } catch (err) {
          if (err instanceof AuthError && err.status === 401) {
            // Token expired — clear auth state
            get().logout();
          }
        }
      },

      updateEmail: async (email, password) => {
        const data = await authFetch<{
          id: number;
          email: string;
          role: string;
        }>("/api/auth/me/email", {
          method: "PATCH",
          headers: authedJson(get().token),
          body: JSON.stringify({ email, password }),
        });
        set({ email: data.email });
      },

      updatePassword: async (currentPassword, newPassword) => {
        await authFetch("/api/auth/me/password", {
          method: "PATCH",
          headers: authedJson(get().token),
          body: JSON.stringify({
            current_password: currentPassword,
            new_password: newPassword,
          }),
        });
      },

      forgotPassword: async (email) => {
        await authFetch("/api/auth/forgot-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            redirect_url: window.location.origin,
          }),
        });
      },

      resetPassword: async (token, newPassword) => {
        await authFetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, new_password: newPassword }),
        });
      },

      requestMagicLink: async (email) => {
        await authFetch("/api/auth/magic-link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            redirect_url: window.location.origin,
          }),
        });
      },

      verifyMagicLink: async (token) => {
        set({ isLoading: true });
        try {
          const data = await authFetch<{
            access_token: string;
            role: string;
          }>("/api/auth/magic-link/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });
          set({
            token: data.access_token,
            role: data.role as Role,
          });
          await get().refreshMe();
        } finally {
          set({ isLoading: false });
        }
      },

      deleteAccount: async (password) => {
        await authFetch("/api/auth/me", {
          method: "DELETE",
          headers: authedJson(get().token),
          body: JSON.stringify({ password }),
        });
        get().logout();
      },
    }),
    {
      name: STORAGE_KEYS.AUTH,
      partialize: (state) => ({
        token: state.token,
        role: state.role,
        email: state.email,
        userId: state.userId,
      }),
    },
  ),
);
