import { useAuth } from "@/stores/auth";
import { useTier } from "@/stores/tier";

/**
 * True when the user should have Pro-tier access. Either:
 *  - their purchased tier is "pro", or
 *  - they're an admin (admins always get full access).
 */
export function useIsPro(): boolean {
  const tier = useTier((s) => s.tier);
  const role = useAuth((s) => s.role);
  return tier === "pro" || role === "admin";
}

/** Non-hook variant for use outside React (stores, async actions). */
export function getIsPro(): boolean {
  return useTier.getState().tier === "pro" || useAuth.getState().role === "admin";
}
