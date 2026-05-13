import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Next.js dev needs `'unsafe-eval'` (React Refresh runtime) and direct WS to
// the dev server for HMR. We only widen the CSP in dev; production stays
// locked down.
const scriptSrc = [
  "'self'",
  "'unsafe-inline'",
  "https://plausible.io",
  ...(isDev ? ["'unsafe-eval'"] : []),
].join(" ");

const connectSrc = [
  "'self'",
  "https://plausible.io",
  "https://sda.dock108.dev",
  "wss://sda.dock108.dev",
  ...(isDev ? ["ws://localhost:*", "http://localhost:*"] : []),
].join(" ");

const nextConfig: NextConfig = {
  output: "standalone",
  // When SCROLLDOWN_E2E_COVERAGE=1, emit browser source maps so monocart-reporter
  // can map v8 coverage from minified production bundles back to src/ paths.
  // Never enabled in real builds — sourcemaps add weight and leak code structure.
  productionBrowserSourceMaps: process.env.SCROLLDOWN_E2E_COVERAGE === "1",
  experimental: {
    scrollRestoration: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            // Deny every browser capability the app does not use. Listed
            // explicitly (rather than `*`) so future Permissions-Policy
            // additions don't silently grant access.
            value: [
              "camera=()",
              "microphone=()",
              "geolocation=()",
              "payment=()",
              "usb=()",
              "magnetometer=()",
              "accelerometer=()",
              "gyroscope=()",
              "interest-cohort=()",
              "browsing-topics=()",
            ].join(", "),
          },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          // Cross-origin isolation: the app has no OAuth pop-up handshake
          // and no cross-origin opener relationship to maintain. Locking
          // COOP cuts XS-Leak / Spectre-style attack surface from any
          // future opener or popup that does land on these pages. CORP is
          // intentionally NOT set — the OG image and PWA icons need to
          // remain embeddable by third-party preview/share scrapers.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src ${scriptSrc}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self'",
              `connect-src ${connectSrc}`,
              "worker-src 'self'",
              "frame-ancestors 'none'",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
      },
      {
        // Prevent caching on API routes that may contain user-specific data
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ];
  },
};

export default nextConfig;
