/**
 * Game Card Component — renders a game summary card for the home feed
 */
import { escapeHtml, teamAbbr, formatShortDate, isFinal, isLive, isPregame, formatTimeOnly } from '../utils.js';
import { isGameRead, getScoreDisplay } from '../state.js';

export function renderGameCard(game) {
  const hasData = game.hasOdds || game.hasPbp || game.hasSocial || game.hasRequiredData;
  const cardClass = hasData ? 'game-card' : 'game-card no-data';
  const read = isFinal(game.status) && isGameRead(game.id);
  const scoreDisplay = getScoreDisplay();
  const showScores = scoreDisplay === 'always' || read;
  const live = isLive(game.status);
  const final = isFinal(game.status);

  let scoreHtml = '';
  if (game.homeScore != null && game.awayScore != null) {
    if (showScores) {
      scoreHtml = `
        <div class="game-score">
          ${escapeHtml(teamAbbr(game.awayTeam))} ${game.awayScore}
          <span style="color:var(--color-text-tertiary)"> - </span>
          ${game.homeScore} ${escapeHtml(teamAbbr(game.homeTeam))}
        </div>`;
    } else {
      scoreHtml = `<div class="game-score hidden-score">_ _ - _ _</div>`;
    }
  }

  let statusHtml = '';
  if (live) {
    let liveText = 'Live';
    if (game.currentPeriod) {
      const periodLabel = formatPeriodLabel(game.currentPeriod, game.leagueCode);
      liveText = periodLabel;
      if (game.gameClock) {
        liveText += ` ${game.gameClock}`;
      }
    }
    statusHtml = `<span class="live-indicator"><span class="live-dot"></span> ${escapeHtml(liveText)}</span>`;
  } else if (final) {
    statusHtml = `<span class="game-final">Final</span>`;
  }

  const dateText = formatShortDate(game.gameDate);
  const readCheck = read ? '<span class="game-read-check">\u2713</span>' : '';

  // Odds preview from derived metrics
  let oddsPreview = '';
  if (game.derivedMetrics) {
    const spread = game.derivedMetrics.pregameSpread || game.derivedMetrics.spread;
    const total = game.derivedMetrics.pregameTotal || game.derivedMetrics.total;
    const parts = [];
    if (spread) parts.push(escapeHtml(String(spread)));
    if (total) parts.push(`O/U ${escapeHtml(String(total))}`);
    if (parts.length > 0) {
      oddsPreview = `<div class="game-odds-preview">${parts.join(' &middot; ')}</div>`;
    }
  }

  return `
    <div class="${cardClass}" data-game-id="${game.id}" data-league="${escapeHtml(game.leagueCode)}" ${hasData ? '' : 'data-no-click'}>
      <span class="league-pill" data-league="${escapeHtml(game.leagueCode)}">${escapeHtml(game.leagueCode)}</span>
      <div class="game-matchup">${escapeHtml(game.awayTeam)} at ${escapeHtml(game.homeTeam)}</div>
      ${scoreHtml}
      ${oddsPreview}
      <div class="game-footer">
        <div class="game-status">
          ${statusHtml}
          <span class="game-date">${escapeHtml(dateText)}</span>
        </div>
        ${readCheck}
      </div>
    </div>`;
}

function formatPeriodLabel(period, league) {
  const code = (league || '').toUpperCase();
  if (code === 'NHL') {
    if (period <= 3) return `P${period}`;
    if (period === 4) return 'OT';
    return `${period - 3}OT`;
  }
  // Basketball default
  if (period <= 4) return `Q${period}`;
  if (period === 5) return 'OT';
  return `${period - 4}OT`;
}
