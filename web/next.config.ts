import type { NextConfig } from "next";

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
              "script-src 'self' 'unsafe-inline' https://plausible.io https://partners.draftkings.com https://affiliates.betmgm.com https://pagead2.googlesyndication.com https://partner.googleadservices.com https://adservice.google.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://securepubads.g.doubleclick.net https://www.googletagservices.com https://www.gstatic.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://googleads.g.doubleclick.net https://www.gstatic.com https://www.google.com https://adservice.google.com https://cm.g.doubleclick.net https://stats.g.doubleclick.net",
              "font-src 'self'",
              "connect-src 'self' https://plausible.io https://sda.dock108.dev wss://sda.dock108.dev https://api.stripe.com https://partners.draftkings.com https://affiliates.betmgm.com https://pagead2.googlesyndication.com https://googleads.g.doubleclick.net https://adservice.google.com https://securepubads.g.doubleclick.net https://partner.googleadservices.com https://cm.g.doubleclick.net https://stats.g.doubleclick.net",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com https://pagead2.googlesyndication.com https://partner.googleadservices.com",
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
