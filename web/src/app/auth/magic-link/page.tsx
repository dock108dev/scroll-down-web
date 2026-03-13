"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth, AuthError } from "@/stores/auth";

function MagicLinkVerify() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const verifyMagicLink = useAuth((s) => s.verifyMagicLink);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    (async () => {
      try {
        await verifyMagicLink(token);
        if (!cancelled) router.replace("/");
      } catch (err) {
        if (cancelled) return;
        if (err instanceof AuthError) {
          setError("This sign-in link is invalid or has expired.");
        } else {
          setError("Something went wrong. Try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, verifyMagicLink, router]);

  if (!token) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12 text-center space-y-4">
        <h1 className="text-xl font-bold text-neutral-100">Invalid link</h1>
        <p className="text-sm text-neutral-400">
          This sign-in link is missing a token.
        </p>
        <Link
          href="/login"
          className="inline-block text-sm text-blue-400 hover:text-blue-300 mt-4"
        >
          Go to login
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-sm px-4 py-12 text-center space-y-4">
        <h1 className="text-xl font-bold text-neutral-100">Link expired</h1>
        <p className="text-sm text-neutral-400">{error}</p>
        <Link
          href="/login"
          className="inline-block text-sm font-medium rounded-lg px-6 py-2.5 bg-blue-600 text-white transition-colors hover:bg-blue-500 mt-4"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12 text-center space-y-4">
      <h1 className="text-xl font-bold text-neutral-100">Signing you in...</h1>
      <div className="h-1 w-24 bg-neutral-800 rounded mx-auto overflow-hidden">
        <div className="h-full w-1/2 bg-blue-500 rounded animate-pulse" />
      </div>
    </div>
  );
}

export default function MagicLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-sm px-4 py-12 text-center">
          <div className="h-6 w-48 bg-neutral-800 rounded animate-pulse mx-auto" />
        </div>
      }
    >
      <MagicLinkVerify />
    </Suspense>
  );
}
