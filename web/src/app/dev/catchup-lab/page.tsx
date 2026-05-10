"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CatchupCard } from "@/components/catchup/CatchupCard";
import { SceneSetterCard } from "@/components/catchup/SceneSetterCard";
import { RhythmCard } from "@/components/catchup/RhythmCard";
import { CatchupScrollContainer } from "@/components/catchup/CatchupScrollContainer";
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

export default function CatchupLabPage() {
  const [fixtures, setFixtures] = useState<FixtureManifestEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [data, setData] = useState<FixtureCardsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [revealFinal, setRevealFinal] = useState(false);

  // Load manifest on mount.
  useEffect(() => {
    let mounted = true;
    fetch("/api/dev/fixtures")
      .then((r) => r.json())
      .then((j) => {
        if (!mounted) return;
        setFixtures(j.fixtures ?? []);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Load deck when a fixture is selected.
  const loadFixture = useCallback(async (id: string) => {
    setSelectedId(id);
    setData(null);
    setActiveIndex(0);
    setRevealFinal(false);
    setLoading(true);
    try {
      const r = await fetch(`/api/dev/fixtures/${id}/cards`);
      const j = (await r.json()) as FixtureCardsResponse;
      setData(j);
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

  const slideKeys = useMemo(
    () => (data?.cards ?? []).map((c) => c.cardId),
    [data],
  );

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

          {loading && <div className="lab-loading">Loading deck…</div>}

          {data && (
            <div className="lab-deck-shell">
              <CatchupScrollContainer
                itemKeys={slideKeys}
                onActiveIndexChange={setActiveIndex}
              >
                {data.cards.map((card, i) => {
                  if (card.kind === "scene-setter") {
                    return (
                      <SceneSetterCard
                        key={card.cardId}
                        card={card}
                        isActive={activeIndex === i}
                      />
                    );
                  }
                  if (
                    card.kind === "inning-transition" ||
                    card.kind === "quiet-stretch" ||
                    card.kind === "late-game" ||
                    card.kind === "final-setup"
                  ) {
                    return (
                      <RhythmCard
                        key={card.cardId}
                        card={card}
                        isActive={activeIndex === i}
                      />
                    );
                  }
                  if (card.kind === "play") {
                    return (
                      <CatchupCard
                        key={card.cardId}
                        card={card}
                        homeTeamAbbr={data.cards.find((c) => c.kind === "scene-setter")?.kind === "scene-setter"
                          ? (data.cards.find((c) => c.kind === "scene-setter") as Extract<CatchupCardData, { kind: "scene-setter" }>).homeTeamAbbr
                          : "HME"}
                        awayTeamAbbr={data.cards.find((c) => c.kind === "scene-setter")?.kind === "scene-setter"
                          ? (data.cards.find((c) => c.kind === "scene-setter") as Extract<CatchupCardData, { kind: "scene-setter" }>).awayTeamAbbr
                          : "AWY"}
                        isActive={activeIndex === i}
                      />
                    );
                  }
                  return null;
                })}
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
  const rhythmCount =
    cards.filter((c) =>
      ["inning-transition", "quiet-stretch", "late-game", "final-setup"].includes(c.kind),
    ).length;
  const scoringPlays = data.audit.filter((r) => r.isScoringPlay);
  const scoringMissed = scoringPlays.filter((r) => !r.isSelectedForCatchup);
  const leadChanges = data.audit.filter((r) => r.isLeadChangePlay);
  const leadChangesMissed = leadChanges.filter((r) => !r.isSelectedForCatchup);

  const activeCard = cards[activeIndex];

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
