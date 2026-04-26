"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FairBetTheme } from "@/lib/theme";
import { useProGateSheet } from "@/stores/pro-gate-sheet";
import { useIsPro } from "@/hooks/useIsPro";
import type { FairBetFilters, ConfidenceLevel, TimeToGame } from "@/lib/fairbet-filters";

const CONFIDENCE_OPTIONS: { key: ConfidenceLevel; label: string }[] = [
  { key: "", label: "All" },
  { key: "low", label: "Small+" },
  { key: "medium", label: "Medium+" },
  { key: "high", label: "Strong" },
];

const TIME_OPTIONS: { key: TimeToGame; label: string }[] = [
  { key: "", label: "All" },
  { key: "1h", label: "Within 1h" },
  { key: "3h", label: "Within 3h" },
  { key: "today", label: "Today" },
];

interface AdvancedFiltersProps {
  filters: FairBetFilters;
  onConfidenceChange: (v: ConfidenceLevel) => void;
  onTimeToGameChange: (v: TimeToGame) => void;
  onEvOnlyChange: (v: boolean) => void;
  onHideThinChange: (v: boolean) => void;
  onHideAltsChange: (v: boolean) => void;
  disabled?: boolean;
}

export function AdvancedFilters({
  filters,
  onConfidenceChange,
  onTimeToGameChange,
  onEvOnlyChange,
  onHideThinChange,
  onHideAltsChange,
  disabled = false,
}: AdvancedFiltersProps) {
  const { openSheet } = useProGateSheet();
  const gateButtonRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const isPro = useIsPro();

  const proActiveCount =
    (filters.confidence ? 1 : 0) + (filters.timeToGame ? 1 : 0);
  // The defaults are evOnly=true, hideThin=true, hideAlts=true. Show "N on" only
  // when the user has toggled away from the cleaner default — flipping a default-on
  // switch off shouldn't visually look like "more filtering is happening."
  const freeActiveCount =
    (!filters.evOnly ? 1 : 0) + (!filters.hideThin ? 1 : 0) + (!filters.hideAlts ? 1 : 0);
  const activeCount = proActiveCount + freeActiveCount;

  if (!isPro) {
    return (
      <div className={cn(disabled && "opacity-40 pointer-events-none")}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition"
          style={{
            backgroundColor: "var(--fb-surface-secondary)",
            border: "1px solid var(--fb-border-subtle)",
            color: "var(--ds-text-secondary)",
          }}
          aria-expanded={open}
          data-testid="more-filters-toggle"
        >
          <span className="font-medium">More filters</span>
          {activeCount > 0 && (
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${FairBetTheme.info}20`, color: FairBetTheme.info }}
            >
              {activeCount} on
            </span>
          )}
          <svg
            className={cn("ml-auto w-3 h-3 transition-transform", open && "rotate-180")}
            fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {open && (
          <div
            data-testid="more-filters"
            className="mt-1.5 rounded-lg px-3 py-2 space-y-2"
            style={{
              backgroundColor: "var(--fb-surface-secondary)",
              border: "1px solid var(--fb-border-subtle)",
            }}
          >
            <FilterRow label="Show">
              <AdvancedPill
                label="+EV only"
                active={filters.evOnly}
                onClick={() => onEvOnlyChange(!filters.evOnly)}
              />
              <AdvancedPill
                label="Hide thin"
                active={filters.hideThin}
                onClick={() => onHideThinChange(!filters.hideThin)}
              />
              <AdvancedPill
                label="Hide alts"
                active={filters.hideAlts}
                onClick={() => onHideAltsChange(!filters.hideAlts)}
              />
            </FilterRow>

            <button
              ref={gateButtonRef}
              type="button"
              data-testid="fairbet-filters-gated"
              onClick={() => openSheet("advanced_filters", gateButtonRef.current)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11px] transition"
              style={{
                backgroundColor: "var(--fb-card-bg)",
                border: "1px solid var(--fb-border-subtle)",
                color: "var(--ds-text-tertiary)",
              }}
            >
              <span>Confidence &amp; Starts</span>
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
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn(disabled && "opacity-40 pointer-events-none")}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs transition"
        style={{
          backgroundColor: "var(--fb-surface-secondary)",
          border: `1px solid ${activeCount > 0 ? FairBetTheme.info + "40" : "var(--fb-border-subtle)"}`,
          color: "var(--ds-text-secondary)",
        }}
        aria-expanded={open}
        data-testid="more-filters-toggle"
      >
        <span className="font-medium">More filters</span>
        {activeCount > 0 && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${FairBetTheme.info}20`, color: FairBetTheme.info }}
          >
            {activeCount} on
          </span>
        )}
        <svg
          className={cn("ml-auto w-3 h-3 transition-transform", open && "rotate-180")}
          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          data-testid="advanced-filters"
          className="mt-1.5 rounded-lg px-3 py-2 space-y-1.5"
          style={{
            backgroundColor: "var(--fb-surface-secondary)",
            border: `1px solid ${activeCount > 0 ? FairBetTheme.info + "40" : "var(--fb-border-subtle)"}`,
          }}
        >
          <FilterRow label="Show">
            <AdvancedPill
              label="+EV only"
              active={filters.evOnly}
              onClick={() => onEvOnlyChange(!filters.evOnly)}
            />
            <AdvancedPill
              label="Hide thin"
              active={filters.hideThin}
              onClick={() => onHideThinChange(!filters.hideThin)}
            />
          </FilterRow>

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

          {activeCount > 0 && (
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => {
                  onConfidenceChange("");
                  onTimeToGameChange("");
                  onEvOnlyChange(true);
                  onHideThinChange(true);
                  onHideAltsChange(true);
                }}
                className="text-[10px] font-medium"
                style={{ color: FairBetTheme.info }}
              >
                Reset
              </button>
            </div>
          )}
        </div>
      )}
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
      type="button"
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
