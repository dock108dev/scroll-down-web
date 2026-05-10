"use client";

import { useMemo, useState } from "react";
import { MLB_TEAMS, type MlbTeam, teamLogoPath } from "@/lib/mlb-teams";

interface TeamPickerOverlayProps {
  /** Heading shown above the grid. Different copy in onboarding vs settings. */
  heading?: string;
  subhead?: string;
  showSkip?: boolean;
  initialSelected?: string | null;
  onPick: (abbr: string) => void;
  onSkip?: () => void;
  /** When provided, overlays a close button so it can be used inside settings. */
  onClose?: () => void;
}

const DIVISIONS: Array<{ league: "AL" | "NL"; division: MlbTeam["division"]; label: string }> = [
  { league: "AL", division: "East", label: "AL East" },
  { league: "AL", division: "Central", label: "AL Central" },
  { league: "AL", division: "West", label: "AL West" },
  { league: "NL", division: "East", label: "NL East" },
  { league: "NL", division: "Central", label: "NL Central" },
  { league: "NL", division: "West", label: "NL West" },
];

export function TeamPickerOverlay({
  heading = "Pick your team",
  subhead = "We'll start you on their most recent game. You can change this any time.",
  showSkip = true,
  initialSelected = null,
  onPick,
  onSkip,
  onClose,
}: TeamPickerOverlayProps) {
  const [selected, setSelected] = useState<string | null>(initialSelected);

  const grouped = useMemo(() => {
    return DIVISIONS.map((d) => ({
      ...d,
      teams: MLB_TEAMS.filter((t) => t.league === d.league && t.division === d.division),
    }));
  }, []);

  const handleConfirm = () => {
    if (selected) onPick(selected);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      data-testid="team-picker"
      className="fixed inset-0 z-[60] flex flex-col bg-neutral-950"
    >
      <header className="flex items-center justify-between px-4 py-4 border-b border-neutral-800 sticky top-0 bg-neutral-950">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-neutral-50 truncate">{heading}</h2>
          <p className="text-xs text-neutral-500 truncate">{subhead}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {showSkip && onSkip && (
            <button
              data-testid="team-picker-skip"
              onClick={onSkip}
              className="text-sm text-neutral-400 hover:text-neutral-200 px-3 min-h-[44px]"
            >
              Skip
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-neutral-500 hover:text-neutral-200 px-2 min-h-[44px] min-w-[44px] text-xl leading-none"
            >
              &#10005;
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-32">
        <div className="space-y-6 max-w-3xl mx-auto">
          {grouped.map((g) => (
            <section key={g.label} aria-label={g.label}>
              <h3 className="text-xs uppercase tracking-wider text-neutral-500 mb-2">
                {g.label}
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                {g.teams.map((t) => {
                  const isSelected = selected === t.abbr;
                  return (
                    <button
                      key={t.abbr}
                      data-testid={`team-pick-${t.abbr}`}
                      onClick={() => setSelected(t.abbr)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 min-h-[88px] transition ${
                        isSelected
                          ? "border-blue-500 bg-blue-500/10"
                          : "border-neutral-800 bg-neutral-900/40 hover:border-neutral-700"
                      }`}
                      style={
                        isSelected
                          ? { boxShadow: `0 0 0 2px ${t.primaryColorDark}` }
                          : undefined
                      }
                      aria-pressed={isSelected}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={teamLogoPath(t.abbr)}
                        alt=""
                        width={36}
                        height={36}
                        className="h-9 w-9 object-contain"
                        onError={(e) => {
                          // Fallback: hide broken logo and show abbr
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <span className="text-xs font-semibold text-neutral-200">{t.abbr}</span>
                      <span className="text-[10px] text-neutral-500 leading-tight">
                        {t.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      <footer className="sticky bottom-0 border-t border-neutral-800 bg-neutral-950 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto">
          <button
            data-testid="team-picker-confirm"
            onClick={handleConfirm}
            disabled={!selected}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 min-h-[48px] text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {selected
              ? `Use ${MLB_TEAMS.find((t) => t.abbr === selected)?.name ?? selected}`
              : "Pick a team"}
          </button>
        </div>
      </footer>
    </div>
  );
}
