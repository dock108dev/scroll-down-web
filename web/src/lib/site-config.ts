const DEFAULT_PROD_SITE_URL = "https://scrolldownsports.com";
const DEFAULT_DEV_SITE_URL = "https://scrolldownsports.dev";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

export function getSiteUrl(): string {
  const explicit = process.env.PUBLIC_BASE_URL ?? process.env.SITE_URL;
  if (explicit) return trimTrailingSlash(explicit);
  return process.env.NODE_ENV === "production" ? DEFAULT_PROD_SITE_URL : DEFAULT_DEV_SITE_URL;
}

export function getSiteHost(): string {
  return new URL(getSiteUrl()).hostname;
}

export function isNoIndexSite(): boolean {
  if (process.env.SITE_NOINDEX === "true") return true;
  if (process.env.SITE_NOINDEX === "false") return false;
  return getSiteHost() === "scrolldownsports.dev";
}
