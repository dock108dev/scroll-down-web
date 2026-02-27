import type { Metadata } from "next";
import "./globals.css";
import { TopNav } from "@/components/layout/TopNav";
import { BottomTabs } from "@/components/layout/BottomTabs";

export const metadata: Metadata = {
  title: "Scroll Down Sports",
  description: "Catch up on games without spoilers",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-neutral-950 text-white antialiased">
        <div className="min-h-screen flex flex-col">
          <TopNav />
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
          <BottomTabs />
        </div>
      </body>
    </html>
  );
}
