import { cn } from "@/lib/utils";

type SkeletonVariant = "default" | "timelineRow" | "textBlock" | "list";

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

function TimelineRowSkeleton() {
  return (
    <div className="flex gap-3 items-start py-2 px-3">
      <div className="shrink-0 w-10">
        <Bar className="h-2.5 w-8" />
      </div>
      <div className="flex-1 space-y-1.5">
        <Bar className="h-3 w-3/4" />
        <Bar className="h-2.5 w-1/2" />
      </div>
      <div className="shrink-0">
        <Bar className="h-3 w-10" />
      </div>
    </div>
  );
}

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
 * Loading skeleton component.
 *
 * Variants:
 * - `default`      – simple rounded rectangle(s)
 * - `timelineRow`  – timeline event row with time, description, score
 * - `textBlock`    – paragraph-style text lines
 * - `list`         – generic row list with icon and two text lines
 */
export function LoadingSkeleton({
  className,
  count = 1,
  variant = "default",
}: LoadingSkeletonProps) {
  if (variant === "timelineRow") {
    return (
      <>
        {Array.from({ length: count }, (_, i) => (
          <TimelineRowSkeleton key={i} />
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

  return (
    <div data-testid="loading-skeleton">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={cn(
            "rounded-lg skeleton-shimmer",
            className ?? "h-20 w-full",
          )}
        />
      ))}
    </div>
  );
}
