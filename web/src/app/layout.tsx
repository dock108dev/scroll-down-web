import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { TopNav } from "@/components/layout/TopNav";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Footer } from "@/components/layout/Footer";
import { BetaBanner } from "@/components/layout/BetaBanner";
import { DegradedBanner } from "@/components/layout/DegradedBanner";
import { AnalyticsProvider } from "@/components/layout/AnalyticsProvider";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { PWAInstallPrompt } from "@/components/layout/PWAInstallPrompt";
import { FirstVisitGate } from "@/components/onboarding/FirstVisitGate";
import { getSiteHost, getSiteUrl, isNoIndexSite } from "@/lib/site-config";
import { jsonLdScript } from "@/lib/seo";

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export function generateMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  const noIndex = isNoIndexSite();
  const title = "Scroll Down MLB — Catch up on last night's game, no spoilers";
  const description =
    "Missed last night's game? Walk through the key plays one at a time and reveal the final score when you're ready.";
  return {
    title: { default: title, template: "%s | Scroll Down MLB" },
    description,
    metadataBase: new URL(siteUrl),
    alternates: { canonical: "/" },
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: "/apple-touch-icon.png",
    },
    openGraph: {
      type: "website",
      siteName: "Scroll Down MLB",
      title,
      description,
      url: siteUrl,
      images: [{ url: "/app-icon.png", width: 1024, height: 1024, alt: "Scroll Down MLB" }],
    },
    twitter: {
      card: "summary",
      title,
      description,
      images: ["/app-icon.png"],
    },
    robots: { index: !noIndex, follow: !noIndex },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const siteUrl = getSiteUrl();
  const plausibleDomain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN ?? getSiteHost();
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <Script
          defer
          data-domain={plausibleDomain}
          src="https://plausible.io/js/script.js"
        />
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            var host = location.hostname;
            var isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
            if (isLocal) {
              navigator.serviceWorker.getRegistrations().then(function (regs) {
                regs.forEach(function (r) { r.unregister(); });
              }).catch(function () {});
              if (window.caches && caches.keys) {
                caches.keys().then(function (keys) {
                  keys.forEach(function (k) { caches.delete(k); });
                }).catch(function () {});
              }
            } else {
              window.addEventListener('load', function () {
                navigator.serviceWorker.register('/sw.js').catch(function (err) {
                  console.warn('SW registration failed:', err);
                });
              });
            }
          }
        `}</Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            name: "Scroll Down MLB",
            url: siteUrl,
            description:
              "Spoiler-free catch-up on MLB games — walk through the key plays and reveal the final score when you're ready.",
            applicationCategory: "SportsApplication",
            operatingSystem: "Web",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
          })}
        />
      </head>
      <body className="bg-neutral-950 text-neutral-50 antialiased">
        <ThemeProvider>
          <AnalyticsProvider />
          <div className="min-h-screen flex flex-col">
            <OfflineBanner />
            <PWAInstallPrompt />
            <BetaBanner />
            <DegradedBanner />
            <TopNav />
            <main className="flex-1 min-h-[60vh]">
              <FirstVisitGate>{children}</FirstVisitGate>
            </main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
