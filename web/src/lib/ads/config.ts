/**
 * Centralized ad configuration. Reads NEXT_PUBLIC_ADSENSE_* env vars once so
 * components don't scatter env access. ADS_ENABLED is opt-in (`=== 'true'`):
 * any other value — absent, empty, or 'false' — disables ads.
 */

export const ADS_ENABLED = process.env.NEXT_PUBLIC_ADS_ENABLED === "true";

export const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID ?? "";

export const ADSENSE_HOME_FEED_SLOT =
  process.env.NEXT_PUBLIC_ADSENSE_HOME_FEED_SLOT ?? "";

export const ADSENSE_GAME_DETAIL_SLOT =
  process.env.NEXT_PUBLIC_ADSENSE_GAME_DETAIL_SLOT ?? "";

export const ADSENSE_FAIRBET_SLOT =
  process.env.NEXT_PUBLIC_ADSENSE_FAIRBET_SLOT ?? "";

export const ADSENSE_BOTTOM_SLOT =
  process.env.NEXT_PUBLIC_ADSENSE_BOTTOM_SLOT ?? "";

export const ADSENSE_SEO_CONTENT_SLOT =
  process.env.NEXT_PUBLIC_ADSENSE_SEO_CONTENT_SLOT ?? "";
