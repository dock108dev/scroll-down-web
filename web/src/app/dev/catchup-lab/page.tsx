"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CatchupCard } from "@/components/catchup/CatchupCard";
import { SceneSetterCard } from "@/components/catchup/SceneSetterCard";
import { RhythmCard } from "@/components/catchup/RhythmCard";
import { CatchupScrollContainer } from "@/components/catchup/CatchupScrollContainer";
import { computeLeverage } from "@/lib/leverage";
import type {
  CatchupCard as CatchupCardData,
  PlayCardData,
  SelectionAuditRow,
} from "@/lib/types";

/**
 * Catch-up Lab — internal qualitative-review tool.
 *
 * Lists captured fixtures, lets you load any one of them, and renders
 * its deck through the same card components the production app uses.
 * Side panel shows the planner's decisions + the audit table so we can
 * compare *what the deck looks like* with *why the planner chose it*.
 *
 * This is the tool for "does this feel like the game?" — the question
 * unit tests can't answer.
 */

interface FixtureManifestEntry {
  id: string;
  category: string;
  final: { home: number; away: number };
  totalRuns: number;
  margin: number;
  leadChanges: number;
  finalWinnerTrailed: boolean;
  inningsPlayed: number;
  playsTotal: number;
  hasTriplePlay: boolean;
  hasCatcherInterference: boolean;
  expectedFeel?: Record<string, string> | null;
  reviewNotes?: string[];
}

interface FixtureCardsResponse {
  gameId: number;
  cards: CatchupCardData[];
  audit: SelectionAuditRow[];
  report: {
    rhythm: Array<{
      cardId: string;
      kind: string;
      reason: string;
      afterPlayIndex?: number;
      beforePlayIndex?: number;
    }>;
  };
  finalScore: { home?: number; away?: number } | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  pitchers_duel: "#7aa6d6",
  steady_control: "#9ca3af",
  back_and_forth: "#fbbf24",
  late_comeback: "#fb923c",
  chaotic: "#f87171",
  blowout: "#a78bfa",
  extra_innings: "#34d399",
  weird: "#ec4899",
  normal: "#9ca3af",
};

type PlaySpeed = "slow" | "normal" | "fast";
type AuditFilter = "all" | "selected" | "omitted";

const SPEED_MS: Record<PlaySpeed, number> = {
  slow: 4000,
  normal: 2500,
  fast: 1200,
};

const RHYTHM_KINDS = new Set<CatchupCardData["kind"]>([
  "inning-transition",
  "quiet-stretch",
  "late-game",
  "final-setup",
]);

/** Self-correcting `setInterval` wrapper. Passing `null` for `delay`
 *  pauses the timer; the latest callback is always invoked. */
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

export default function CatchupLabPage() {
  const [fixtures, setFixtures] = useState<FixtureManifestEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<FixtureCardsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [manifestError, setManifestError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealFinal, setRevealFinal] = useState(false);
  const [restartToken, setRestartToken] = useState(0);

  // Toolbar state — see ISSUE description.
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState<PlaySpeed>("normal");
  const [showRhythmCards, setShowRhythmCards] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [showDebugOverlay, setShowDebugOverlay] = useState(false);
  const [autoplayTarget, setAutoplayTarget] = useState<number | undefined>(undefined);

  // Load manifest on mount. The lab is dev-only (gated by /dev layout's
  // production notFound) so the failure surface is the operator's terminal
  // and a small in-page banner — never a real user. We log + surface
  // because a silent empty sidebar is indistinguishable from "no fixtures
  // captured" and wastes time during qualitative review.
  // See docs/audits/error-handling-report.md §H1.
  useEffect(() => {
    let mounted = true;
    fetch("/api/dev/fixtures")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j) => {
        if (!mounted) return;
        setFixtures(j.fixtures ?? []);
        setManifestError(null);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : "unknown error";
        console.error("[catchup-lab] failed to load fixture manifest:", err);
        setManifestError(msg);
      });
    return () => {
      mounted = false;
    };
  }, []);

  // Load deck when a fixture is selected. Dev-only tool — surface failures
  // so the reviewer doesn't sit on a stale deck or a frozen "Loading…"
  // panel after a backend hiccup or malformed fixture JSON.
  // See docs/audits/error-handling-report.md §H2.
  const loadFixture = useCallback(async (id: string) => {
    setSelectedId(id);
    setData(null);
    setLoadError(null);
    setActiveIndex(0);
    setRevealFinal(false);
    setIsPlaying(false);
    setAutoplayTarget(undefined);
    setRestartToken((prev) => prev + 1);
    setLoading(true);
    try {
      const r = await fetch(`/api/dev/fixtures/${id}/cards`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as FixtureCardsResponse;
      setData(j);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown error";
      console.error(`[catchup-lab] failed to load fixture ${id}:`, err);
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectedFixture = useMemo(
    () => fixtures.find((f) => f.id === selectedId) ?? null,
    [fixtures, selectedId],
  );

  // Group fixtures by category for the sidebar.
  const groupedFixtures = useMemo(() => {
    const map = new Map<string, FixtureManifestEntry[]>();
    for (const f of fixtures) {
      const list = map.get(f.category) ?? [];
      list.push(f);
      map.set(f.category, list);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [fixtures]);

  const visibleCards = useMemo<CatchupCardData[]>(() => {
    if (!data) return [];
    return showRhythmCards
      ? data.cards
      : data.cards.filter((c) => !RHYTHM_KINDS.has(c.kind));
  }, [data, showRhythmCards]);

  const slideKeys = useMemo(
    () => visibleCards.map((c) => c.cardId),
    [visibleCards],
  );

  const totalVisible = visibleCards.length;

  const handleActiveIndexChange = useCallback(
    (i: number) => {
      setActiveIndex(i);
      // When the user manually scrolls during autoplay, sync the autoplay
      // cursor so the next tick advances from the current viewport, not
      // the previous target.
      if (isPlaying) setAutoplayTarget(i);
    },
    [isPlaying],
  );

  // Autoplay timer.
  useInterval(
    () => {
      if (!isPlaying || totalVisible === 0) return;
      setAutoplayTarget((prev) => {
        const cursor = prev ?? activeIndex;
        const next = cursor + 1;
        if (next >= totalVisible) {
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    },
    isPlaying ? SPEED_MS[playSpeed] : null,
  );

  // Step forward / back imperatively (used by toolbar + keyboard).
  const advance = useCallback(
    (delta: number) => {
      if (totalVisible === 0) return;
      const cursor = autoplayTarget ?? activeIndex;
      const next = Math.min(Math.max(cursor + delta, 0), totalVisible - 1);
      setAutoplayTarget(next);
    },
    [activeIndex, autoplayTarget, totalVisible],
  );

  // Keyboard shortcuts: arrows step, space toggles autoplay.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "SELECT" ||
        tag === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        advance(1);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        advance(-1);
      } else if (e.key === " " || e.code === "Space") {
        if (!data) return;
        e.preventDefault();
        setIsPlaying((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance, data]);

  const sceneSetter = useMemo(
    () =>
      (data?.cards ?? []).find((c) => c.kind === "scene-setter") as
        | Extract<CatchupCardData, { kind: "scene-setter" }>
        | undefined,
    [data],
  );
  const homeTeamAbbr = sceneSetter?.homeTeamAbbr ?? "HME";
  const awayTeamAbbr = sceneSetter?.awayTeamAbbr ?? "AWY";

  return (
    <div className="catchup-lab">
      <header className="lab-header">
        <h1>Catch-up Lab</h1>
        <p className="lab-subtitle">
          {fixtures.length} fixtures · qualitative review tooling
        </p>
      </header>

      <div className="lab-grid">
        <aside className="lab-sidebar">
          <h2 className="lab-section-title">Fixtures</h2>
          {manifestError && (
            <p className="lab-error" role="status">
              Failed to load manifest: {manifestError}
            </p>
          )}
          {groupedFixtures.map(([cat, items]) => (
            <div key={cat} className="lab-cat-group">
              <div
                className="lab-cat-label"
                style={{
                  borderLeftColor: CATEGORY_COLORS[cat] ?? "#9ca3af",
                }}
              >
                {cat.replace(/_/g, " ")} · {items.length}
              </div>
              {items.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  data-active={selectedId === f.id ? "true" : "false"}
                  onClick={() => loadFixture(f.id)}
                  className="lab-fixture-button"
                >
                  <span className="lab-fixture-id">{f.id}</span>
                  <span className="lab-fixture-score">
                    {f.final.away}-{f.final.home}
                  </span>
                  <span className="lab-fixture-meta">
                    {f.inningsPlayed}inn · {f.totalRuns}R
                    {f.leadChanges > 0 ? ` · ${f.leadChanges}LC` : ""}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        <main className="lab-main">
          {!selectedFixture && (
            <div className="lab-empty">
              <p>Select a fixture to load its deck.</p>
            </div>
          )}

          {selectedFixture && (
            <div className="lab-fixture-header">
              <div className="lab-fixture-header-row">
                <h2>{selectedFixture.id}</h2>
                <span
                  className="lab-cat-pill"
                  style={{
                    background:
                      CATEGORY_COLORS[selectedFixture.category] ?? "#9ca3af",
                  }}
                >
                  {selectedFixture.category.replace(/_/g, " ")}
                </span>
              </div>
              <p className="lab-fixture-stat">
                Final{" "}
                {revealFinal
                  ? `${selectedFixture.final.away}-${selectedFixture.final.home}`
                  : "·-·"}{" "}
                · {selectedFixture.inningsPlayed} innings ·{" "}
                {selectedFixture.totalRuns} runs
                {selectedFixture.leadChanges > 0
                  ? ` · ${selectedFixture.leadChanges} lead changes`
                  : ""}{" "}
                <button
                  type="button"
                  className="lab-toggle"
                  onClick={() => setRevealFinal((v) => !v)}
                >
                  {revealFinal ? "Hide score" : "Reveal score"}
                </button>
              </p>
              {selectedFixture.reviewNotes &&
                selectedFixture.reviewNotes.length > 0 && (
                  <ul className="lab-review-notes">
                    {selectedFixture.reviewNotes.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                )}
            </div>
          )}

          {data && (
            <LabToolbar
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying((v) => !v)}
              playSpeed={playSpeed}
              onPlaySpeedChange={setPlaySpeed}
              showRhythmCards={showRhythmCards}
              onToggleRhythm={() => setShowRhythmCards((v) => !v)}
              showTrails={showTrails}
              onToggleTrails={() => setShowTrails((v) => !v)}
              showDebugOverlay={showDebugOverlay}
              onToggleDebugOverlay={() => setShowDebugOverlay((v) => !v)}
              activeIndex={activeIndex}
              total={totalVisible}
            />
          )}

          {loading && <div className="lab-loading">Loading deck…</div>}

          {!loading && loadError && selectedFixture && (
            <div className="lab-error" role="status">
              Failed to load deck for {selectedFixture.id}: {loadError}
            </div>
          )}

          {data && (
            <div
              className="lab-deck-shell"
              data-trails={showTrails ? "on" : "off"}
              data-debug={showDebugOverlay ? "on" : "off"}
            >
              <CatchupScrollContainer
                itemKeys={slideKeys}
                onActiveIndexChange={handleActiveIndexChange}
                restartToken={restartToken}
                targetIndex={autoplayTarget}
              >
                {visibleCards.map((card, i) => (
                  <div key={card.cardId} className="lab-card-slot">
                    {showDebugOverlay && (
                      <DebugBadge index={i} card={card} />
                    )}
                    {renderCard(card, i, activeIndex, homeTeamAbbr, awayTeamAbbr)}
                  </div>
                ))}
              </CatchupScrollContainer>
            </div>
          )}
        </main>

        <aside className="lab-debug">
          <h2 className="lab-section-title">Planner report</h2>
          {data ? (
            <DebugPanel data={data} fixture={selectedFixture} activeIndex={activeIndex} />
          ) : (
            <p className="lab-empty">No fixture loaded.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function renderCard(
  card: CatchupCardData,
  i: number,
  activeIndex: number,
  homeTeamAbbr: string,
  awayTeamAbbr: string,
) {
  if (card.kind === "scene-setter") {
    return <SceneSetterCard card={card} isActive={activeIndex === i} />;
  }
  if (
    card.kind === "inning-transition" ||
    card.kind === "quiet-stretch" ||
    card.kind === "late-game" ||
    card.kind === "final-setup"
  ) {
    return <RhythmCard card={card} isActive={activeIndex === i} />;
  }
  if (card.kind === "play") {
    return (
      <CatchupCard
        card={card}
        homeTeamAbbr={homeTeamAbbr}
        awayTeamAbbr={awayTeamAbbr}
        isActive={activeIndex === i}
      />
    );
  }
  return null;
}

// ── Toolbar ────────────────────────────────────────────────

function LabToolbar({
  isPlaying,
  onTogglePlay,
  playSpeed,
  onPlaySpeedChange,
  showRhythmCards,
  onToggleRhythm,
  showTrails,
  onToggleTrails,
  showDebugOverlay,
  onToggleDebugOverlay,
  activeIndex,
  total,
}: {
  isPlaying: boolean;
  onTogglePlay: () => void;
  playSpeed: PlaySpeed;
  onPlaySpeedChange: (s: PlaySpeed) => void;
  showRhythmCards: boolean;
  onToggleRhythm: () => void;
  showTrails: boolean;
  onToggleTrails: () => void;
  showDebugOverlay: boolean;
  onToggleDebugOverlay: () => void;
  activeIndex: number;
  total: number;
}) {
  return (
    <div className="lab-toolbar" role="toolbar" aria-label="Catch-up lab controls">
      <button
        type="button"
        className="lab-toolbar-button lab-toolbar-button--primary"
        onClick={onTogglePlay}
        aria-pressed={isPlaying}
        title={isPlaying ? "Pause autoplay" : "Play autoplay"}
      >
        {isPlaying ? "⏸ Pause" : "▶ Play"}
      </button>

      <div className="lab-toolbar-group" role="group" aria-label="Speed">
        <span className="lab-toolbar-label">Speed</span>
        {(["slow", "normal", "fast"] as PlaySpeed[]).map((s) => (
          <button
            key={s}
            type="button"
            className="lab-toolbar-pill"
            data-active={playSpeed === s ? "true" : "false"}
            onClick={() => onPlaySpeedChange(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <ToolbarToggle
        label="Rhythm cards"
        on={showRhythmCards}
        onClick={onToggleRhythm}
      />
      <ToolbarToggle label="Trails" on={showTrails} onClick={onToggleTrails} />
      <ToolbarToggle
        label="Debug overlay"
        on={showDebugOverlay}
        onClick={onToggleDebugOverlay}
      />

      <span className="lab-toolbar-counter" aria-live="polite">
        {total === 0 ? "—" : `${activeIndex + 1} / ${total}`}
      </span>
    </div>
  );
}

function ToolbarToggle({
  label,
  on,
  onClick,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="lab-toolbar-toggle"
      onClick={onClick}
      data-on={on ? "true" : "false"}
      aria-pressed={on}
    >
      <span className="lab-toolbar-toggle-label">{label}</span>
      <span className="lab-toolbar-toggle-state">{on ? "ON" : "off"}</span>
    </button>
  );
}

// ── Debug overlay badge ────────────────────────────────────

function DebugBadge({ index, card }: { index: number; card: CatchupCardData }) {
  return (
    <div className="lab-debug-badge" aria-hidden="true">
      <span className="lab-debug-badge-line">
        {index} · {card.kind}
      </span>
      {card.kind === "play" && (
        <span className="lab-debug-badge-line">
          {(card as PlayCardData).eventType ?? "—"} · p
          {(card as PlayCardData).playIndex} · T{computeLeverage(card as PlayCardData)}
        </span>
      )}
    </div>
  );
}

// ── Debug panel ────────────────────────────────────────────

function DebugPanel({
  data,
  fixture,
  activeIndex,
}: {
  data: FixtureCardsResponse;
  fixture: FixtureManifestEntry | null;
  activeIndex: number;
}) {
  const cards = data.cards;
  const playCards = cards.filter((c): c is PlayCardData => c.kind === "play");
  const rhythmCount = cards.filter((c) => RHYTHM_KINDS.has(c.kind)).length;
  const scoringPlays = data.audit.filter((r) => r.isScoringPlay);
  const scoringMissed = scoringPlays.filter((r) => !r.isSelectedForCatchup);
  const leadChanges = data.audit.filter((r) => r.isLeadChangePlay);
  const leadChangesMissed = leadChanges.filter((r) => !r.isSelectedForCatchup);

  const activeCard = cards[activeIndex];

  const [auditFilter, setAuditFilter] = useState<AuditFilter>("all");

  const auditRows = useMemo(() => {
    if (auditFilter === "selected") {
      return data.audit.filter((r) => r.isSelectedForCatchup);
    }
    if (auditFilter === "omitted") {
      return data.audit.filter((r) => !r.isSelectedForCatchup);
    }
    return data.audit;
  }, [data.audit, auditFilter]);

  return (
    <>
      <section className="lab-debug-section">
        <h3>Deck shape</h3>
        <ul className="lab-stats">
          <li>{cards.length} total cards</li>
          <li>{playCards.length} play cards</li>
          <li>{rhythmCount} rhythm cards</li>
          <li>
            {scoringPlays.length - scoringMissed.length}/{scoringPlays.length} scoring plays preserved
          </li>
          <li>
            {leadChanges.length - leadChangesMissed.length}/{leadChanges.length} lead changes preserved
          </li>
        </ul>
      </section>

      <section className="lab-debug-section">
        <h3>Leverage arc</h3>
        {playCards.length === 0 ? (
          <p className="lab-debug-empty">No play cards.</p>
        ) : (
          <div className="lab-leverage-arc" aria-label="Leverage arc">
            {playCards.map((c) => {
              const tier = computeLeverage(c);
              return (
                <div
                  key={c.cardId}
                  className="lab-leverage-pip"
                  data-tier={tier}
                  title={`${c.inningLabel} · ${c.eventType ?? "play"} · T${tier}`}
                />
              );
            })}
          </div>
        )}
      </section>

      {fixture?.expectedFeel && (
        <section className="lab-debug-section">
          <h3>Expected feel</h3>
          <ul className="lab-feel-list">
            {Object.entries(fixture.expectedFeel).map(([phase, feel]) => (
              <li key={phase}>
                <span className="lab-feel-phase">{phase}</span>
                <span className="lab-feel-value">{feel}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="lab-debug-section">
        <h3>Rhythm decisions ({data.report.rhythm.length})</h3>
        {data.report.rhythm.length === 0 ? (
          <p className="lab-debug-empty">No rhythm cards inserted.</p>
        ) : (
          <ol className="lab-rhythm-list">
            {data.report.rhythm.map((r) => (
              <li key={r.cardId}>
                <span className={`lab-rhythm-kind lab-rhythm-${r.kind}`}>
                  {r.kind}
                </span>
                <span className="lab-rhythm-reason">{r.reason}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="lab-debug-section">
        <h3>
          Audit ({auditRows.length}/{data.audit.length})
        </h3>
        <div className="lab-audit-filter" role="tablist" aria-label="Audit filter">
          {(["all", "selected", "omitted"] as AuditFilter[]).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={auditFilter === f}
              className="lab-toolbar-pill"
              data-active={auditFilter === f ? "true" : "false"}
              onClick={() => setAuditFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
        {auditRows.length === 0 ? (
          <p className="lab-debug-empty">No plays match this filter.</p>
        ) : (
          <div className="lab-audit-table-scroll">
            <table className="lab-audit-table">
              <thead>
                <tr>
                  <th scope="col">Play</th>
                  <th scope="col">Inn</th>
                  <th scope="col">Event</th>
                  <th scope="col">Sel</th>
                  <th scope="col">Reason</th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((r) => (
                  <tr key={r.playIndex} data-selected={r.isSelectedForCatchup ? "true" : "false"}>
                    <td>p{r.playIndex}</td>
                    <td>
                      {r.half === "top" ? "T" : r.half === "bottom" ? "B" : "?"}
                      {r.inning}
                    </td>
                    <td title={r.description}>
                      <span className="lab-audit-event">{r.eventType}</span>
                    </td>
                    <td className="lab-audit-sel">
                      {r.isSelectedForCatchup ? "✓" : "✗"}
                    </td>
                    <td className="lab-audit-reason">
                      {(r.selectionReasons ?? []).join(", ") || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="lab-debug-section">
        <h3>Active card</h3>
        {activeCard ? (
          <pre className="lab-debug-json">
{JSON.stringify(
  activeCard.kind === "play"
    ? {
        kind: activeCard.kind,
        playIndex: activeCard.playIndex,
        inningLabel: activeCard.inningLabel,
        eventType: activeCard.eventType,
        scoreBefore: activeCard.scoreBefore,
        scoreAfter: activeCard.scoreAfter,
        outsAfter: activeCard.outsAfter,
        narrative: activeCard.narrative,
        leverageTier: computeLeverage(activeCard),
      }
    : { kind: activeCard.kind, cardId: activeCard.cardId },
  null,
  2,
)}
          </pre>
        ) : (
          <p className="lab-debug-empty">No active card.</p>
        )}
      </section>

      {scoringMissed.length > 0 && (
        <section className="lab-debug-section lab-debug-warn">
          <h3>⚠ Scoring plays missed ({scoringMissed.length})</h3>
          <ul className="lab-stats">
            {scoringMissed.map((r) => (
              <li key={r.playIndex}>
                p{r.playIndex} (inn {r.inning} {r.half}): {r.description}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
