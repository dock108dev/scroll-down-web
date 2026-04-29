import { ADS_ENABLED, ADSENSE_CLIENT_ID } from "./config";

export type ViewerEntitlements = {
  isAuthenticated: boolean;
  isAdmin?: boolean;
  isPaid?: boolean;
  suppressAds?: boolean;
};

/**
 * Single source of truth for ad eligibility. Returns true only when the global
 * kill switch is on, an AdSense client is configured, and the viewer is a
 * non-admin, non-paid user without the suppress flag. A null viewer means
 * unauthenticated — treated as a free user.
 */
export function shouldShowAds(viewer: ViewerEntitlements | null): boolean {
  if (!ADS_ENABLED) return false;
  if (!ADSENSE_CLIENT_ID) return false;
  if (!viewer) return true;
  if (viewer.isAdmin) return false;
  if (viewer.isPaid) return false;
  if (viewer.suppressAds) return false;
  return true;
}
