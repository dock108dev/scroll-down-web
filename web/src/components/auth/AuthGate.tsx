"use client";

import Link from "next/link";
import { useAuth, type Role } from "@/stores/auth";
import { trackEvent } from "@/lib/analytics";

/**
 * Soft gate — renders children if the user has the required role,
 * otherwise shows a non-blocking prompt.
 */
export function AuthGate({
  minRole = "user",
  message = "Sign up for free to access this feature",
  showSignup = true,
  preview,
  children,
}: {
  minRole?: Role;
  message?: React.ReactNode;
  showSignup?: boolean;
  preview?: React.ReactNode;
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
    <div data-testid="auth-gate" className="relative">
      {preview && <div aria-hidden="true">{preview}</div>}
      <div className={`${preview ? "absolute inset-0 flex items-center justify-center" : ""} mx-auto max-w-md px-4 py-16 text-center space-y-4`}>
        <div className="rounded-lg border border-neutral-700 bg-neutral-900/80 px-6 py-8 space-y-4 shadow-lg">
          <p className="text-sm text-neutral-300">{message}</p>
          {showSignup && (
            <Link
              href="/login?tab=signup"
              onClick={() => trackEvent("signup_gate_click", { message: typeof message === "string" ? message : "custom" })}
              className="inline-block text-sm font-medium px-5 py-2.5 min-h-[44px] rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
            >
              Sign Up Free
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
