import { notFound } from "next/navigation";

/**
 * Server-side gate for `/dev/*` pages. Internal qualitative-review tools
 * (e.g. the Catchup Lab) ship with the bundle but must not be reachable in
 * production — their data sources are NODE_ENV-gated dev fixture endpoints.
 * This layout enforces the same gate at the page boundary as defense in
 * depth, so an accidental data-source change can't expose the UI in prod.
 */
export default function DevLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <>{children}</>;
}
