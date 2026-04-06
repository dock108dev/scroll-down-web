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

const SITE_URL = "https://scrolldownsports.dev";

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  title: {
    default: "Scroll Down Sports — Catch Up on Games Without Spoilers",
    template: "%s | Scroll Down Sports",
  },
  description:
    "Follow MLB, NBA, NHL, and college basketball on your schedule. Spoiler-free scores, play-by-play timelines, betting analytics, and Monte Carlo matchup simulators — all in one place.",
  metadataBase: new URL(SITE_URL),
  alternates: { canonical: "/" },
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
    title: "Scroll Down Sports — Catch Up on Games Without Spoilers",
    description:
      "Spoiler-free scores, play-by-play timelines, betting analytics, and Monte Carlo matchup simulators for MLB, NBA, NHL, and NCAAB.",
    url: SITE_URL,
    images: [{ url: "/app-icon.png", width: 1024, height: 1024, alt: "Scroll Down Sports" }],
  },
  twitter: {
    card: "summary",
    title: "Scroll Down Sports",
    description:
      "Spoiler-free scores, real-time timelines, and matchup simulators for MLB, NBA, NHL, and NCAAB.",
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Scroll Down Sports",
              url: SITE_URL,
              description:
                "Spoiler-free sports scores, play-by-play timelines, betting analytics, and Monte Carlo matchup simulators for MLB, NBA, NHL, and NCAAB.",
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
          <RealtimeProvider />
          <AnalyticsProvider />
          <div className="min-h-screen flex flex-col">
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
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
