import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = { title: "Terms of Service — Scroll Down Sports" };

export default function TermsPage() {
  return (
    <div data-testid="page-terms" className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-6 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-neutral-100">Terms of Service</h1>

      <p className="text-sm text-neutral-400 leading-relaxed">
        Last updated: March 2026
      </p>

      <section className="space-y-3 text-sm text-neutral-300 leading-relaxed">
        <h2 className="text-lg font-semibold text-neutral-200">Acceptance of Terms</h2>
        <p>
          By using Scroll Down Sports, you agree to these terms. The service is
          currently in beta and features may change without notice.
        </p>
      </section>

      <section className="space-y-3 text-sm text-neutral-300 leading-relaxed">
        <h2 className="text-lg font-semibold text-neutral-200">Use of the Service</h2>
        <p>
          Scroll Down Sports provides sports scores, timelines, and betting
          analytics for informational purposes only. All data is delayed and should
          not be relied upon for real-time wagering decisions.
        </p>
      </section>

      <section className="space-y-3 text-sm text-neutral-300 leading-relaxed">
        <h2 className="text-lg font-semibold text-neutral-200">Disclaimer</h2>
        <p>
          This is not financial advice. Positive expected value does not guarantee
          a winning bet. Data accuracy is best-effort; we source from reputable
          providers but cannot guarantee real-time correctness. Gamble responsibly.
        </p>
      </section>

      <section className="space-y-3 text-sm text-neutral-300 leading-relaxed">
        <h2 className="text-lg font-semibold text-neutral-200">Accounts</h2>
        <p>
          You are responsible for maintaining the security of your account
          credentials. We reserve the right to suspend accounts that violate these
          terms or abuse the service.
        </p>
      </section>

      <section className="space-y-3 text-sm text-neutral-300 leading-relaxed">
        <h2 className="text-lg font-semibold text-neutral-200">Contact</h2>
        <p>
          Questions? Reach us at{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            {SUPPORT_EMAIL}
          </a>.
        </p>
      </section>

      <p className="text-xs text-neutral-600 pt-4 border-t border-neutral-800">
        These terms may be updated as the product evolves. We are currently in beta.
      </p>
      </div>
    </div>
  );
}
