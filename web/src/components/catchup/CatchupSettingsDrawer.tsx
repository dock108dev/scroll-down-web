"use client";

import type { ReactNode } from "react";
import { useSettings, type AutoAdvanceDelayMs, type AutoRevealDelayMs } from "@/stores/settings";

interface CatchupSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
}

const AUTO_REVEAL_OPTIONS: Array<{ label: string; value: AutoRevealDelayMs }> = [
  { label: "Off", value: 0 },
  { label: "1s", value: 1000 },
  { label: "2s", value: 2000 },
  { label: "3s", value: 3000 },
];

const AUTO_ADVANCE_OPTIONS: Array<{ label: string; value: AutoAdvanceDelayMs }> = [
  { label: "Off", value: 0 },
  { label: "10s", value: 10000 },
  { label: "15s", value: 15000 },
  { label: "20s", value: 20000 },
  { label: "30s", value: 30000 },
];

export function CatchupSettingsDrawer({ open, onClose }: CatchupSettingsDrawerProps) {
  const autoRevealDelayMs = useSettings((s) => s.autoRevealDelayMs);
  const autoAdvanceDelayMs = useSettings((s) => s.autoAdvanceDelayMs);
  const spoilerSafeMode = useSettings((s) => s.spoilerSafeMode);
  const setAutoRevealDelayMs = useSettings((s) => s.setAutoRevealDelayMs);
  const setAutoAdvanceDelayMs = useSettings((s) => s.setAutoAdvanceDelayMs);
  const setSpoilerSafeMode = useSettings((s) => s.setSpoilerSafeMode);

  if (!open) return null;

  return (
    <div
      className="catchup-settings-popover"
      data-testid="catchup-settings-drawer"
      role="dialog"
      aria-modal="false"
      aria-label="Catch-up settings"
    >
      <div className="catchup-settings-head">
        <span>Playback</span>
        <button
          type="button"
          className="catchup-settings-close"
          onClick={onClose}
          aria-label="Close catch-up settings"
        >
          Close
        </button>
      </div>

      <SettingRow label="Auto reveal pitch">
        <SegmentedControl
          options={AUTO_REVEAL_OPTIONS}
          value={autoRevealDelayMs}
          onChange={setAutoRevealDelayMs}
          testId="auto-reveal-setting"
        />
      </SettingRow>

      <SettingRow label="Auto advance">
        <SegmentedControl
          options={AUTO_ADVANCE_OPTIONS}
          value={autoAdvanceDelayMs}
          onChange={setAutoAdvanceDelayMs}
          testId="auto-advance-setting"
        />
      </SettingRow>

      <SettingRow label="Spoiler-safe mode">
        <button
          type="button"
          className="catchup-settings-toggle"
          data-enabled={spoilerSafeMode ? "true" : "false"}
          onClick={() => setSpoilerSafeMode(!spoilerSafeMode)}
          data-testid="spoiler-safe-setting"
        >
          {spoilerSafeMode ? "On" : "Off"}
        </button>
      </SettingRow>
    </div>
  );
}

function SettingRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="catchup-settings-row">
      <span>{label}</span>
      {children}
    </div>
  );
}

function SegmentedControl<T extends number>({
  options,
  value,
  onChange,
  testId,
}: {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
  testId: string;
}) {
  return (
    <span className="catchup-settings-segmented" data-testid={testId}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          data-active={option.value === value ? "true" : "false"}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </span>
  );
}
