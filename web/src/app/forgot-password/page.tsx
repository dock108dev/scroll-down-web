"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useAuth, AuthError } from "@/stores/auth";
import { VALIDATION } from "@/lib/config";

export default function ForgotPasswordPage() {
  const forgotPassword = useAuth((s) => s.forgotPassword);

  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!email || !VALIDATION.EMAIL_RE.test(email)) {
        setError("Enter a valid email address");
        return;
      }

      try {
        setLoading(true);
        await forgotPassword(email);
        setSubmitted(true);
      } catch (err) {
        if (err instanceof AuthError) {
          setError(err.message);
        } else {
          setError("Something went wrong. Try again.");
        }
      } finally {
        setLoading(false);
      }
    },
    [email, forgotPassword],
  );

  if (submitted) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12 text-center space-y-4">
        <h1 className="text-xl font-bold text-neutral-100">Check your email</h1>
        <p className="text-sm text-neutral-400">
          If an account exists for <span className="text-neutral-200">{email}</span>,
          we sent a link to reset your password.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm text-blue-400 hover:text-blue-300 mt-4"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-xl font-bold text-neutral-100 text-center mb-2">
        Reset your password
      </h1>
      <p className="text-sm text-neutral-500 text-center mb-6">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
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
        </div>

        {error && (
          <p className="text-xs text-red-400 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full text-sm font-medium rounded-lg px-4 py-2.5 bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? "Sending..." : "Send Reset Link"}
        </button>
      </form>

      <p className="text-xs text-neutral-500 text-center mt-6">
        Remember your password?{" "}
        <Link href="/login" className="text-blue-400 hover:text-blue-300">
          Log in
        </Link>
      </p>
    </div>
  );
}
