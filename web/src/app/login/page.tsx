"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth, AuthError } from "@/stores/auth";
import { VALIDATION } from "@/lib/config";
import { cn } from "@/lib/utils";

type Tab = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { login, signup, isLoading } = useAuth();

  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!email || !VALIDATION.EMAIL_RE.test(email)) {
      errs.email = "Enter a valid email address";
    }
    if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
      errs.password = "Password must be at least 8 characters";
    }
    if (tab === "signup" && password !== confirmPassword) {
      errs.confirmPassword = "Passwords don't match";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  }, [email, password, confirmPassword, tab]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!validate()) return;

      try {
        if (tab === "login") {
          await login(email, password);
        } else {
          await signup(email, password);
        }
        router.push("/");
      } catch (err) {
        if (err instanceof AuthError) {
          if (err.status === 409) {
            setError("An account with this email already exists");
          } else if (err.status === 401) {
            setError("Invalid email or password");
          } else {
            setError(err.message);
          }
        } else {
          setError("Something went wrong. Try again.");
        }
      }
    },
    [tab, email, password, validate, login, signup, router],
  );

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-xl font-bold text-neutral-100 text-center mb-6">
        {tab === "login" ? "Welcome back" : "Create an account"}
      </h1>

      {/* Tabs */}
      <div className="flex rounded-lg bg-neutral-800 p-0.5 mb-6">
        {(["login", "signup"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setError(null);
              setFieldErrors({});
            }}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-all",
              tab === t
                ? "bg-neutral-600 text-neutral-50 shadow-sm"
                : "text-neutral-400 hover:text-neutral-200",
            )}
          >
            {t === "login" ? "Log In" : "Sign Up"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Email */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            className="w-full text-sm rounded-lg px-3 py-2.5 bg-neutral-900 text-neutral-200 border border-neutral-800 outline-none focus:border-neutral-600 transition"
            placeholder="you@example.com"
          />
          {fieldErrors.email && (
            <p className="text-xs text-red-400">{fieldErrors.email}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            className="w-full text-sm rounded-lg px-3 py-2.5 bg-neutral-900 text-neutral-200 border border-neutral-800 outline-none focus:border-neutral-600 transition"
            placeholder="Min 8 characters"
          />
          {fieldErrors.password && (
            <p className="text-xs text-red-400">{fieldErrors.password}</p>
          )}
        </div>

        {/* Confirm Password (signup only) */}
        {tab === "signup" && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full text-sm rounded-lg px-3 py-2.5 bg-neutral-900 text-neutral-200 border border-neutral-800 outline-none focus:border-neutral-600 transition"
              placeholder="Re-enter password"
            />
            {fieldErrors.confirmPassword && (
              <p className="text-xs text-red-400">
                {fieldErrors.confirmPassword}
              </p>
            )}
          </div>
        )}

        {/* Forgot password (login only) */}
        {tab === "login" && (
          <div className="text-right -mt-1">
            <Link
              href="/forgot-password"
              className="text-xs text-blue-400 hover:text-blue-300"
            >
              Forgot password?
            </Link>
          </div>
        )}

        {/* API error */}
        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full text-sm font-medium rounded-lg px-4 py-2.5 bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isLoading
            ? "Loading..."
            : tab === "login"
              ? "Log In"
              : "Create Account"}
        </button>
      </form>

      {/* Footer hint */}
      <p className="text-xs text-neutral-500 text-center mt-6">
        {tab === "login" ? (
          <>
            Don&apos;t have an account?{" "}
            <button
              onClick={() => setTab("signup")}
              className="text-blue-400 hover:text-blue-300"
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <button
              onClick={() => setTab("login")}
              className="text-blue-400 hover:text-blue-300"
            >
              Log in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
