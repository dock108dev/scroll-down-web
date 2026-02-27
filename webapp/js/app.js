/**
 * Scroll Down Sports — Web App Entry Point
 * Wires up navigation, tabs, data loading, and event handling
 */
import * as api from './api.js';
import * as state from './state.js';
import { escapeHtml } from './utils.js';
import { renderGameCard } from './components/gameCard.js';
import { renderBetCard } from './components/betCard.js';
import { renderGameDetail } from './components/gameDetail.js';

// ============================================
// App State
// ============================================

let currentPage = 'home';
let currentTab = 'games';
let selectedLeague = '';
let selectedFBLeague = '';
let gamesData = { earlier: [], yesterday: [], current: [], tomorrow: [] };
let fairbetData = [];
let isLoadingGames = false;
let isLoadingFairbet = false;
let searchText = '';
let refreshInterval = null;

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', () => {
  // Apply saved theme
  state.applyTheme(state.getTheme());

  // Show beta modal on first visit
  if (!state.isBetaDismissed()) {
    document.getElementById('beta-modal').style.display = '';
  }

  // Wire up beta dismiss
  document.getElementById('beta-dismiss').addEventListener('click', () => {
    state.dismissBeta();
    document.getElementById('beta-modal').style.display = 'none';
  });

  // Wire up tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Wire up league filters
  document.querySelectorAll('.filter-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedLeague = btn.dataset.league;
      document.querySelectorAll('.filter-chip').forEach(b => b.classList.toggle('active', b.dataset.league === selectedLeague));
      loadGames();
    });
  });

  // Wire up FairBet league filters
  document.querySelectorAll('.fb-league-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedFBLeague = btn.dataset.league;
      document.querySelectorAll('.fb-league-chip').forEach(b => b.classList.toggle('active', b.dataset.league === selectedFBLeague));
      loadFairBet();
    });
  });

  // Wire up refresh
  document.getElementById('refresh-btn').addEventListener('click', () => {
    loadGames();
  });

  // Wire up search
  const searchInput = document.getElementById('search-input');
  const searchClear = document.getElementById('search-clear');
  searchInput.addEventListener('input', () => {
    searchText = searchInput.value.toLowerCase();
    searchClear.style.display = searchText ? '' : 'none';
    renderGames();
  });
  searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchText = '';
    searchClear.style.display = 'none';
    renderGames();
  });

  // Wire up back button
  document.getElementById('back-btn').addEventListener('click', () => {
    navigateTo('home');
  });

  // Wire up settings
  setupSettings();

  // Handle browser back/forward
  window.addEventListener('popstate', (e) => {
    if (e.state?.page === 'detail') {
      navigateTo('detail', e.state.gameId, e.state.league, false);
    } else {
      navigateTo('home', null, null, false);
    }
  });

  // Initial data load
  loadGames();

  // Auto-refresh every 15 minutes
  refreshInterval = setInterval(() => {
    if (currentPage === 'home' && currentTab === 'games') {
      loadGames();
    }
  }, 900000);
});

// ============================================
// Tab Switching
// ============================================

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${tab}`));

  // Load FairBet data on first visit
  if (tab === 'fairbet' && fairbetData.length === 0) {
    loadFairBet();
  }
}

// ============================================
// Navigation
// ============================================

function navigateTo(page, gameId = null, league = null, pushState = true) {
  currentPage = page;

  document.getElementById('home-page').classList.toggle('active', page === 'home');
  document.getElementById('game-detail-page').classList.toggle('active', page === 'detail');
  document.getElementById('back-btn').style.display = page === 'detail' ? '' : 'none';

  if (page === 'detail' && gameId) {
    if (pushState) {
      history.pushState({ page: 'detail', gameId, league }, '', `#game/${gameId}`);
    }
    loadGameDetail(gameId, league);
  } else {
    if (pushState) {
      history.pushState({ page: 'home' }, '', '#');
    }
  }

  // Scroll to top
  window.scrollTo(0, 0);
}

// ============================================
// Data Loading — Games
// ============================================

async function loadGames() {
  if (isLoadingGames) return;
  isLoadingGames = true;

  const refreshBtn = document.getElementById('refresh-btn');
  refreshBtn.classList.add('spinning');

  const ranges = ['earlier', 'yesterday', 'current', 'tomorrow'];
  const league = selectedLeague || null;

  try {
    const results = await Promise.allSettled(
      ranges.map(range => api.fetchGames(range, league))
    );

    for (let i = 0; i < ranges.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled') {
        gamesData[ranges[i]] = result.value.games || [];
      } else {
        console.error(`Failed to load ${ranges[i]}:`, result.reason);
        gamesData[ranges[i]] = gamesData[ranges[i]] || [];
      }
    }

    renderGames();
  } catch (err) {
    console.error('Failed to load games:', err);
    renderGamesError(err.message);
  } finally {
    isLoadingGames = false;
    refreshBtn.classList.remove('spinning');
  }
}

// ============================================
// Rendering — Games
// ============================================

function renderGames() {
  const container = document.getElementById('games-list');
  const expanded = state.getExpandedSections();

  const sections = [
    { key: 'earlier', title: 'Earlier', games: gamesData.earlier },
    { key: 'yesterday', title: 'Yesterday', games: gamesData.yesterday },
    { key: 'current', title: 'Today', games: gamesData.current },
    { key: 'tomorrow', title: 'Tomorrow', games: gamesData.tomorrow },
  ];

  // Filter by search
  const filteredSections = sections.map(s => ({
    ...s,
    games: searchText
      ? s.games.filter(g =>
          g.homeTeam?.toLowerCase().includes(searchText) ||
          g.awayTeam?.toLowerCase().includes(searchText)
        )
      : s.games,
  }));

  // Hide league filter chips that have no games
  const allGames = filteredSections.flatMap(s => s.games);
  const leaguesWithGames = new Set(allGames.map(g => g.leagueCode));
  document.querySelectorAll('.filter-chip[data-league]').forEach(chip => {
    const league = chip.dataset.league;
    if (league === '') {
      // "All" always visible
      chip.style.display = '';
    } else {
      chip.style.display = leaguesWithGames.has(league) ? '' : 'none';
    }
  });

  let html = '';

  for (const section of filteredSections) {
    const isExpanded = expanded.has(section.key);
    const chevronClass = isExpanded ? '' : 'collapsed';

    html += `
      <div class="section-header ${chevronClass}" data-section-key="${section.key}">
        <span class="section-title">${section.title}</span>
        <div class="section-meta">
          <span class="section-count">${section.games.length} game${section.games.length !== 1 ? 's' : ''}</span>
          <span class="section-chevron">\u25BC</span>
        </div>
      </div>`;

    if (isExpanded) {
      if (section.games.length === 0) {
        html += `<div class="section-empty">No games available.</div>`;
      } else {
        html += `<div class="section-games">`;
        for (const game of section.games) {
          html += renderGameCard(game);
        }
        html += `</div>`;
      }
    }
  }

  container.innerHTML = html;

  // Wire up section toggles
  container.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      const key = header.dataset.sectionKey;
      state.toggleSection(key);
      renderGames();
    });
  });

  // Wire up game card clicks
  container.querySelectorAll('.game-card:not([data-no-click])').forEach(card => {
    card.addEventListener('click', () => {
      const gameId = parseInt(card.dataset.gameId);
      const league = card.dataset.league;
      navigateTo('detail', gameId, league);
    });
  });
}

function renderGamesError(message) {
  const container = document.getElementById('games-list');
  container.innerHTML = `
    <div class="error-state">
      <div class="error-icon">\u26A0\uFE0F</div>
      <div class="error-title">Error</div>
      <div class="error-message">${escapeHtml(message)}</div>
      <button class="btn-retry" onclick="location.reload()">Retry</button>
    </div>`;
}

// ============================================
// Data Loading — FairBet
// ============================================

async function loadFairBet() {
  if (isLoadingFairbet) return;
  isLoadingFairbet = true;

  const container = document.getElementById('fairbet-list');
  container.innerHTML = `
    <div class="loading-state">
      <div class="skeleton-card tall"></div>
      <div class="skeleton-card tall"></div>
      <div class="skeleton-card tall"></div>
    </div>`;

  try {
    const league = selectedFBLeague || null;
    const response = await api.fetchFairBetOdds(1, league);
    fairbetData = response.bets || [];
    renderFairBet();
  } catch (err) {
    console.error('Failed to load FairBet:', err);
    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">\u26A0\uFE0F</div>
        <div class="error-title">Couldn't load bets</div>
        <div class="error-message">${err.message}</div>
        <button class="btn-retry" onclick="document.querySelector('.fb-league-chip.active')?.click()">Try Again</button>
      </div>`;
  } finally {
    isLoadingFairbet = false;
  }
}

function renderFairBet() {
  const container = document.getElementById('fairbet-list');

  if (fairbetData.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">\uD83D\uDCC9</div>
        <h3>No bets available</h3>
        <p>Pull down or tap refresh to check again.</p>
      </div>`;
    return;
  }

  container.innerHTML = fairbetData.map(bet => renderBetCard(bet)).join('');
}

// ============================================
// Game Detail Loading
// ============================================

async function loadGameDetail(gameId, league) {
  const container = document.getElementById('game-detail-content');
  container.innerHTML = `
    <div class="loading-state" style="padding:var(--space-2xl)">
      <div class="skeleton-card"></div>
      <div class="skeleton-card tall"></div>
      <div class="skeleton-card"></div>
    </div>`;

  try {
    // Load game detail, flow, and PBP in parallel
    const [gameResponse, flowResponse] = await Promise.allSettled([
      api.fetchGameDetail(gameId),
      api.fetchGameFlow(gameId),
    ]);

    const game = gameResponse.status === 'fulfilled' ? gameResponse.value : null;
    const flow = flowResponse.status === 'fulfilled' ? flowResponse.value : null;

    if (!game) {
      throw new Error('Could not load game details');
    }

    container.innerHTML = renderGameDetail(game, flow, null);

    // Wire up section toggles
    container.querySelectorAll('.detail-section-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.detail-section');
        section.classList.toggle('collapsed');
      });
    });

    // Wire up score reveal
    const revealBtn = container.querySelector('#detail-score-reveal');
    if (revealBtn) {
      revealBtn.addEventListener('click', () => {
        if (game.awayScore != null && game.homeScore != null) {
          revealBtn.innerHTML = `${game.awayScore} - ${game.homeScore}`;
          revealBtn.style.cursor = 'default';
          revealBtn.style.opacity = '1';
        }
      });
    }

    // Wire up mark as read
    const markReadBtn = container.querySelector('#mark-read-btn');
    if (markReadBtn) {
      markReadBtn.addEventListener('click', () => {
        state.markGameRead(game.id);
        // Reload detail to show scores
        loadGameDetail(gameId, league);
      });
    }

  } catch (err) {
    console.error('Failed to load game detail:', err);
    container.innerHTML = `
      <div class="error-state">
        <div class="error-icon">\u26A0\uFE0F</div>
        <div class="error-title">Error loading game</div>
        <div class="error-message">${err.message}</div>
        <button class="btn-retry" onclick="document.getElementById('back-btn').click()">Go Back</button>
      </div>`;
  }
}

// ============================================
// Settings
// ============================================

function setupSettings() {
  const themeSelect = document.getElementById('setting-theme');
  const oddsSelect = document.getElementById('setting-odds');
  const scoresSelect = document.getElementById('setting-scores');

  // Initialize from saved values
  themeSelect.value = state.getTheme();
  oddsSelect.value = state.getOddsFormat();
  scoresSelect.value = state.getScoreDisplay();

  themeSelect.addEventListener('change', () => {
    state.setTheme(themeSelect.value);
  });

  oddsSelect.addEventListener('change', () => {
    state.setOddsFormat(oddsSelect.value);
    // Re-render if FairBet is visible
    if (currentTab === 'fairbet') {
      renderFairBet();
    }
  });

  scoresSelect.addEventListener('change', () => {
    state.setScoreDisplay(scoresSelect.value);
    // Re-render games to reflect score visibility change
    renderGames();
  });
}

// ============================================
// Handle initial hash route
// ============================================

window.addEventListener('load', () => {
  const hash = window.location.hash;
  if (hash.startsWith('#game/')) {
    const gameId = parseInt(hash.split('/')[1]);
    if (gameId) {
      navigateTo('detail', gameId, null, false);
    }
  }
});
