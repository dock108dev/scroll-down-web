import type { SocialPostEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────

const NAMED_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&#39;": "'",
};

function decodeHTMLEntities(text: string): string {
  // Hex entities: &#x1F525;
  let result = text.replace(/&#x([0-9A-Fa-f]+);/g, (_, hex) => {
    const code = parseInt(hex, 16);
    return code > 0 ? String.fromCodePoint(code) : "";
  });
  // Decimal entities: &#128293;
  result = result.replace(/&#(\d+);/g, (_, dec) => {
    const code = parseInt(dec, 10);
    return code > 0 ? String.fromCodePoint(code) : "";
  });
  // Named entities
  for (const [entity, char] of Object.entries(NAMED_ENTITIES)) {
    result = result.replaceAll(entity, char);
  }
  return result;
}

/** Port of iOS SocialPostRow.sanitizeTweetText */
export function sanitizeTweetText(text: string): string {
  let cleaned = decodeHTMLEntities(text);

  // Strip URLs (http/https, www, shortened like t.co/bit.ly)
  cleaned = cleaned.replace(
    /https?:\/\/[^\s)]+|www\.[^\s)]+|\b\w+\.(co|ly|me|io|gl)\/\S+/gi,
    "",
  );

  // Normalize Unicode separators (U+2028, U+2029) but preserve emoji variation selectors
  cleaned = cleaned.replace(/[\u2028\u2029]/g, " ");

  // Clean up leftover punctuation from removed URLs (trailing colons, etc.)
  cleaned = cleaned.replace(/:\s*$/gm, "");

  // Collapse multiple spaces/newlines
  cleaned = cleaned.replace(/[ \t]+/g, " ");
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

  return cleaned.trim();
}

export function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = Date.now();
  const diffMs = now - date.getTime();
  if (diffMs < 0) return "now";

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(days / 365);
  return `${years}y`;
}

export function compactNumber(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return k >= 10 ? `${Math.floor(k)}K` : `${k.toFixed(1).replace(/\.0$/, "")}K`;
  }
  const m = n / 1_000_000;
  return m >= 10 ? `${Math.floor(m)}M` : `${m.toFixed(1).replace(/\.0$/, "")}M`;
}

// ─── Component ────────────────────────────────────────────

interface SocialPostCardProps {
  post: SocialPostEntry;
  mode?: "standard" | "embedded";
}

export function SocialPostCard({ post, mode = "standard" }: SocialPostCardProps) {
  const isEmbedded = mode === "embedded";

  const cleanText = post.tweetText ? sanitizeTweetText(post.tweetText) : null;
  const hasImage = !!post.imageUrl;
  const hasVideo = !!post.videoUrl;
  const showVideoInline = hasVideo && !hasImage;

  return (
    <a
      href={post.postUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block rounded-lg border p-3 transition-colors hover:border-neutral-700",
        isEmbedded
          ? "bg-neutral-900/30 border-neutral-800/30"
          : "bg-neutral-900 border-neutral-800 shadow-sm",
      )}
    >
      {/* Attribution header */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-sm font-bold" aria-label="X">
          &#120143;
        </span>
        {post.sourceHandle && (
          <span className="text-xs text-neutral-400 truncate">
            @{post.sourceHandle}
          </span>
        )}
        {post.postedAt && (
          <span className="text-[11px] text-neutral-600">
            {relativeTime(post.postedAt)}
          </span>
        )}
        <span className="ml-auto text-neutral-600 text-xs">&#x2197;</span>
      </div>

      {/* Tweet text */}
      {cleanText && (
        <p className="text-sm text-neutral-200 leading-relaxed mb-2 whitespace-pre-line">
          {cleanText}
        </p>
      )}

      {/* Image with optional video play badge */}
      {hasImage && (
        <div className="relative rounded-md overflow-hidden mb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.imageUrl!}
            alt=""
            className="w-full h-auto max-h-72 object-cover"
            loading="lazy"
          />
          {post.hasVideo && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white ml-0.5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inline video (web advantage: native playback) */}
      {showVideoInline && (
        <div className="rounded-md overflow-hidden mb-2">
          <video
            src={post.videoUrl!}
            controls
            preload="metadata"
            className="w-full max-h-72"
            onClick={(e) => e.preventDefault()}
          />
        </div>
      )}

      {/* Engagement metrics (standard mode only) */}
      {!isEmbedded && (
        <div className="flex items-center gap-4 text-[11px] text-neutral-500 mt-1">
          {post.repliesCount != null && post.repliesCount > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z" />
              </svg>
              {compactNumber(post.repliesCount)}
            </span>
          )}
          {post.retweetsCount != null && post.retweetsCount > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M4.5 12c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662" />
              </svg>
              {compactNumber(post.retweetsCount)}
            </span>
          )}
          {post.likesCount != null && post.likesCount > 0 && (
            <span className="flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              {compactNumber(post.likesCount)}
            </span>
          )}
        </div>
      )}
    </a>
  );
}
