"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { ADSENSE_CLIENT_ID } from "@/lib/ads/config";

type AdFormat = "auto" | "rectangle" | "horizontal";

interface AdSlotProps {
  slot: string;
  format?: AdFormat;
  className?: string;
  minHeight?: number;
  label?: string;
}

const subscribeMount = () => () => {};
const getClientMount = () => true;
const getServerMount = () => false;

/**
 * Generic manual AdSense slot. Holds layout space with an aria-hidden div
 * pre-mount to avoid CLS, then swaps in the <ins> tag and pushes once per
 * component instance. The ref guard prevents StrictMode double-pushes; the
 * try/catch swallows ad-blocker errors silently.
 */
export function AdSlot({
  slot,
  format = "auto",
  className,
  minHeight,
  label,
}: AdSlotProps) {
  const mounted = useSyncExternalStore(subscribeMount, getClientMount, getServerMount);
  const pushed = useRef(false);

  useEffect(() => {
    if (!mounted || pushed.current) return;
    if (!slot || !ADSENSE_CLIENT_ID) return;
    pushed.current = true;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      w.adsbygoogle = w.adsbygoogle || [];
      w.adsbygoogle.push({});
    } catch {
      // Ad blocker or script not loaded — fail silently. AdSense errors are
      // never user-actionable. See docs/audits/error-handling-report.md §D1.
    }
  }, [mounted, slot]);

  if (!slot) return null;

  const placeholderStyle = minHeight ? { minHeight } : undefined;

  if (!mounted) {
    return (
      <div
        aria-hidden
        className={className}
        style={placeholderStyle}
      />
    );
  }

  return (
    <div
      className={className}
      style={placeholderStyle}
      aria-label={label ?? "Advertisement"}
    >
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={format === "auto" ? "true" : "false"}
      />
    </div>
  );
}
