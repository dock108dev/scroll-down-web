/**
 * Utility functions — date formatting, odds formatting, team abbreviations
 */

// ============================================
// Date Formatting
// ============================================

export function parseISODate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr);
}

export function formatShortDate(dateStr) {
  const date = parseISODate(dateStr);
  if (!date) return dateStr || '';

  const month = date.toLocaleDateString('en-US', { month: 'short', timeZone: 'America/New_York' });
  const day = date.toLocaleDateString('en-US', { day: 'numeric', timeZone: 'America/New_York' });
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });

  return `${month} ${day} \u00B7 ${time}`;
}

export function formatTimeOnly(dateStr) {
  const date = parseISODate(dateStr);
  if (!date) return '';
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
}

export function formatRelativeDate(dateStr) {
  const date = parseISODate(dateStr);
  if (!date) return '';

  const now = new Date();
  const todayET = new Date(now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }));
  const dateET = new Date(date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' }));

  const diffDays = Math.floor((dateET - todayET) / (1000 * 60 * 60 * 24));
  const time = formatTimeOnly(dateStr);

  if (diffDays === 0) return `Today \u00B7 ${time}`;
  if (diffDays === 1) return `Tomorrow \u00B7 ${time}`;
  if (diffDays === -1) return `Yesterday \u00B7 ${time}`;

  return formatShortDate(dateStr);
}

// ============================================
// Game Status
// ============================================

const FINAL_STATUSES = new Set(['final', 'completed', 'archived']);
const LIVE_STATUSES = new Set(['live', 'inProgress', 'in_progress']);
const PREGAME_STATUSES = new Set(['scheduled', 'pregame']);

export function isFinal(status) {
  return FINAL_STATUSES.has(status);
}

export function isLive(status) {
  return LIVE_STATUSES.has(status);
}

export function isPregame(status) {
  return PREGAME_STATUSES.has(status);
}

export function statusLine(game) {
  const status = game.status;
  if (!status) return formatShortDate(game.gameDate);

  if (isPregame(status)) {
    return `Starts at ${formatTimeOnly(game.gameDate)}`;
  }
  if (isLive(status)) {
    return 'Live';
  }
  if (isFinal(status)) {
    return 'Final \u2014 recap available';
  }
  if (status === 'postponed') return 'Postponed';
  if (status === 'canceled') return 'Canceled';
  return formatShortDate(game.gameDate);
}

// ============================================
// Team Abbreviations
// ============================================

const TEAM_ABBRS = {
  // NBA
  'Atlanta Hawks': 'ATL', 'Boston Celtics': 'BOS', 'Brooklyn Nets': 'BKN',
  'Charlotte Hornets': 'CHA', 'Chicago Bulls': 'CHI', 'Cleveland Cavaliers': 'CLE',
  'Dallas Mavericks': 'DAL', 'Denver Nuggets': 'DEN', 'Detroit Pistons': 'DET',
  'Golden State Warriors': 'GSW', 'Houston Rockets': 'HOU', 'Indiana Pacers': 'IND',
  'LA Clippers': 'LAC', 'Los Angeles Clippers': 'LAC',
  'Los Angeles Lakers': 'LAL', 'Memphis Grizzlies': 'MEM',
  'Miami Heat': 'MIA', 'Milwaukee Bucks': 'MIL', 'Minnesota Timberwolves': 'MIN',
  'New Orleans Pelicans': 'NOP', 'New York Knicks': 'NYK',
  'Oklahoma City Thunder': 'OKC', 'Orlando Magic': 'ORL',
  'Philadelphia 76ers': 'PHI', 'Phoenix Suns': 'PHX', 'Portland Trail Blazers': 'POR',
  'Sacramento Kings': 'SAC', 'San Antonio Spurs': 'SAS', 'Toronto Raptors': 'TOR',
  'Utah Jazz': 'UTA', 'Washington Wizards': 'WAS',
  // NHL (common)
  'Anaheim Ducks': 'ANA', 'Arizona Coyotes': 'ARI', 'Boston Bruins': 'BOS',
  'Buffalo Sabres': 'BUF', 'Calgary Flames': 'CGY', 'Carolina Hurricanes': 'CAR',
  'Chicago Blackhawks': 'CHI', 'Colorado Avalanche': 'COL', 'Columbus Blue Jackets': 'CBJ',
  'Dallas Stars': 'DAL', 'Detroit Red Wings': 'DET', 'Edmonton Oilers': 'EDM',
  'Florida Panthers': 'FLA', 'Los Angeles Kings': 'LAK', 'Minnesota Wild': 'MIN',
  'Montreal Canadiens': 'MTL', 'Nashville Predators': 'NSH', 'New Jersey Devils': 'NJD',
  'New York Islanders': 'NYI', 'New York Rangers': 'NYR', 'Ottawa Senators': 'OTT',
  'Philadelphia Flyers': 'PHI', 'Pittsburgh Penguins': 'PIT', 'San Jose Sharks': 'SJS',
  'Seattle Kraken': 'SEA', 'St. Louis Blues': 'STL', 'Tampa Bay Lightning': 'TBL',
  'Toronto Maple Leafs': 'TOR', 'Vancouver Canucks': 'VAN',
  'Vegas Golden Knights': 'VGK', 'Washington Capitals': 'WSH', 'Winnipeg Jets': 'WPG',
  'Utah Hockey Club': 'UTA',
};

export function teamAbbr(name) {
  if (!name) return '???';
  if (TEAM_ABBRS[name]) return TEAM_ABBRS[name];
  // Fallback: take first 3 characters of last word
  const words = name.split(' ');
  return words[words.length - 1].substring(0, 3).toUpperCase();
}

// ============================================
// Book Name Abbreviations
// ============================================

const BOOK_ABBRS = {
  'DraftKings': 'DK', 'FanDuel': 'FD', 'BetMGM': 'MGM', 'Caesars': 'CZR',
  'PointsBet': 'PB', 'BetRivers': 'BR', 'Pinnacle': 'PIN', 'Bet365': '365',
  'WynnBET': 'WYNN', 'Unibet': 'UNI', 'Barstool': 'BS', 'Hard Rock': 'HR',
  'ESPN BET': 'ESPN', 'Fliff': 'FLIFF', 'Fanatics': 'FAN',
};

export function bookAbbr(name) {
  if (!name) return '?';
  return BOOK_ABBRS[name] || name.substring(0, 3).toUpperCase();
}

// ============================================
// Odds Formatting
// ============================================

export function formatOdds(price, format = 'american') {
  if (price == null) return '--';

  if (format === 'decimal') {
    let decimal;
    if (price > 0) {
      decimal = (price / 100) + 1;
    } else {
      decimal = (100 / Math.abs(price)) + 1;
    }
    return decimal.toFixed(2);
  }

  // American
  return price > 0 ? `+${price}` : `${price}`;
}

export function formatEV(ev) {
  if (ev == null) return '';
  const sign = ev >= 0 ? '+' : '';
  return `${sign}${ev.toFixed(1)}% EV`;
}

export function evClass(ev) {
  if (ev == null) return 'neutral';
  if (ev >= 5) return 'positive';
  if (ev > 0) return 'positive-muted';
  if (ev < 0) return 'negative';
  return 'neutral';
}

// ============================================
// Market Labels
// ============================================

const MARKET_LABELS = {
  'moneyline': 'ML',
  'spreads': 'Spread',
  'totals': 'Total',
  'player_points': 'Pts',
  'player_rebounds': 'Reb',
  'player_assists': 'Ast',
  'player_threes': '3PT',
  'player_pts_rebs_asts': 'PRA',
  'player_pts_rebs': 'PR',
  'player_pts_asts': 'PA',
  'player_rebs_asts': 'RA',
  'player_steals': 'Stl',
  'player_blocks': 'Blk',
  'player_turnovers': 'TO',
  'alternate_spreads': 'Alt Sprd',
  'alternate_totals': 'Alt Tot',
  'team_totals': 'Team Tot',
};

export function marketLabel(market) {
  return MARKET_LABELS[market] || market;
}

// ============================================
// League Colors (CSS class mapping)
// ============================================

export function leagueClass(league) {
  return (league || '').toUpperCase();
}

// ============================================
// Escape HTML for safe rendering
// ============================================

export function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
