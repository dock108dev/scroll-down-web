/**
 * Game Detail Component — renders the full game detail page
 */
import { escapeHtml, teamAbbr, formatShortDate, isFinal, isLive, isPregame, formatOdds, bookAbbr, statusLine } from '../utils.js';
import { getScoreDisplay, isGameRead, markGameRead, getOddsFormat } from '../state.js';

export function renderGameDetail(game, flow, pbpData) {
  const final = isFinal(game.status);
  const live = isLive(game.status);
  const scoreDisplay = getScoreDisplay();
  const read = isGameRead(game.id);
  const showScores = scoreDisplay === 'always' || read;
  const format = getOddsFormat();

  let scoreHtml = '';
  if (game.homeScore != null && game.awayScore != null) {
    if (showScores) {
      scoreHtml = `<div class="detail-score">${game.awayScore} - ${game.homeScore}</div>`;
    } else {
      scoreHtml = `
        <div class="detail-score" style="cursor:pointer" title="Click to reveal score" id="detail-score-reveal">
          <span style="opacity:0.3">Tap to reveal</span>
        </div>`;
    }
  }

  const statusText = statusLine(game);

  // Header
  let html = `
    <div class="detail-header">
      <div class="detail-league">
        <span class="league-pill" data-league="${escapeHtml(game.leagueCode || '')}">${escapeHtml(game.leagueCode || '')}</span>
      </div>
      <div class="detail-teams">${escapeHtml(game.awayTeam)} at ${escapeHtml(game.homeTeam)}</div>
      ${scoreHtml}
      <div class="detail-status">${escapeHtml(statusText)}</div>
      <div class="detail-date">${escapeHtml(formatShortDate(game.gameDate))}</div>
    </div>`;

  // Mark as Read button (for final games not yet read)
  if (final && !read && scoreDisplay !== 'always') {
    html += `
      <div style="text-align:center;margin-bottom:var(--space-xl)">
        <button class="btn-primary" id="mark-read-btn" style="max-width:240px">Mark as Read</button>
      </div>`;
  }

  // Game Flow section (narrative blocks)
  if (flow && flow.blocks && flow.blocks.length > 0) {
    html += renderFlowSection(flow, game);
  }

  // Play-by-play section
  if (pbpData && pbpData.events && pbpData.events.length > 0) {
    html += renderPbpSection(pbpData, game);
  } else if (game.groupedPlays && game.groupedPlays.length > 0) {
    html += renderGroupedPlaysSection(game);
  }

  // Odds section
  if (game.odds && game.odds.length > 0) {
    html += renderOddsSection(game, format);
  }

  // Team Stats section
  if (game.teamStats || game.homeTeamStats || game.awayTeamStats) {
    html += renderTeamStatsSection(game);
  }

  // Player Stats section
  if (game.playerStats && game.playerStats.length > 0) {
    html += renderPlayerStatsSection(game);
  }

  return html;
}

// ============================================
// Flow Section
// ============================================

function renderFlowSection(flow, game) {
  const blocksHtml = flow.blocks.map((block, i) => {
    const periodRange = block.periodRange || '';
    const narrative = block.narrative || block.text || '';
    let scoreStr = '';
    if (block.awayScore != null && block.homeScore != null) {
      scoreStr = `${teamAbbr(game.awayTeam)} ${block.awayScore} - ${block.homeScore} ${teamAbbr(game.homeTeam)}`;
    }

    // Block stars
    let starsHtml = '';
    if (block.blockStars && block.blockStars.length > 0) {
      const starNames = block.blockStars.map(s => escapeHtml(s.playerName || s.name || '')).join(', ');
      starsHtml = `<div style="font-size:var(--font-size-sm);color:var(--color-text-secondary);margin-top:var(--space-md)">\u2B50 ${starNames}</div>`;
    }

    return `
      <div class="flow-block">
        <div class="flow-period">${escapeHtml(String(periodRange))}</div>
        <div class="flow-narrative">${escapeHtml(narrative)}</div>
        ${scoreStr ? `<div class="flow-score-line">${escapeHtml(scoreStr)}</div>` : ''}
        ${starsHtml}
      </div>`;
  }).join('');

  return `
    <div class="detail-section" id="section-flow">
      <div class="detail-section-header" data-section="flow">
        <span class="detail-section-title">Game Flow</span>
        <span class="detail-section-chevron">\u25BC</span>
      </div>
      <div class="detail-section-body">
        ${blocksHtml}
      </div>
    </div>`;
}

// ============================================
// PBP Section
// ============================================

function renderPbpSection(pbpData, game) {
  const events = pbpData.events || [];
  const entries = events.slice(0, 100).map(e => {
    const tier = e.tier || 3;
    const tierClass = `tier-${tier}`;
    const timeLabel = e.timeLabel || e.periodLabel || '';
    const text = e.description || e.text || '';
    const scoreStr = (e.awayScore != null && e.homeScore != null)
      ? `<span class="pbp-score">${e.awayScore}-${e.homeScore}</span>`
      : '';

    return `
      <div class="pbp-entry ${tierClass}">
        <span class="pbp-time">${escapeHtml(timeLabel)}</span>
        <span class="pbp-text">${escapeHtml(text)} ${scoreStr}</span>
      </div>`;
  }).join('');

  return `
    <div class="detail-section collapsed" id="section-pbp">
      <div class="detail-section-header" data-section="pbp">
        <span class="detail-section-title">Play-by-Play</span>
        <span class="detail-section-chevron">\u25BC</span>
      </div>
      <div class="detail-section-body">
        ${entries}
        ${events.length > 100 ? `<div class="section-empty">Showing first 100 plays</div>` : ''}
      </div>
    </div>`;
}

// ============================================
// Grouped Plays Section (from game detail response)
// ============================================

function renderGroupedPlaysSection(game) {
  const groups = game.groupedPlays || [];
  const html = groups.map(group => {
    const plays = (group.plays || []).slice(0, 50);
    const playsHtml = plays.map(p => {
      const tier = p.tier || 3;
      return `
        <div class="pbp-entry tier-${tier}">
          <span class="pbp-time">${escapeHtml(p.timeLabel || '')}</span>
          <span class="pbp-text">${escapeHtml(p.description || '')} ${
            p.awayScore != null ? `<span class="pbp-score">${p.awayScore}-${p.homeScore}</span>` : ''
          }</span>
        </div>`;
    }).join('');

    return `
      <div style="margin-bottom:var(--space-xl)">
        <div class="stats-group-header">${escapeHtml(group.periodLabel || group.label || '')}</div>
        ${playsHtml}
      </div>`;
  }).join('');

  return `
    <div class="detail-section collapsed" id="section-plays">
      <div class="detail-section-header" data-section="plays">
        <span class="detail-section-title">Play-by-Play</span>
        <span class="detail-section-chevron">\u25BC</span>
      </div>
      <div class="detail-section-body">
        ${html}
      </div>
    </div>`;
}

// ============================================
// Odds Section
// ============================================

function renderOddsSection(game, format) {
  const odds = game.odds || [];
  // Get unique books
  const books = [...new Set(odds.map(o => o.book).filter(Boolean))];
  // Get unique markets
  const markets = [];
  const seen = new Set();
  for (const o of odds) {
    const key = `${o.marketType || ''}|${o.description || ''}|${o.side || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      markets.push(o);
    }
  }

  if (books.length === 0 || markets.length === 0) return '';

  // Build table headers
  const headerCells = books.map(b => `<th>${escapeHtml(bookAbbr(b))}</th>`).join('');

  // Build rows
  const rows = markets.slice(0, 30).map(market => {
    const label = market.description || `${market.marketType || ''} ${market.side || ''}`;
    const cells = books.map(b => {
      const entry = odds.find(o =>
        o.book === b &&
        o.marketType === market.marketType &&
        o.description === market.description &&
        o.side === market.side
      );
      if (entry && entry.price != null) {
        return `<td>${formatOdds(entry.price, format)}</td>`;
      }
      return `<td class="odds-missing">--</td>`;
    }).join('');

    return `<tr><td>${escapeHtml(label)}</td>${cells}</tr>`;
  }).join('');

  return `
    <div class="detail-section collapsed" id="section-odds">
      <div class="detail-section-header" data-section="odds">
        <span class="detail-section-title">Odds Comparison</span>
        <span class="detail-section-chevron">\u25BC</span>
      </div>
      <div class="detail-section-body">
        <div class="odds-table-wrapper">
          <table class="odds-table">
            <thead><tr><th>Market</th>${headerCells}</tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${markets.length > 30 ? `<div class="section-empty">Showing first 30 markets</div>` : ''}
      </div>
    </div>`;
}

// ============================================
// Team Stats Section
// ============================================

function renderTeamStatsSection(game) {
  const away = game.awayTeamStats || game.teamStats?.away || {};
  const home = game.homeTeamStats || game.teamStats?.home || {};

  const allKeys = [...new Set([...Object.keys(away), ...Object.keys(home)])];
  if (allKeys.length === 0) return '';

  const rows = allKeys.map(key => {
    const label = key.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
    const awayVal = away[key] != null ? String(away[key]) : '--';
    const homeVal = home[key] != null ? String(home[key]) : '--';

    return `
      <tr>
        <td style="text-align:center;width:30%">${escapeHtml(awayVal)}</td>
        <td style="text-align:center;font-weight:500;color:var(--color-text-secondary)">${escapeHtml(label)}</td>
        <td style="text-align:center;width:30%">${escapeHtml(homeVal)}</td>
      </tr>`;
  }).join('');

  return `
    <div class="detail-section collapsed" id="section-team-stats">
      <div class="detail-section-header" data-section="team-stats">
        <span class="detail-section-title">Team Stats</span>
        <span class="detail-section-chevron">\u25BC</span>
      </div>
      <div class="detail-section-body">
        <table class="stats-table">
          <thead>
            <tr>
              <th style="text-align:center">${escapeHtml(teamAbbr(game.awayTeam))}</th>
              <th style="text-align:center">Stat</th>
              <th style="text-align:center">${escapeHtml(teamAbbr(game.homeTeam))}</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

// ============================================
// Player Stats Section
// ============================================

function renderPlayerStatsSection(game) {
  const players = game.playerStats || [];
  if (players.length === 0) return '';

  // Group by team
  const byTeam = {};
  for (const p of players) {
    const team = p.team || 'Unknown';
    if (!byTeam[team]) byTeam[team] = [];
    byTeam[team].push(p);
  }

  let html = '';
  for (const [team, teamPlayers] of Object.entries(byTeam)) {
    const statKeys = ['pts', 'reb', 'ast', 'stl', 'blk', 'min', 'fgm', 'fga', 'fg_pct'];
    const availableKeys = statKeys.filter(k =>
      teamPlayers.some(p => p.rawStats?.[k] != null || p[k] != null)
    );

    if (availableKeys.length === 0) continue;

    const headerCells = availableKeys.map(k => `<th>${escapeHtml(k.toUpperCase())}</th>`).join('');
    const rows = teamPlayers.map(p => {
      const cells = availableKeys.map(k => {
        const val = p.rawStats?.[k] ?? p[k];
        return `<td>${val != null ? val : '--'}</td>`;
      }).join('');
      return `<tr><td style="font-weight:500">${escapeHtml(p.name || p.playerName || '')}</td>${cells}</tr>`;
    }).join('');

    html += `
      <div class="stats-group-header">${escapeHtml(team)}</div>
      <div class="odds-table-wrapper">
        <table class="stats-table">
          <thead><tr><th>Player</th>${headerCells}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  return `
    <div class="detail-section collapsed" id="section-player-stats">
      <div class="detail-section-header" data-section="player-stats">
        <span class="detail-section-title">Player Stats</span>
        <span class="detail-section-chevron">\u25BC</span>
      </div>
      <div class="detail-section-body">
        ${html}
      </div>
    </div>`;
}
