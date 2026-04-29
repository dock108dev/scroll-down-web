"use client";

import Script from "next/script";
import { useAdGate } from "@/lib/ads/useAdGate";
import { ADSENSE_CLIENT_ID } from "@/lib/ads/config";

/**
 * Mounts the AdSense loader script for free-tier viewers only. Returns null
 * during SSR/pre-hydration and for pro/admin users so paid viewers never
 * fetch pagead2.googlesyndication.com. Uses the same SSOT gate as the named
 * ad components so a single change to ad-eligibility logic affects every
 * surface that touches AdSense.
 */
export function AdSenseScript() {
  if (!useAdGate()) return null;

  return (
    <Script
      id="adsense-loader"
      strategy="afterInteractive"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT_ID)}`}
      crossOrigin="anonymous"
    />
  );
}
