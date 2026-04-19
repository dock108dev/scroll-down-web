"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useProGateSheet } from "@/stores/pro-gate-sheet";
import { FairBetTheme } from "@/lib/theme";
import { FEATURE_GATES } from "@/lib/config";
import { getEVColor } from "@/lib/fairbet-utils";

interface EVSimulatorProps {
  /** EV percent (e.g. 7.0 means $7 per $100 staked). */
  evPercent: number;
  isPro: boolean;
}

function formatDollars(amount: number): string {
  const sign = amount >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(amount).toFixed(2)}`;
}

export function EVSimulator({ evPercent, isPro }: EVSimulatorProps) {
  const [rawValue, setRawValue] = useState("");
  const [stake, setStake] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const openSheet = useProGateSheet((s) => s.openSheet);

  const applyStake = useCallback((value: string) => {
    const num = parseFloat(value);
    if (!Number.isFinite(num) || value.trim() === "") {
      setStake(null);
    } else {
      setStake(Math.max(0, num));
    }
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    // Allow digits, one decimal point, and leading minus only for typing experience
    // (negative will be clamped to 0 on apply)
    if (val !== "" && !/^-?\d*\.?\d*$/.test(val)) return;
    setRawValue(val);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => applyStake(val), 300);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleGatedFocus(e: React.FocusEvent<HTMLInputElement>) {
    openSheet(FEATURE_GATES.EV_SIMULATOR, e.currentTarget);
  }

  const evPerBet = stake !== null ? stake * (evPercent / 100) : null;
  const ev100 = evPerBet !== null ? evPerBet * 100 : null;
  const evColor = getEVColor(evPercent);

  return (
    <div
      data-testid="ev-simulator"
      className="rounded-lg px-2 py-2 space-y-2"
      style={{
        backgroundColor: "var(--fb-surface-tint)",
        border: "1px solid var(--fb-border-subtle)",
      }}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-neutral-500 shrink-0">Stake</span>
        <div className="relative flex items-center">
          <span className="absolute left-2 text-xs text-neutral-400 pointer-events-none">$</span>
          {isPro ? (
            <input
              ref={inputRef}
              data-testid="ev-simulator-input"
              type="text"
              inputMode="decimal"
              value={rawValue}
              onChange={handleChange}
              placeholder="50"
              aria-label="Stake amount in dollars"
              className="w-24 pl-5 pr-2 py-1 text-xs font-medium rounded-md bg-transparent text-neutral-50 outline-none focus:ring-1"
              style={{
                border: "1px solid var(--fb-border-subtle)",
                caretColor: FairBetTheme.info,
              }}
            />
          ) : (
            <input
              ref={inputRef}
              data-testid="ev-simulator-gated"
              type="text"
              inputMode="decimal"
              value=""
              readOnly
              onFocus={handleGatedFocus}
              placeholder="50"
              aria-label="Stake amount — Pro feature"
              aria-disabled="true"
              className="w-24 pl-5 pr-2 py-1 text-xs font-medium rounded-md bg-transparent text-neutral-500 cursor-pointer opacity-60 outline-none"
              style={{
                border: "1px solid var(--fb-border-subtle)",
              }}
            />
          )}
        </div>

        {!isPro && (
          <span
            className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0"
            style={{
              backgroundColor: `${FairBetTheme.info}20`,
              color: FairBetTheme.info,
              border: `1px solid ${FairBetTheme.info}40`,
            }}
          >
            Pro
          </span>
        )}
      </div>

      {isPro && evPerBet !== null && ev100 !== null && (
        <div className="flex flex-col gap-0.5 text-xs pl-1">
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500">Expected per bet:</span>
            <span
              data-testid="ev-simulator-per-bet"
              className="font-bold"
              style={{ color: evColor }}
            >
              {formatDollars(evPerBet)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-500">Over 100 bets:</span>
            <span
              data-testid="ev-simulator-over-100"
              className="font-bold"
              style={{ color: evColor }}
            >
              {formatDollars(ev100)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
