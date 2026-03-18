import { AnalyticsTabNav } from "@/features/analytics/components/AnalyticsTabNav";

export default function MlbLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
      <AnalyticsTabNav />
      {children}
    </div>
  );
}
