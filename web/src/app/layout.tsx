import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { TopNav } from "@/components/layout/TopNav";
import { BottomTabs } from "@/components/layout/BottomTabs";
import { SettingsDrawer } from "@/components/layout/SettingsDrawer";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { RealtimeProvider } from "@/components/layout/RealtimeProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Footer } from "@/components/layout/Footer";
import { BetaBanner } from "@/components/layout/BetaBanner";
import { DegradedBanner } from "@/components/layout/DegradedBanner";
import { AnalyticsProvider } from "@/components/layout/AnalyticsProvider";
import { RevealIDBProvider } from "@/components/layout/RevealIDBProvider";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { OfflineBanner } from "@/components/layout/OfflineBanner";
import { PWAInstallPrompt } from "@/components/layout/PWAInstallPrompt";
import { ProGateSheet } from "@/components/fairbet/ProGateSheet";
import { TierBootstrap } from "@/components/layout/TierBootstrap";

const SITE_URL = "https://scrolldownsports.dev";

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  title: {
    default: "Scroll Down Sports — Catch Up on Games Your Way",
    template: "%s | Scroll Down Sports",
  },
  description:
    "Follow MLB, NBA, NHL, and college basketball on your schedule. Live scores when you want them, play by play timelines, betting analytics, and matchup simulators in one place.",
  metadataBase: new URL(SITE_URL),
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
    siteName: "Scroll Down Sports",
    title: "Scroll Down Sports — Catch Up on Games Your Way",
    description:
      "Live scores when you want them, play by play timelines, betting analytics, and matchup simulators for MLB, NBA, NHL, and NCAAB.",
    url: SITE_URL,
    images: [{ url: "/app-icon.png", width: 1024, height: 1024, alt: "Scroll Down Sports" }],
  },
  twitter: {
    card: "summary",
    title: "Scroll Down Sports",
    description:
      "Live scores when you want them, real time timelines, and matchup simulators for MLB, NBA, NHL, and NCAAB.",
    images: ["/app-icon.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <Script
          defer
          data-domain="scrolldownsports.dev"
          src="https://plausible.io/js/script.js"
        />
        <Script id="sw-register" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
              navigator.serviceWorker.register('/sw.js').catch(function (err) {
                console.warn('SW registration failed:', err);
              });
            });
          }
        `}</Script>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Scroll Down Sports",
              url: SITE_URL,
              description:
                "Live scores when you want them, play by play timelines, betting analytics, and matchup simulators for MLB, NBA, NHL, and NCAAB.",
              applicationCategory: "SportsApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
              },
            }),
          }}
        />
      </head>
      <body className="bg-neutral-950 text-neutral-50 antialiased">
        <ThemeProvider>
          <AuthProvider />
          <SessionProvider />
          <TierBootstrap />
          <RealtimeProvider />
          <AnalyticsProvider />
          <RevealIDBProvider />
          <div className="min-h-screen flex flex-col">
            <OfflineBanner />
            <PWAInstallPrompt />
            <BetaBanner />
            <DegradedBanner />
            <TopNav />
            <main className="flex-1 min-h-[60vh] pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
              <div className="scroll-fade-top" />
              <div className="scroll-fade-bottom" />
              {children}
            </main>
            <Footer />
            <BottomTabs />
            <SettingsDrawer />
            <ProGateSheet />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
