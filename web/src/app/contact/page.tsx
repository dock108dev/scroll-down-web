import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contact — Scroll Down Sports" };

export default function ContactPage() {
  return (
    <div data-testid="page-contact" className="mx-auto max-w-2xl px-4 py-10 space-y-6">
      <h1 className="text-2xl font-bold text-neutral-100">Contact Us</h1>

      <p className="text-sm text-neutral-400 leading-relaxed">
        Have a question, found a bug, or want to share feedback? We&apos;d love
        to hear from you.
      </p>

      <section className="space-y-4">
        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-200">Email</h2>
          <p className="text-sm text-neutral-400">
            The fastest way to reach us:
          </p>
          <a
            href="mailto:support@scrolldownsports.dev"
            className="inline-flex items-center gap-2 text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors min-h-[44px] bg-blue-500/10 px-3 py-2 rounded-lg border border-blue-500/20"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            support@scrolldownsports.dev
          </a>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-200">Beta Feedback</h2>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Scroll Down Sports is currently in beta. We&apos;re actively building
            and improving based on user feedback. If something isn&apos;t working
            right or you have an idea for a feature, let us know — it genuinely
            shapes what we build next.
          </p>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-200">Response Time</h2>
          <p className="text-sm text-neutral-400 leading-relaxed">
            We typically respond within 24 hours. For urgent issues (site down,
            data errors), please include &quot;URGENT&quot; in your subject line.
          </p>
        </div>
      </section>
    </div>
  );
}
