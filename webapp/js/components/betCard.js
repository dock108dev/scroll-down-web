/**
 * Bet Card Component — renders a FairBet odds comparison card
 *
 * API uses snake_case:
 *   bet: game_id, league_code, home_team, away_team, game_date, market_key,
 *        selection_key, line_value, books, player_name, true_prob, ev_confidence_tier
 *   book: book, price, ev_percent, implied_prob, true_prob, is_sharp
 */
import { escapeHtml, formatOdds, formatEV, evClass, bookAbbr, marketLabel, formatRelativeDate } from '../utils.js';
import { getOddsFormat } from '../state.js';

export function renderBetCard(rawBet) {
  const bet = normalizeBet(rawBet);
  const format = getOddsFormat();
  const bestBook = findBestBook(bet);
  const bestEV = bestBook?.ev_percent ?? 0;
  const isHighValue = bestEV >= 5;
  const cardClass = isHighValue ? 'bet-card high-value' : 'bet-card';

  // Fair odds from server
  const fairOdds = bet.true_prob ? probToAmerican(bet.true_prob) : null;
  const hasFairEstimate = fairOdds != null && fairOdds !== 0;

  // Selection display
  const selectionDisplay = buildSelectionDisplay(bet);
  const contextLine = buildContextLine(bet);
  const timeDisplay = formatRelativeDate(bet.game_date);

  // Primary book — best available
  const primaryBookHtml = bestBook ? renderPrimaryBook(bestBook, format) : '';

  // Fair reference
  const fairHtml = hasFairEstimate ? `
    <button class="fair-reference">
      <span class="fair-label">Est. fair</span>
      <span class="fair-odds">${formatOdds(fairOdds, format)}</span>
      <span class="fair-info-icon">\u24D8</span>
    </button>` : '';

  // Other books
  const otherBooks = (bet.books || [])
    .filter(b => !bestBook || b.book !== bestBook.book)
    .sort((a, b) => (b.ev_percent || 0) - (a.ev_percent || 0));

  const otherBooksHtml = otherBooks.length > 0 ? `
    <div class="other-books-section">
      <button class="other-books-toggle" onclick="this.parentElement.classList.toggle('expanded')">
        Other books <span class="toggle-arrow">\u25BE</span>
        <span>(${otherBooks.length})</span>
      </button>
      <div class="other-books-list">
        ${otherBooks.map(b => renderMiniBookChip(b, format)).join('')}
      </div>
    </div>` : '';

  // Horizontal scroll for tablet/desktop
  const allBooksSorted = [...(bet.books || [])].sort((a, b) => (b.ev_percent || 0) - (a.ev_percent || 0));
  const bookScrollHtml = allBooksSorted.length > 0 ? `
    <div class="book-scroll">
      ${allBooksSorted.map(b => renderMiniBookChip(b, format, b.book === bestBook?.book)).join('')}
    </div>` : '';

  const leagueDisplay = bet.league_code || '';

  return `
    <div class="${cardClass}">
      <div class="bet-description">
        <div class="bet-row1">
          <span class="bet-selection">${escapeHtml(selectionDisplay)}</span>
          <div class="bet-badges">
            <span class="bet-league-badge league-pill" data-league="${escapeHtml(leagueDisplay)}">${escapeHtml(leagueDisplay)}</span>
            <span class="bet-market-label">${escapeHtml(marketLabel(bet.market_key))}</span>
          </div>
        </div>
        <div class="bet-row2">
          <span>${escapeHtml(contextLine)}</span>
          <span>${escapeHtml(timeDisplay)}</span>
        </div>
      </div>
      <div class="bet-divider"></div>
      <div class="bet-actions bet-actions-compact">
        ${primaryBookHtml}
        ${fairHtml}
        ${otherBooksHtml}
      </div>
      <div class="bet-actions bet-actions-regular" style="display:none">
        ${bookScrollHtml}
        ${fairHtml}
      </div>
    </div>`;
}

/**
 * Normalize bet data — handles both camelCase and snake_case
 */
function normalizeBet(bet) {
  return {
    game_id: bet.game_id ?? bet.gameId,
    league_code: bet.league_code ?? bet.leagueCode ?? '',
    home_team: bet.home_team ?? bet.homeTeam ?? '',
    away_team: bet.away_team ?? bet.awayTeam ?? '',
    game_date: bet.game_date ?? bet.gameDate ?? '',
    market_key: bet.market_key ?? bet.marketKey ?? '',
    selection_key: bet.selection_key ?? bet.selectionKey ?? '',
    line_value: bet.line_value ?? bet.lineValue ?? null,
    books: (bet.books || []).map(normalizeBook),
    player_name: bet.player_name ?? bet.playerName ?? null,
    true_prob: bet.true_prob ?? bet.trueProb ?? null,
    ev_confidence_tier: bet.ev_confidence_tier ?? bet.evConfidenceTier ?? null,
    bet_description: bet.bet_description ?? bet.betDescription ?? null,
  };
}

function normalizeBook(book) {
  return {
    book: book.book ?? book.name ?? '',
    price: typeof book.price === 'number' ? Math.round(book.price) : (book.priceValue ? Math.round(book.priceValue) : 0),
    ev_percent: book.ev_percent ?? book.evPercent ?? 0,
    implied_prob: book.implied_prob ?? book.impliedProb ?? null,
    true_prob: book.true_prob ?? book.trueProb ?? null,
    is_sharp: book.is_sharp ?? book.isSharp ?? false,
  };
}

function findBestBook(bet) {
  if (!bet.books || bet.books.length === 0) return null;
  return bet.books.reduce((best, b) => {
    if (!best) return b;
    return (b.ev_percent || 0) > (best.ev_percent || 0) ? b : best;
  }, null);
}

function renderPrimaryBook(book, format) {
  const ev = book.ev_percent || 0;
  const evCls = evClass(ev);

  return `
    <div class="bet-primary-book">
      <span class="book-abbr">${escapeHtml(bookAbbr(book.book))}</span>
      <span class="book-price">${formatOdds(book.price, format)}</span>
      <span class="best-badge positive">Best</span>
      <span class="ev-label ${evCls}">${formatEV(ev)}</span>
    </div>`;
}

function renderMiniBookChip(book, format, isBest = false) {
  const ev = book.ev_percent || 0;
  const evCls = evClass(ev);

  return `
    <div class="mini-book-chip ${isBest ? 'best' : ''}">
      <span class="chip-name">${escapeHtml(bookAbbr(book.book))}</span>
      <span class="chip-price">${formatOdds(book.price, format)}</span>
      <span class="chip-ev ${evCls}">${ev !== 0 ? formatEV(ev) : ''}</span>
    </div>`;
}

function buildSelectionDisplay(bet) {
  const selection = parseSelection(bet);
  const market = bet.market_key || '';

  // Player props: "Name Stat O/U Line"
  if (bet.player_name && bet.line_value != null) {
    const side = selection === 'Over' ? 'O' : selection === 'Under' ? 'U' : selection;
    return `${bet.player_name} ${marketLabel(market)} ${side} ${bet.line_value}`;
  }

  // Mainline with line
  if (bet.line_value != null && bet.line_value !== 0) {
    const sign = bet.line_value > 0 ? '+' : '';
    return `${selection} ${sign}${bet.line_value}`;
  }

  return selection;
}

function buildContextLine(bet) {
  const market = bet.market_key || '';
  const isPlayerOrTeamProp = market.startsWith('player_') ||
    market.startsWith('team_') ||
    market === 'alternate_spreads' ||
    market === 'alternate_totals';

  if (isPlayerOrTeamProp) {
    return `${bet.away_team || '?'} @ ${bet.home_team || '?'}`;
  }

  const selection = parseSelection(bet);
  const opponent = selection === bet.home_team ? bet.away_team : bet.home_team;
  return `vs ${opponent || '?'}`;
}

function parseSelection(bet) {
  const key = bet.selection_key || '';
  const parts = key.split(':');
  if (parts.length < 2) return key;

  const raw = parts.slice(1).join(':');
  if (raw === 'over') return 'Over';
  if (raw === 'under') return 'Under';

  const normalized = raw.replace(/_/g, ' ');

  // Try to match home/away team
  if (bet.home_team && bet.home_team.toLowerCase().includes(normalized.toLowerCase())) {
    return bet.home_team;
  }
  if (bet.away_team && bet.away_team.toLowerCase().includes(normalized.toLowerCase())) {
    return bet.away_team;
  }

  // Capitalize each word
  return normalized.replace(/\b\w/g, c => c.toUpperCase());
}

function probToAmerican(prob) {
  if (prob <= 0 || prob >= 1) return 0;
  if (prob >= 0.5) {
    return Math.round(-100 * prob / (1 - prob));
  }
  return Math.round(100 * (1 - prob) / prob);
}
