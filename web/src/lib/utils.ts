import { APP_TIMEZONE } from "./date-utils";

export function formatTimeET(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: APP_TIMEZONE,
  }) + " ET";
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: APP_TIMEZONE,
  });
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ─── Team color helpers ───────────────────────────────────

function isDarkMode(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.classList.contains("dark");
}

/** Parse a hex color (#RGB or #RRGGBB) into [r, g, b] (0-255). */
function parseHex(hex: string): [number, number, number] | null {
  const m = hex.match(/^#([0-9a-f]{3,8})$/i);
  if (!m) return null;
  const h = m[1];
  if (h.length === 3) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  if (h.length >= 6) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  return null;
}

/** Relative luminance (0-1) per WCAG. */
function luminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Lighten a hex color so it meets a minimum luminance threshold.
 * Mixes towards white until the target is reached.
 */
function ensureMinLuminance(hex: string, minLum: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  if (luminance(r, g, b) >= minLum) return hex;
  // Iteratively mix towards white
  for (let t = 0.05; t <= 0.95; t += 0.05) {
    const mr = Math.round(r + (255 - r) * t);
    const mg = Math.round(g + (255 - g) * t);
    const mb = Math.round(b + (255 - b) * t);
    if (luminance(mr, mg, mb) >= minLum) {
      return `#${mr.toString(16).padStart(2, "0")}${mg.toString(16).padStart(2, "0")}${mb.toString(16).padStart(2, "0")}`;
    }
  }
  return hex;
}

/**
 * Darken a hex color so it stays below a maximum luminance threshold.
 * Mixes towards black until the target is reached.
 */
function ensureMaxLuminance(hex: string, maxLum: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb;
  if (luminance(r, g, b) <= maxLum) return hex;
  for (let t = 0.05; t <= 0.95; t += 0.05) {
    const mr = Math.round(r * (1 - t));
    const mg = Math.round(g * (1 - t));
    const mb = Math.round(b * (1 - t));
    if (luminance(mr, mg, mb) <= maxLum) {
      return `#${mr.toString(16).padStart(2, "0")}${mg.toString(16).padStart(2, "0")}${mb.toString(16).padStart(2, "0")}`;
    }
  }
  return hex;
}

/**
 * Pick the correct team color for the current theme.
 * In dark mode, ensures the color is light enough to read against dark backgrounds.
 * In light mode, ensures the color is dark enough to read against light backgrounds.
 * Falls back to `fallback` if no color is available.
 */
export function resolveTeamColor(
  colorLight: string | undefined,
  colorDark: string | undefined,
  fallback = "#888",
): string {
  const dark = isDarkMode();
  const color = dark ? colorDark : colorLight;
  const resolved = color || fallback;
  if (dark) return ensureMinLuminance(resolved, 0.15);
  // In light mode, ensure color isn't too light to read on white
  return ensureMaxLuminance(resolved, 0.35);
}

/**
 * Returns inline style for team-colored text with a contrast outline.
 * Uses a CSS variable so the outline adapts to light/dark mode automatically.
 */
export function teamColorStyle(
  colorLight: string | undefined,
  colorDark: string | undefined,
  fallback = "#888",
): React.CSSProperties {
  const color = resolveTeamColor(colorLight, colorDark, fallback);
  return {
    color,
    textShadow: "var(--ds-team-text-outline)",
  };
}

