import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Batch Simulations",
  robots: { index: false, follow: false },
};

export default function BatchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
