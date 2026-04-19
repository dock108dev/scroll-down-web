"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth, AuthError } from "@/stores/auth";
import { VALIDATION } from "@/lib/config";
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";

type Tab = "login" | "signup";

const shakeKeyframes = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  15% { transform: translateX(-6px); }
  30% { transform: translateX(6px); }
  45% { transform: translateX(-4px); }
  60% { transform: translateX(4px); }
  75% { transform: translateX(-2px); }
  90% { transform: translateX(2px); }
}
`;

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
  const { login, signup, isLoading } = useAuth();
  const [isSendingLink, setIsSendingLink] = useState(false);

  const initialTab = searchParams.get("tab") === "signup" ? "signup" : "login";
  const reason = searchParams.get("reason");
  const rawRedirect = searchParams.get("redirect");
  // Only allow safe internal paths — prevent open redirects (including backslash-bypass like /\evil.com)
  const redirectTo = rawRedirect && /^\/[^/\\]/.test(rawRedirect) ? rawRedirect : null;
  const [tab, setTab] = useState<Tab>(initialTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [shaking, setShaking] = useState(false);
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current);
    };
  }, []);

  const validate = useCallback(() => {
    const errs: Record<string, string> = {};
    if (!email) {
      errs.email = "Email is required";
    } else if (!VALIDATION.EMAIL_RE.test(email)) {
      errs.email = "Enter a valid email address";
    }
    if (!password) {
      errs.password = "Password is required";
    } else if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
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
      if (field === "email") {
        if (!email || !VALIDATION.EMAIL_RE.test(email)) {
          next.email = !email ? "Email is required" : "Enter a valid email address";
        } else {
          delete next.email;
        }
      }
      if (field === "password") {
        if (password.length > 0 && password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
          next.password = "Password must be at least 8 characters";
        } else if (password.length === 0 && submitted) {
          next.password = "Password is required";
        } else {
          delete next.password;
        }
      }
      if (field === "confirmPassword" && confirmPassword && password !== confirmPassword) {
        next.confirmPassword = "Passwords don't match";
      } else if (field === "confirmPassword") {
        delete next.confirmPassword;
      }
      return next;
    });
  }, [email, password, confirmPassword, submitted]);

  // Re-validate on every change after first failed submit
  useEffect(() => {
    if (!submitted) return;
    const errs: Record<string, string> = {};
    if (!email) {
      errs.email = "Email is required";
    } else if (!VALIDATION.EMAIL_RE.test(email)) {
      errs.email = "Enter a valid email address";
    }
    if (!password) {
      errs.password = "Password is required";
    } else if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
      errs.password = "Password must be at least 8 characters";
    }
    if (tab === "signup" && password !== confirmPassword) {
      errs.confirmPassword = "Passwords don't match";
    }
    setFieldErrors(errs);
  }, [submitted, email, password, confirmPassword, tab]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSubmitted(true);
      const isValid = validate();
      if (!isValid) {
        // Show a visible error message as a fallback
        setError("Please fill in the required fields.");
        // Shake the form and focus first errored field
        setShaking(true);
        if (shakeTimer.current) clearTimeout(shakeTimer.current);
        shakeTimer.current = setTimeout(() => setShaking(false), 500);
        if (!email || !VALIDATION.EMAIL_RE.test(email)) {
          emailRef.current?.focus();
        } else if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
          passwordRef.current?.focus();
        }
        return;
      }

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
          } else if (err.status >= 500) {
            setError("Server is temporarily unavailable. Please try again later.");
          } else {
            setError(err.message);
          }
        } else {
          setError("Unable to connect. Check your internet and try again.");
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
    setIsSendingLink(true);
    try {
      await fetch("/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setMagicLinkSent(true);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setIsSendingLink(false);
    }
  }, [email]);

  return (
    <div className="mx-auto max-w-sm md:max-w-md px-4 py-12">
      <style dangerouslySetInnerHTML={{ __html: shakeKeyframes }} />
      <h1 className="text-xl font-bold text-neutral-100 text-center mb-6">
        {reason === "profile"
          ? "Sign in to your profile"
          : reason === "history"
            ? "Sign in for game history"
            : tab === "login"
              ? "Welcome back"
              : "Create an account"}
      </h1>

      {/* Redirect reason message */}
      {reason === "profile" && (
        <p className="text-xs text-neutral-400 text-center mb-4 bg-neutral-800/50 rounded-lg px-3 py-2">
          Sign in to view your profile, track predictions, and manage your account.
        </p>
      )}
      {reason === "history" && (
        <p className="text-xs text-neutral-400 text-center mb-4 bg-neutral-800/50 rounded-lg px-3 py-2">
          Sign in to browse past scores, search by team, and review completed games.
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

      <form onSubmit={handleSubmit} noValidate className={cn("space-y-4 rounded-lg transition-all duration-300", submitted && Object.keys(fieldErrors).length > 0 && "ring-1 ring-red-500/20 bg-red-500/[0.03] p-4 -mx-4")} style={shaking ? { animation: "shake 0.4s ease-in-out" } : undefined}>
        {/* Validation summary — top of form so it's immediately visible */}
        {submitted && !error && Object.keys(fieldErrors).length > 0 && (
          <div role="alert" data-testid="validation-summary" className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>Please fix the highlighted fields below.</span>
          </div>
        )}

        {/* Email */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Email
          </label>
          <input
            ref={emailRef}
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setFieldErrors((prev) => { const { email: _email, ...rest } = prev; return rest; }); }}
            onBlur={() => validateField("email")}
            autoComplete="email"
            aria-invalid={!!fieldErrors.email}
            className={cn(
              "w-full text-base rounded-lg px-3 py-2.5 bg-neutral-900 text-neutral-200 border outline-none transition",
              fieldErrors.email ? "border-red-500 ring-2 ring-red-500/30 focus:border-red-400 bg-neutral-900" : "border-neutral-800 focus:border-neutral-600",
            )}
            placeholder="you@example.com"
          />
          {fieldErrors.email && (
            <p role="alert" className="text-xs text-red-400 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {fieldErrors.email}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
            Password
          </label>
          <input
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFieldErrors((prev) => { const { password: _password, ...rest } = prev; return rest; }); }}
            onBlur={() => validateField("password")}
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            aria-invalid={!!fieldErrors.password}
            className={cn(
              "w-full text-base rounded-lg px-3 py-2.5 bg-neutral-900 text-neutral-200 border outline-none transition",
              fieldErrors.password ? "border-red-500 ring-2 ring-red-500/30 focus:border-red-400 bg-neutral-900" : "border-neutral-800 focus:border-neutral-600",
            )}
            placeholder="Min 8 characters"
          />
          {fieldErrors.password && (
            <p role="alert" className="text-xs text-red-400 flex items-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {fieldErrors.password}
            </p>
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
              aria-invalid={!!fieldErrors.confirmPassword}
              className={cn(
                "w-full text-base rounded-lg px-3 py-2.5 bg-neutral-900 text-neutral-200 border outline-none transition",
                fieldErrors.confirmPassword ? "border-red-500 ring-2 ring-red-500/30 focus:border-red-400 bg-neutral-900" : "border-neutral-800 focus:border-neutral-600",
              )}
              placeholder="Re-enter password"
            />
            {fieldErrors.confirmPassword && (
              <p role="alert" className="text-xs text-red-400 flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
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

        {/* API error */}
        {error && (
          <div role="alert" className="flex items-center gap-2 text-sm text-red-400 bg-red-500/15 border border-red-500/40 rounded-lg px-3 py-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{error}</span>
          </div>
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
              disabled={isLoading || isSendingLink}
              className="w-full text-sm font-medium rounded-lg px-4 py-2.5 bg-neutral-800 text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSendingLink ? "Sending…" : "Send me a sign-in link"}
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

      {/* Go back link when redirected from another page */}
      {redirectTo && (
        <p className="text-center mt-3">
          <Link
            href={redirectTo}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            &larr; Go back
          </Link>
        </p>
      )}
    </div>
  );
}
