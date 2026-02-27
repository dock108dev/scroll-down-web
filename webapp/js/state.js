/**
 * App State — localStorage-backed preferences and read state
 */

const STORAGE_KEYS = {
  betaDismissed: 'sd_beta_dismissed',
  theme: 'sd_theme',
  oddsFormat: 'sd_odds_format',
  scoreDisplay: 'sd_score_display',
  readGames: 'sd_read_games',
  expandedSections: 'sd_expanded_sections',
  preferredBook: 'sd_preferred_book',
};

function load(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable
  }
}

// ============================================
// Beta Disclaimer
// ============================================

export function isBetaDismissed() {
  return load(STORAGE_KEYS.betaDismissed, false);
}

export function dismissBeta() {
  save(STORAGE_KEYS.betaDismissed, true);
}

// ============================================
// Theme
// ============================================

export function getTheme() {
  return load(STORAGE_KEYS.theme, 'system');
}

export function setTheme(theme) {
  save(STORAGE_KEYS.theme, theme);
  applyTheme(theme);
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'light') {
    root.setAttribute('data-theme', 'light');
  } else if (theme === 'dark') {
    root.setAttribute('data-theme', 'dark');
  } else {
    root.removeAttribute('data-theme');
  }
}

// ============================================
// Odds Format
// ============================================

export function getOddsFormat() {
  return load(STORAGE_KEYS.oddsFormat, 'american');
}

export function setOddsFormat(format) {
  save(STORAGE_KEYS.oddsFormat, format);
}

// ============================================
// Score Display
// ============================================

export function getScoreDisplay() {
  return load(STORAGE_KEYS.scoreDisplay, 'always');
}

export function setScoreDisplay(mode) {
  save(STORAGE_KEYS.scoreDisplay, mode);
}

// ============================================
// Read State
// ============================================

export function getReadGames() {
  return new Set(load(STORAGE_KEYS.readGames, []));
}

export function markGameRead(gameId) {
  const read = getReadGames();
  read.add(gameId);
  save(STORAGE_KEYS.readGames, [...read]);
}

export function isGameRead(gameId) {
  return getReadGames().has(gameId);
}

// ============================================
// Section Expansion
// ============================================

export function getExpandedSections() {
  return new Set(load(STORAGE_KEYS.expandedSections, ['current', 'yesterday', 'tomorrow']));
}

export function toggleSection(sectionKey) {
  const expanded = getExpandedSections();
  if (expanded.has(sectionKey)) {
    expanded.delete(sectionKey);
  } else {
    expanded.add(sectionKey);
  }
  save(STORAGE_KEYS.expandedSections, [...expanded]);
  return expanded.has(sectionKey);
}
