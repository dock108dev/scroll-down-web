"use client";

import { useProGateSheet } from "@/stores/pro-gate-sheet";
import { FEATURE_GATES } from "@/lib/config";

const FAKE_ROWS = [
  { away: "LAL", home: "BOS", time: "7:30 PM ET", league: "NBA" },
  { away: "NYY", home: "LAD", time: "8:10 PM ET", league: "MLB" },
  { away: "CHI", home: "MIA", time: "6:00 PM ET", league: "NBA" },
  { away: "PHI", home: "NYR", time: "7:00 PM ET", league: "NHL" },
  { away: "KCR", home: "HOU", time: "8:15 PM ET", league: "MLB" },
];

export function HistoryGateOverlay() {
  const openSheet = useProGateSheet((s) => s.openSheet);

  function handleUpgrade() {
    openSheet(FEATURE_GATES.HISTORY, null);
  }

  return (
    <div data-testid="history-gate-overlay" className="relative mx-auto max-w-2xl">
      {/* Blurred preview rows */}
      <div aria-hidden="true" className="select-none pointer-events-none">
        {FAKE_ROWS.map((row, i) => (
          <div
            key={i}
            className="flex items-center gap-3 px-4 py-3 border-b border-neutral-800"
            style={{ filter: "blur(4px)", opacity: 0.45 }}
          >
            <span
              className="text-[10px] font-semibold uppercase tracking-wider w-8 text-center"
              style={{ color: "var(--color-neutral-500)" }}
            >
              {row.league}
            </span>
            <div className="flex-1 flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: "var(--color-neutral-200)" }}>
                {row.away} @ {row.home}
              </span>
              <span className="text-xs" style={{ color: "var(--color-neutral-500)" }}>
                {row.time}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Gate overlay card */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="mx-4 rounded-2xl border p-8 text-center space-y-5 shadow-2xl w-full max-w-sm"
          style={{
            background: "var(--color-neutral-900, #171717)",
            borderColor: "var(--color-neutral-700, #404040)",
          }}
          data-testid="history-gate-card"
        >
          <div className="space-y-1.5">
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: "var(--color-neutral-400)" }}
            >
              Pro Feature
            </p>
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--color-neutral-50)" }}
              data-testid="history-gate-title"
            >
              Game History Archive
            </h2>
          </div>

          <p
            className="text-sm leading-relaxed"
            style={{ color: "var(--color-neutral-400)" }}
          >
            Browse every completed game by date and search by team.
          </p>

          <p
            className="text-xs font-semibold"
            style={{ color: "var(--color-neutral-300)" }}
            data-testid="history-record-count"
          >
            50+ games tracked across all leagues
          </p>

          <button
            onClick={handleUpgrade}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-colors"
            style={{ background: "#2563eb", color: "#fff" }}
            data-testid="history-upgrade-cta"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  );
}
