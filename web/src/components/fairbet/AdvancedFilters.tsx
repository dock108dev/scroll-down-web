"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { FairBetTheme } from "@/lib/theme";
import { useProGateSheet } from "@/stores/pro-gate-sheet";
import { useSession } from "@/stores/session";
import type { FairBetFilters, ConfidenceLevel, TimeToGame } from "@/lib/fairbet-filters";

const CONFIDENCE_OPTIONS: { key: ConfidenceLevel; label: string }[] = [
  { key: "", label: "All" },
  { key: "low", label: "Low+" },
  { key: "medium", label: "Medium+" },
  { key: "high", label: "High" },
];

const MARKET_OPTIONS = [
  { key: "", label: "All" },
  { key: "moneyline", label: "Moneyline" },
  { key: "spread", label: "Spread" },
  { key: "total", label: "Total" },
  { key: "player_props", label: "Props" },
];

const TIME_OPTIONS: { key: TimeToGame; label: string }[] = [
  { key: "", label: "All" },
  { key: "1h", label: "Within 1h" },
  { key: "3h", label: "Within 3h" },
  { key: "today", label: "Today" },
];

interface AdvancedFiltersProps {
  filters: FairBetFilters;
  availableSports: string[];
  onConfidenceChange: (v: ConfidenceLevel) => void;
  onMarketChange: (v: string) => void;
  onSportChange: (v: string) => void;
  onTimeToGameChange: (v: TimeToGame) => void;
  disabled?: boolean;
}

export function AdvancedFilters({
  filters,
  availableSports,
  onConfidenceChange,
  onMarketChange,
  onSportChange,
  onTimeToGameChange,
  disabled = false,
}: AdvancedFiltersProps) {
  const { tier } = useSession();
  const { openSheet } = useProGateSheet();
  const gateButtonRef = useRef<HTMLButtonElement>(null);

  const isPro = tier === "pro";

  const hasActive =
    !!filters.confidence || !!filters.sport || !!filters.timeToGame || !!filters.market;

  if (!isPro) {
    return (
      <button
        ref={gateButtonRef}
        data-testid="fairbet-filters-gated"
        onClick={() => openSheet("advanced_filters", gateButtonRef.current)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition"
        style={{
          backgroundColor: "var(--fb-surface-secondary)",
          border: "1px solid var(--fb-border-subtle)",
          color: "var(--ds-text-tertiary)",
        }}
      >
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M3 4h18M7 12h10M10 20h4" />
        </svg>
        <span className="font-medium">Advanced Filters</span>
        <span
          className="ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide"
          style={{ backgroundColor: `${FairBetTheme.info}20`, color: FairBetTheme.info }}
        >
          Pro
        </span>
        <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      </button>
    );
  }

  return (
    <div
      data-testid="advanced-filters"
      className={cn(
        "space-y-1.5 rounded-lg px-3 py-2",
        disabled && "opacity-40 pointer-events-none cursor-not-allowed select-none",
      )}
      style={{
        backgroundColor: "var(--fb-surface-secondary)",
        border: `1px solid ${hasActive ? FairBetTheme.info + "40" : "var(--fb-border-subtle)"}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 pb-0.5">
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: "var(--ds-text-tertiary)" }}>
          <path d="M3 4h18M7 12h10M10 20h4" />
        </svg>
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: "var(--ds-text-tertiary)" }}>
          Advanced Filters
        </span>
        {hasActive && (
          <button
            onClick={() => {
              onConfidenceChange("");
              onMarketChange("");
              onSportChange("");
              onTimeToGameChange("");
            }}
            className="ml-auto text-[10px] font-medium"
            style={{ color: FairBetTheme.info }}
          >
            Clear
          </button>
        )}
      </div>

      {/* EV Confidence row */}
      <FilterRow label="Confidence">
        {CONFIDENCE_OPTIONS.map((o) => (
          <AdvancedPill
            key={o.key || "conf-all"}
            label={o.label}
            active={filters.confidence === o.key}
            onClick={() => onConfidenceChange(o.key)}
          />
        ))}
      </FilterRow>

      {/* Market type row */}
      <FilterRow label="Market">
        {MARKET_OPTIONS.map((o) => (
          <AdvancedPill
            key={o.key || "mkt-all"}
            label={o.label}
            active={filters.market === o.key}
            onClick={() => onMarketChange(o.key)}
          />
        ))}
      </FilterRow>

      {/* Sport row (only shown when >1 sport available) */}
      {availableSports.length > 1 && (
        <FilterRow label="Sport">
          <AdvancedPill label="All" active={filters.sport === ""} onClick={() => onSportChange("")} />
          {availableSports.map((s) => (
            <AdvancedPill
              key={s}
              label={s}
              active={filters.sport === s}
              onClick={() => onSportChange(s)}
            />
          ))}
        </FilterRow>
      )}

      {/* Time-to-game row */}
      <FilterRow label="Starts">
        {TIME_OPTIONS.map((o) => (
          <AdvancedPill
            key={o.key || "time-all"}
            label={o.label}
            active={filters.timeToGame === o.key}
            onClick={() => onTimeToGameChange(o.key)}
          />
        ))}
      </FilterRow>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
      <span
        className="shrink-0 text-[10px] font-medium w-16"
        style={{ color: "var(--ds-text-tertiary)" }}
      >
        {label}
      </span>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">{children}</div>
    </div>
  );
}

function AdvancedPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap transition min-h-[28px] flex items-center",
      )}
      style={
        active
          ? { backgroundColor: FairBetTheme.info, color: "#fff" }
          : {
              backgroundColor: "var(--fb-card-bg)",
              color: "var(--ds-text-secondary)",
              border: "1px solid var(--fb-border-subtle)",
            }
      }
    >
      {label}
    </button>
  );
}
