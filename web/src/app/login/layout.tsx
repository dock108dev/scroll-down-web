import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In or Sign Up",
  description:
    "Create a free Scroll Down Sports account to access spoiler-free scores, betting analytics, and matchup simulators.",
  alternates: { canonical: "/login" },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
