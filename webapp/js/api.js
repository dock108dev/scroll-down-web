/**
 * API Client — matches iOS app's RealGameService endpoints
 * Base URL: sports-data-admin.dock108.ai
 */

const BASE_URL = 'https://sports-data-admin.dock108.ai';

// API key is optional for web beta (server may allow unauthenticated reads)
let apiKey = null;

export function setApiKey(key) {
  apiKey = key;
}

async function request(path, queryParams = {}) {
  const url = new URL(`${BASE_URL}/${path}`);
  for (const [key, value] of Object.entries(queryParams)) {
    if (value != null && value !== '') {
      url.searchParams.set(key, value);
    }
  }

  const headers = {};
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const response = await fetch(url.toString(), { headers });

  if (response.status === 401) {
    throw new Error('Unauthorized — API key required');
  }

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Date range helpers — uses Eastern Time to match iOS app
 */
function estDateString(date) {
  // Format as YYYY-MM-DD in America/New_York timezone
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function estToday() {
  return new Date();
}

function estShiftDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Fetch games for a given range and optional league filter
 */
export async function fetchGames(range, league = null) {
  const today = estToday();
  const params = { limit: '200' };

  switch (range) {
    case 'current': {
      const dateStr = estDateString(today);
      params.startDate = dateStr;
      params.endDate = dateStr;
      break;
    }
    case 'yesterday': {
      const dateStr = estDateString(estShiftDays(-1));
      params.startDate = dateStr;
      params.endDate = dateStr;
      break;
    }
    case 'earlier': {
      params.startDate = estDateString(estShiftDays(-3));
      params.endDate = estDateString(estShiftDays(-2));
      break;
    }
    case 'tomorrow': {
      const dateStr = estDateString(estShiftDays(1));
      params.startDate = dateStr;
      params.endDate = dateStr;
      break;
    }
  }

  if (league) {
    params.league = league;
  }

  return request('api/admin/sports/games', params);
}

/**
 * Fetch game detail by ID
 */
export async function fetchGameDetail(gameId) {
  return request(`api/admin/sports/games/${gameId}`);
}

/**
 * Fetch game flow (narrative blocks)
 */
export async function fetchGameFlow(gameId) {
  return request(`api/admin/sports/games/${gameId}/flow`);
}

/**
 * Fetch play-by-play for a game
 */
export async function fetchPbp(gameId) {
  return request(`api/admin/sports/pbp/game/${gameId}`);
}

/**
 * Fetch timeline artifact for a game
 */
export async function fetchTimeline(gameId) {
  return request(`api/admin/sports/games/${gameId}/timeline`);
}

/**
 * Fetch social posts for a game
 */
export async function fetchSocialPosts(gameId) {
  return request(`api/social/posts/game/${gameId}`);
}

/**
 * Fetch team colors
 */
export async function fetchTeamColors() {
  return request('api/admin/sports/teams');
}

/**
 * Fetch FairBet odds — paginated
 */
export async function fetchFairBetOdds(page = 1, league = null) {
  const params = {
    has_fair: 'true',
    page: String(page),
    page_size: '500',
  };
  if (league) {
    params.league = league;
  }
  return request('api/fairbet/odds', params);
}
