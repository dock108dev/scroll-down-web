"use client";

import { useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth, AuthError } from "@/stores/auth";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const resetPassword = useAuth((s) => s.resetPassword);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      const errs: Record<string, string> = {};
      if (password.length < 8) {
        errs.password = "Password must be at least 8 characters";
      }
      if (password !== confirmPassword) {
        errs.confirmPassword = "Passwords don't match";
      }
      setFieldErrors(errs);
      if (Object.keys(errs).length > 0) return;

      if (!token) {
        setError("Invalid or missing reset token");
        return;
      }

      try {
        setLoading(true);
        await resetPassword(token, password);
        setSuccess(true);
      } catch (err) {
        if (err instanceof AuthError) {
          if (err.status === 400 || err.status === 404) {
            setError("This reset link is invalid or has expired. Request a new one.");
          } else {
            setError(err.message);
          }
        } else {
          setError("Something went wrong. Try again.");
        }
      } finally {
        setLoading(false);
      }
    },
    [password, confirmPassword, token, resetPassword],
  );

  if (!token) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12 text-center space-y-4">
        <h1 className="text-xl font-bold text-neutral-100">Invalid link</h1>
        <p className="text-sm text-neutral-400">
          This password reset link is missing a token.
        </p>
        <Link
          href="/forgot-password"
          className="inline-block text-sm text-blue-400 hover:text-blue-300 mt-4"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12 text-center space-y-4">
        <h1 className="text-xl font-bold text-neutral-100">Password reset</h1>
        <p className="text-sm text-neutral-400">
          Your password has been updated. You can now log in.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium rounded-lg px-6 py-2.5 bg-blue-600 text-white transition-colors hover:bg-blue-500 mt-4"
        >
          Log In
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-xl font-bold text-neutral-100 text-center mb-2">
        Set a new password
      </h1>
      <p className="text-sm text-neutral-500 text-center mb-6">
        Enter your new password below.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            New Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            className="w-full text-sm rounded-lg px-3 py-2.5 bg-neutral-900 text-neutral-200 border border-neutral-800 outline-none focus:border-neutral-600 transition"
            placeholder="Min 8 characters"
          />
          {fieldErrors.password && (
            <p className="text-xs text-red-400">{fieldErrors.password}</p>
          )}
        </div>

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
            <p className="text-xs text-red-400">{fieldErrors.confirmPassword}</p>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full text-sm font-medium rounded-lg px-4 py-2.5 bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Resetting..." : "Reset Password"}
        </button>
      </form>

      <p className="text-xs text-neutral-500 text-center mt-6">
        <Link href="/forgot-password" className="text-blue-400 hover:text-blue-300">
          Request a new reset link
        </Link>
      </p>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-sm px-4 py-12 text-center">
          <div className="h-6 w-48 bg-neutral-800 rounded animate-pulse mx-auto" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
