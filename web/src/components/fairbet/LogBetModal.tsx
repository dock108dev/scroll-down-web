"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useMyBets } from "@/stores/my-bets";
import { FairBetTheme } from "@/lib/theme";
import { formatOdds } from "@/lib/utils";
import type { OddsFormat } from "@/lib/types";

interface LogBetModalProps {
  gameId: number;
  leagueCode: string;
  homeTeam: string;
  awayTeam: string;
  gameDate: string;
  marketKey: string;
  marketLabel: string;
  selectionDisplay: string;
  book: string;
  placedOdds: number;
  oddsFormat: OddsFormat;
  onClose: () => void;
}

export function LogBetModal({
  gameId,
  leagueCode,
  homeTeam,
  awayTeam,
  gameDate,
  marketKey,
  marketLabel,
  selectionDisplay,
  book,
  placedOdds,
  oddsFormat,
  onClose,
}: LogBetModalProps) {
  const logBet = useMyBets((s) => s.logBet);
  const [stake, setStake] = useState("100");
  const [logged, setLogged] = useState(false);
  const stakeRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    stakeRef.current?.focus();
  }, []);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  function handleStakeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (/^\d*\.?\d*$/.test(val)) setStake(val);
  }

  function handleConfirm() {
    const stakeNum = Math.max(0, parseFloat(stake) || 0);
    logBet({
      gameId,
      leagueCode,
      homeTeam,
      awayTeam,
      gameDate,
      marketKey,
      marketLabel,
      selectionDisplay,
      book,
      placedOdds,
      stake: stakeNum,
    });
    setLogged(true);
    setTimeout(onClose, 800);
  }

  const formattedOdds = formatOdds(placedOdds, oddsFormat);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      onClick={handleBackdropClick}
      data-testid="log-bet-backdrop"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Log this bet"
        className="w-full max-w-sm rounded-2xl px-5 py-5 space-y-4"
        style={{ backgroundColor: "var(--fb-card-bg)", border: "1px solid var(--fb-card-border)" }}
        data-testid="log-bet-modal"
      >
        <h2 className="text-base font-bold text-neutral-100">Log this bet</h2>

        {/* Read-only summary */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-neutral-500">Selection</span>
            <span className="font-semibold text-neutral-100 text-right max-w-[60%] truncate">
              {selectionDisplay}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Market</span>
            <span className="text-neutral-300">{marketLabel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Book</span>
            <span className="text-neutral-300">{book}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Odds</span>
            <span className="font-bold text-neutral-100">{formattedOdds}</span>
          </div>
        </div>

        <div className="h-px" style={{ backgroundColor: "var(--fb-border-subtle)" }} />

        {/* Stake input */}
        <div className="space-y-1.5">
          <label
            htmlFor="log-bet-stake"
            className="text-xs font-medium text-neutral-400"
          >
            Stake ($)
          </label>
          <input
            id="log-bet-stake"
            ref={stakeRef}
            type="text"
            inputMode="decimal"
            value={stake}
            onChange={handleStakeChange}
            placeholder="100"
            className="w-full rounded-lg px-3 py-2 text-sm text-neutral-100 outline-none"
            style={{
              backgroundColor: "var(--fb-surface-secondary)",
              border: "1px solid var(--fb-card-border)",
            }}
            data-testid="log-bet-stake-input"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg py-2 text-sm font-medium text-neutral-400"
            style={{
              backgroundColor: "var(--fb-surface-secondary)",
              border: "1px solid var(--fb-card-border)",
            }}
            data-testid="log-bet-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={logged}
            className="flex-1 rounded-lg py-2 text-sm font-bold text-white transition"
            style={{
              backgroundColor: logged ? FairBetTheme.positive : FairBetTheme.info,
              opacity: logged ? 0.8 : 1,
            }}
            data-testid="log-bet-confirm"
          >
            {logged ? "Logged ✓" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
