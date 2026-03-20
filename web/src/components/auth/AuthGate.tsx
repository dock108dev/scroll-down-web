"use client";

import Link from "next/link";
import { useAuth, type Role } from "@/stores/auth";

/**
 * Soft gate — renders children if the user has the required role,
 * otherwise shows a non-blocking prompt.
 */
export function AuthGate({
  minRole = "user",
  message = "Sign up for free to access this feature",
  children,
}: {
  minRole?: Role;
  message?: string;
  children: React.ReactNode;
}) {
  const role = useAuth((s) => s.role);

  const ROLE_RANK: Record<Role, number> = {
    guest: 0,
    user: 1,
    admin: 2,
  };

  if (ROLE_RANK[role] >= ROLE_RANK[minRole]) {
    return <>{children}</>;
  }

  return (
    <div data-testid="auth-gate" className="rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-6 text-center space-y-3">
      <p className="text-sm text-neutral-400">{message}</p>
      <Link
        href="/login?tab=signup"
        className="inline-block text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
      >
        Sign Up Free
      </Link>
    </div>
  );
}
