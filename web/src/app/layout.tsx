import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/layout/TopNav";
import { BottomTabs } from "@/components/layout/BottomTabs";
import { SettingsDrawer } from "@/components/layout/SettingsDrawer";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

export const metadata: Metadata = {
  title: "Scroll Down Sports",
  description: "Catch up on games without spoilers",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-neutral-950 text-neutral-50 antialiased">
        <ThemeProvider>
          <div className="min-h-screen flex flex-col">
            <TopNav />
            <main className="flex-1 pb-16 md:pb-0">{children}</main>
            <BottomTabs />
            <SettingsDrawer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
