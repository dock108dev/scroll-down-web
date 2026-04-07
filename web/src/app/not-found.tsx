import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-6xl mb-4" aria-hidden="true">
        &#9918;
      </p>
      <h1 className="text-5xl font-bold text-neutral-50">404</h1>
      <p className="mt-3 text-sm text-neutral-400">
        Looks like that play got called back. This page doesn&apos;t exist or
        may have moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center text-sm font-medium text-blue-400 hover:text-blue-300 min-h-[44px] px-4 transition-colors"
      >
        &larr; Back to Games
      </Link>
    </div>
  );
}
