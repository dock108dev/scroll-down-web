import { cn } from "@/lib/utils";

type SkeletonVariant =
  | "default"
  | "gameCard"
  | "timelineRow"
  | "socialPost"
  | "textBlock"
  | "list";

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
  variant?: SkeletonVariant;
}

/** Reusable shimmer bar */
function Bar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded skeleton-shimmer",
        className ?? "h-3 w-full",
      )}
    />
  );
}

/** Single game-card skeleton matching iOS card layout */
function GameCardSkeleton() {
  return (
    <div className="card space-y-3">
      {/* League + status row */}
      <div className="flex items-center justify-between">
        <Bar className="h-2.5 w-12" />
        <Bar className="h-2.5 w-8" />
      </div>
      {/* Away team row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full skeleton-shimmer" />
          <Bar className="h-3 w-20" />
        </div>
        <Bar className="h-3 w-6" />
      </div>
      {/* Home team row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full skeleton-shimmer" />
          <Bar className="h-3 w-24" />
        </div>
        <Bar className="h-3 w-6" />
      </div>
    </div>
  );
}

/** Single timeline row skeleton */
function TimelineRowSkeleton() {
  return (
    <div className="flex gap-3 items-start py-2 px-3">
      {/* Time column */}
      <div className="shrink-0 w-10">
        <Bar className="h-2.5 w-8" />
      </div>
      {/* Content */}
      <div className="flex-1 space-y-1.5">
        <Bar className="h-3 w-3/4" />
        <Bar className="h-2.5 w-1/2" />
      </div>
      {/* Score */}
      <div className="shrink-0">
        <Bar className="h-3 w-10" />
      </div>
    </div>
  );
}

/** Social post skeleton */
function SocialPostSkeleton() {
  return (
    <div className="card space-y-3">
      {/* Author row */}
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-full skeleton-shimmer" />
        <Bar className="h-3 w-28" />
      </div>
      {/* Text lines */}
      <div className="space-y-1.5">
        <Bar className="h-3 w-full" />
        <Bar className="h-3 w-5/6" />
        <Bar className="h-3 w-2/3" />
      </div>
      {/* Media placeholder */}
      <div className="h-40 rounded-lg skeleton-shimmer" />
    </div>
  );
}

/** Text block skeleton (for narrative content) */
function TextBlockSkeleton() {
  return (
    <div className="space-y-2 py-2">
      <Bar className="h-3 w-full" />
      <Bar className="h-3 w-11/12" />
      <Bar className="h-3 w-4/5" />
      <Bar className="h-3 w-9/12" />
    </div>
  );
}

/** List skeleton (generic repeated rows) */
function ListSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-2 px-3">
          <div className="h-4 w-4 rounded skeleton-shimmer shrink-0" />
          <div className="flex-1 space-y-1">
            <Bar className="h-3 w-3/4" />
            <Bar className="h-2.5 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Loading skeleton component with variants matching iOS skeleton screens.
 *
 * Variants:
 * - `default`      – simple rounded rectangle(s)
 * - `gameCard`     – game card with team rows and score placeholders
 * - `timelineRow`  – timeline event row with time, description, score
 * - `socialPost`   – social media post with avatar, text, media
 * - `textBlock`    – paragraph-style text lines
 * - `list`         – generic row list with icon and two text lines
 */
export function LoadingSkeleton({
  className,
  count = 1,
  variant = "default",
}: LoadingSkeletonProps) {
  if (variant === "gameCard") {
    return (
      <>
        {Array.from({ length: count }, (_, i) => (
          <GameCardSkeleton key={i} />
        ))}
      </>
    );
  }

  if (variant === "timelineRow") {
    return (
      <>
        {Array.from({ length: count }, (_, i) => (
          <TimelineRowSkeleton key={i} />
        ))}
      </>
    );
  }

  if (variant === "socialPost") {
    return (
      <>
        {Array.from({ length: count }, (_, i) => (
          <SocialPostSkeleton key={i} />
        ))}
      </>
    );
  }

  if (variant === "textBlock") {
    return (
      <>
        {Array.from({ length: count }, (_, i) => (
          <TextBlockSkeleton key={i} />
        ))}
      </>
    );
  }

  if (variant === "list") {
    return <ListSkeleton count={count} />;
  }

  // Default: simple rectangles
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-lg skeleton-shimmer",
            className ?? "h-20 w-full",
          )}
        />
      ))}
    </>
  );
}
