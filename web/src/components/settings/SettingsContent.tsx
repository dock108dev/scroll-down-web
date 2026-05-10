"use client";

import { useState } from "react";
import { useSettings, type ThemeMode } from "@/stores/settings";
import { useOnboarding } from "@/stores/onboarding";
import { useCatchupProgress } from "@/stores/catchup-progress";
import { findMlbTeam } from "@/lib/mlb-teams";
import { TeamPickerOverlay } from "@/components/onboarding/TeamPickerOverlay";
import { Section, Row } from "@/components/shared/FormPrimitives";
import { cn } from "@/lib/utils";

export function SettingsContent() {
  const theme = useSettings((s) => s.theme);
  const setTheme = useSettings((s) => s.setTheme);
  const showStaleBanners = useSettings((s) => s.showStaleBanners);
  const setShowStaleBanners = useSettings((s) => s.setShowStaleBanners);

  const favoriteTeam = useOnboarding((s) => s.favoriteTeam);
  const setFavoriteTeam = useOnboarding((s) => s.setFavoriteTeam);
  const clearFavoriteTeam = useOnboarding((s) => s.clearFavoriteTeam);
  const resetOnboarding = useOnboarding((s) => s.resetOnboarding);
  const clearAllProgress = useCatchupProgress((s) => s.clearAll);

  const [pickerOpen, setPickerOpen] = useState(false);
  const fav = favoriteTeam ? findMlbTeam(favoriteTeam) : null;

  return (
    <div data-testid="settings-content" className="space-y-6">
      <Section title="Favorite team" description="Anchors the home page on your team's most recent game.">
        <Row label="Team">
          {fav ? (
            <span className="text-sm font-medium text-neutral-100">{fav.name} ({fav.abbr})</span>
          ) : (
            <span className="text-sm text-neutral-500">Not set</span>
          )}
        </Row>
        <div className="px-4 pb-3 pt-1 flex flex-wrap gap-2">
          <button
            data-testid="settings-pick-team"
            onClick={() => setPickerOpen(true)}
            className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-100 hover:bg-neutral-700 transition min-h-[40px]"
          >
            {fav ? "Change team" : "Pick a team"}
          </button>
          {fav && (
            <button
              onClick={clearFavoriteTeam}
              className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:text-neutral-100 transition min-h-[40px]"
            >
              Clear
            </button>
          )}
        </div>
      </Section>

      <Section title="Appearance">
        <Row label="Theme">
          <SegmentedControl
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            value={theme}
            onChange={(v) => setTheme(v as ThemeMode)}
          />
        </Row>
      </Section>

      <Section title="Diagnostics" collapsible defaultOpen={false}>
        <SettingsToggle
          label="Show stale data banners"
          hint="Display a banner when we serve cached data during upstream blips."
          checked={showStaleBanners}
          onChange={setShowStaleBanners}
        />
        <div className="px-4 py-3 space-y-2">
          <button
            onClick={() => {
              if (typeof window === "undefined") return;
              if (window.confirm("Clear catch-up progress for every game?")) {
                clearAllProgress();
              }
            }}
            className="text-sm text-neutral-300 hover:text-neutral-100"
          >
            Reset catch-up progress
          </button>
          <button
            onClick={() => {
              if (typeof window === "undefined") return;
              if (window.confirm("Show the welcome team picker again on next visit?")) {
                resetOnboarding();
              }
            }}
            className="block text-sm text-neutral-300 hover:text-neutral-100"
          >
            Show welcome screen on next visit
          </button>
        </div>
      </Section>

      <Section title="About">
        <Row label="Version">
          <span className="text-sm text-neutral-400">0.1.0</span>
        </Row>
        <div className="px-4 py-3 space-y-2">
          <a href="/privacy" className="block text-sm text-blue-400 hover:text-blue-300">Privacy Policy</a>
          <a href="/terms" className="block text-sm text-blue-400 hover:text-blue-300">Terms of Service</a>
        </div>
      </Section>

      {pickerOpen && (
        <TeamPickerOverlay
          heading={fav ? "Change favorite team" : "Pick your team"}
          subhead="Used to anchor the home page. You can change this any time."
          showSkip={false}
          initialSelected={favoriteTeam}
          onPick={(abbr) => {
            setFavoriteTeam(abbr);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

function SettingsToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div>
        <span className="text-sm text-neutral-200">{label}</span>
        {hint && <p className="text-xs text-neutral-500">{hint}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
          checked ? "bg-green-500" : "bg-neutral-700",
        )}
      >
        <span
          className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white transition-transform",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div role="radiogroup" className="flex rounded-lg bg-neutral-800 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-all",
            value === opt.value ? "bg-neutral-600 text-neutral-50" : "text-neutral-400 hover:text-neutral-200",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
