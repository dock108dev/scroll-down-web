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
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
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
