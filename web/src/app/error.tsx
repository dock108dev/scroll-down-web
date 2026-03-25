"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-xl font-bold text-neutral-50">Something went wrong</h1>
      <p className="mt-2 text-sm text-neutral-400">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        className="mt-6 inline-block text-sm font-medium rounded-lg px-4 py-2 bg-blue-600 text-white hover:bg-blue-500 transition-colors"
      >
        Try again
      </button>
    </div>
  );
}
