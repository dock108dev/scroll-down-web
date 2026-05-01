import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/lib/site-config";

export const metadata: Metadata = { title: "Privacy Policy — Scroll Down Sports" };

export default function PrivacyPage() {
  return (
    <div data-testid="page-privacy" className="mx-auto max-w-2xl px-4 py-10">
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 px-6 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-neutral-100">Privacy Policy</h1>

      <p className="text-sm text-neutral-400 leading-relaxed">
        Last updated: March 2026
      </p>

      <section className="space-y-3 text-sm text-neutral-300 leading-relaxed">
        <h2 className="text-lg font-semibold text-neutral-200">What We Collect</h2>
        <p>
          Scroll Down Sports collects only the minimum data needed to provide the
          service: your email address (if you create an account), your preferences
          (stored locally in your browser), and basic analytics to understand how
          the app is used.
        </p>
      </section>

      <section className="space-y-3 text-sm text-neutral-300 leading-relaxed">
        <h2 className="text-lg font-semibold text-neutral-200">How We Use Your Data</h2>
        <p>
          Your data is used solely to operate the service — authenticating your
          account, saving your settings, and improving app performance. We do not
          sell your data to third parties.
        </p>
      </section>

      <section className="space-y-3 text-sm text-neutral-300 leading-relaxed">
        <h2 className="text-lg font-semibold text-neutral-200">Local Storage</h2>
        <p>
          Most of your preferences (theme, reveal settings, pinned games) are
          stored locally in your browser using localStorage. This data never
          leaves your device unless you are signed in and choose to sync.
        </p>
      </section>

      <section className="space-y-3 text-sm text-neutral-300 leading-relaxed">
        <h2 className="text-lg font-semibold text-neutral-200">Contact</h2>
        <p>
          Questions about privacy? Reach us at{" "}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="text-blue-400 hover:text-blue-300 transition-colors"
          >
            {SUPPORT_EMAIL}
          </a>.
        </p>
      </section>

      <p className="text-xs text-neutral-600 pt-4 border-t border-neutral-800">
        This policy may be updated as the product evolves. We are currently in beta.
      </p>
      </div>
    </div>
  );
}
