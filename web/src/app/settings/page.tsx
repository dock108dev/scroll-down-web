"use client";

import { useSettings } from "@/stores/settings";
import { cn } from "@/lib/utils";

const KNOWN_BOOKS = [
  "DraftKings",
  "FanDuel",
  "BetMGM",
  "Caesars",
  "bet365",
  "ESPN BET",
  "Fanatics",
  "Hard Rock Bet",
  "Pinnacle",
  "BetRivers",
] as const;

const HOME_SECTIONS = ["Earlier", "Yesterday", "Today", "Tomorrow"] as const;
const GAME_SECTIONS = [
  "Flow",
  "Timeline",
  "Stats",
  "Odds",
  "Wrap-Up",
] as const;

export default function SettingsPage() {
  const {
    theme,
    setTheme,
    scoreRevealMode,
    setScoreRevealMode,
    oddsFormat,
    setOddsFormat,
    preferredSportsbook,
    setPreferredSportsbook,
    hideLimitedData,
    setHideLimitedData,
    homeExpandedSections,
    toggleHomeSection,
    gameExpandedSections,
    toggleGameSection,
  } = useSettings();

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-6">
      <h1 className="text-xl font-bold text-neutral-100">Settings</h1>

      {/* ─── Appearance ──────────────────────────────────── */}
      <SettingsSection title="Appearance">
        <SettingsRow label="Theme">
          <SegmentedControl
            options={[
              { value: "system", label: "System" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            value={theme}
            onChange={(v) => setTheme(v as "system" | "light" | "dark")}
          />
        </SettingsRow>
      </SettingsSection>

      {/* ─── Recaps — Default Expanded ──────────────────── */}
      <SettingsSection title="Recaps — Default Expanded">
        {HOME_SECTIONS.map((section) => (
          <SettingsCheckRow
            key={section}
            label={section}
            checked={homeExpandedSections.includes(section)}
            onToggle={() => toggleHomeSection(section)}
          />
        ))}
      </SettingsSection>

      {/* ─── Game — Default Expanded ────────────────────── */}
      <SettingsSection title="Game — Default Expanded">
        {GAME_SECTIONS.map((section) => (
          <SettingsCheckRow
            key={section}
            label={section}
            checked={gameExpandedSections.includes(section)}
            onToggle={() => toggleGameSection(section)}
          />
        ))}
      </SettingsSection>

      {/* ─── Score Display ──────────────────────────────── */}
      <SettingsSection title="Score Display">
        <SettingsRow label="Score visibility">
          <DarkSelect
            value={scoreRevealMode}
            onChange={(v) =>
              setScoreRevealMode(v as "always" | "onMarkRead")
            }
            options={[
              {
                value: "onMarkRead",
                label: "Spoiler free (hold to reveal)",
              },
              { value: "always", label: "Always show scores" },
            ]}
          />
        </SettingsRow>
        <div className="px-4 pb-3 -mt-1">
          <p className="text-xs text-neutral-500 leading-relaxed">
            Spoiler free hides scores until you tap. &apos;Always show&apos;
            displays live and final scores automatically.
          </p>
        </div>
      </SettingsSection>

      {/* ─── Odds ───────────────────────────────────────── */}
      <SettingsSection title="Odds">
        <SettingsRow label="Default Book">
          <DarkSelect
            value={preferredSportsbook}
            onChange={setPreferredSportsbook}
            options={[
              { value: "", label: "Best available price" },
              ...KNOWN_BOOKS.map((b) => ({
                value: b.toLowerCase().replace(/\s+/g, ""),
                label: b,
              })),
            ]}
          />
        </SettingsRow>
        <SettingsRow label="Odds Format">
          <SegmentedControl
            options={[
              { value: "american", label: "American" },
              { value: "decimal", label: "Decimal" },
            ]}
            value={oddsFormat}
            onChange={(v) =>
              setOddsFormat(v as "american" | "decimal" | "fractional")
            }
          />
        </SettingsRow>
        <SettingsToggle
          label="Hide Thin Markets"
          checked={hideLimitedData}
          onChange={setHideLimitedData}
        />
        <div className="px-4 pb-3 -mt-1">
          <p className="text-xs text-neutral-500 leading-relaxed">
            Filters out bets where only a few books are posting or they
            can&apos;t agree on a number. If the market is thin, the fair
            estimate is just one book&apos;s opinion.
          </p>
        </div>
      </SettingsSection>

      {/* ─── About ──────────────────────────────────────── */}
      <SettingsSection title="About">
        <SettingsRow label="Version">
          <span className="text-sm text-neutral-400">0.1.0</span>
        </SettingsRow>
        <SettingsRow label="Build">
          <span className="text-sm text-neutral-400">Web</span>
        </SettingsRow>
        <div className="px-4 py-3 space-y-2">
          <a
            href="https://scrolldown.app"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            scrolldown.app
          </a>
          <a
            href="https://scrolldown.app/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="https://scrolldown.app/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            Terms of Service
          </a>
        </div>
      </SettingsSection>
    </div>
  );
}

/* ─── Shared Sub-components ──────────────────────────────────────── */

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-xs font-semibold text-neutral-500 uppercase tracking-wide px-1 mb-2">
        {title}
      </h2>
      <div className="rounded-lg border border-neutral-800 bg-neutral-900 divide-y divide-neutral-800">
        {children}
      </div>
    </div>
  );
}

function SettingsRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-neutral-200">{label}</span>
      {children}
    </div>
  );
}

function SettingsToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-neutral-200">{label}</span>
      <button
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-6 w-11 items-center rounded-full transition",
          checked ? "bg-green-500" : "bg-neutral-700",
        )}
      >
        <span
          className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition",
            checked ? "translate-x-6" : "translate-x-1",
          )}
        />
      </button>
    </div>
  );
}

function SettingsCheckRow({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-neutral-800/30 transition-colors"
    >
      <span className="text-sm text-neutral-200">{label}</span>
      {checked && (
        <span className="text-green-400 text-sm font-medium">&#10003;</span>
      )}
    </button>
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
    <div className="flex rounded-lg bg-neutral-800 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-all",
            value === opt.value
              ? "bg-neutral-600 text-white shadow-sm"
              : "text-neutral-400 hover:text-neutral-200",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DarkSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-neutral-800 border border-neutral-700 rounded-lg px-3 py-1.5 text-sm text-neutral-50 appearance-none cursor-pointer min-w-[160px]"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
