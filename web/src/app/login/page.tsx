"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth, AuthError } from "@/stores/auth";
import { VALIDATION } from "@/lib/config";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

type Tab = "login" | "signup";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, signup, requestMagicLink, isLoading } = useAuth();

  const initialTab = searchParams.get("tab") === "signup" ? "signup" : "login";
  const reason = searchParams.get("reason");
  const rawRedirect = searchParams.get("redirect");
  // Only allow safe internal paths — prevent open redirects
  const redirectTo = rawRedirect && /^\/[^/]/.test(rawRedirect) ? rawRedirect : null;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

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

  const validateField = useCallback((field: "email" | "password" | "confirmPassword") => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (field === "email" && email && !VALIDATION.EMAIL_RE.test(email)) {
        next.email = "Enter a valid email address";
      } else if (field === "email") {
        delete next.email;
      }
      if (field === "password" && password.length > 0 && password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
        next.password = "Password must be at least 8 characters";
      } else if (field === "password") {
        delete next.password;
      }
      if (field === "confirmPassword" && confirmPassword && password !== confirmPassword) {
        next.confirmPassword = "Passwords don't match";
      } else if (field === "confirmPassword") {
        delete next.confirmPassword;
      }
      return next;
    });
  }, [email, password, confirmPassword]);

  // Re-validate on every change after first failed submit
  useEffect(() => {
    if (!submitted) return;
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
    setFieldErrors(errs); // eslint-disable-line react-hooks/set-state-in-effect -- re-validate form fields as user types after first submit
  }, [submitted, email, password, confirmPassword, tab]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSubmitted(true);
      if (!validate()) return;

      try {
        if (tab === "login") {
          await login(email, password, rememberMe);
          trackEvent("login_success");
        } else {
          await signup(email, password);
          trackEvent("signup_success");
        }
        router.push(redirectTo || "/");
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
    [tab, email, password, rememberMe, validate, login, signup, router, redirectTo],
  );

  const handleMagicLink = useCallback(async () => {
    setError(null);
    if (!email || !VALIDATION.EMAIL_RE.test(email)) {
      setFieldErrors({ email: "Enter a valid email address" });
      return;
    }
    try {
      await requestMagicLink(email);
      setMagicLinkSent(true);
    } catch {
      setError("Something went wrong. Try again.");
    }
  }, [email, requestMagicLink]);

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-xl font-bold text-neutral-100 text-center mb-6">
        {tab === "login" ? "Welcome back" : "Create an account"}
      </h1>

      {/* Redirect reason message */}
      {reason === "profile" && (
        <p className="text-xs text-neutral-400 text-center mb-4 bg-neutral-800/50 rounded-lg px-3 py-2">
          Please log in to view your profile.
        </p>
      )}

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
                ? "bg-blue-600 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200",
            )}
          >
            {t === "login" ? "Log In" : "Sign Up"}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        {/* Email */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFieldErrors((prev) => { const { email: _, ...rest } = prev; return rest; }); }}
            onBlur={() => validateField("email")}
            autoComplete="email"
            aria-invalid={!!fieldErrors.email}
            className={cn(
              "w-full text-sm rounded-lg px-3 py-2.5 bg-neutral-900 text-neutral-200 border outline-none transition",
              fieldErrors.email ? "border-red-500 focus:border-red-400" : "border-neutral-800 focus:border-neutral-600",
            )}
            placeholder="you@example.com"
          />
          {fieldErrors.email && (
            <p role="alert" className="text-xs text-red-400">{fieldErrors.email}</p>
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
            onChange={(e) => { setPassword(e.target.value); setFieldErrors((prev) => { const { password: _, ...rest } = prev; return rest; }); }}
            onBlur={() => validateField("password")}
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            aria-invalid={!!fieldErrors.password}
            className={cn(
              "w-full text-sm rounded-lg px-3 py-2.5 bg-neutral-900 text-neutral-200 border outline-none transition",
              fieldErrors.password ? "border-red-500 focus:border-red-400" : "border-neutral-800 focus:border-neutral-600",
            )}
            placeholder="Min 8 characters"
          />
          {fieldErrors.password && (
            <p role="alert" className="text-xs text-red-400">{fieldErrors.password}</p>
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
              onBlur={() => validateField("confirmPassword")}
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

        {/* Forgot password + stay logged in (login only) */}
        {tab === "login" && (
          <div className="flex items-center justify-between -mt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none min-h-[44px] py-2">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="accent-blue-500 w-5 h-5 rounded"
              />
              <span className="text-xs text-neutral-400">Stay logged in</span>
            </label>
            <Link
              href="/forgot-password"
              className="text-xs text-blue-400 hover:text-blue-300 min-h-[44px] flex items-center px-2"
            >
              Forgot password?
            </Link>
          </div>
        )}

        {/* Validation summary (shown after submitting with errors) */}
        {submitted && Object.keys(fieldErrors).length > 0 && (
          <p role="alert" className="text-xs text-red-400 text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
            Please fix the highlighted fields above.
          </p>
        )}

        {/* API error */}
        {error && (
          <p role="alert" className="text-xs text-red-400 text-center bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>
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

        {/* Magic link (login tab only) */}
        {tab === "login" && !magicLinkSent && (
          <>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-neutral-800" />
              <span className="text-xs text-neutral-500">or</span>
              <div className="flex-1 h-px bg-neutral-800" />
            </div>
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={isLoading}
              className="w-full text-sm font-medium rounded-lg px-4 py-2.5 bg-neutral-800 text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Send me a sign-in link
            </button>
          </>
        )}

        {tab === "login" && magicLinkSent && (
          <p className="text-sm text-green-400 text-center">
            Check your email for a sign-in link.
          </p>
        )}
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
