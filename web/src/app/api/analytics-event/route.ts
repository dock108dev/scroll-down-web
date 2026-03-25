import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight self-hosted analytics endpoint.
 *
 * Receives pageview and custom events from the client via sendBeacon.
 * Currently logs to stdout (captured by Docker). To persist long-term,
 * forward these events to your backend or a time-series store.
 *
 * No cookies, no PII, no third-party services.
 */

interface AnalyticsEvent {
  type: "pageview" | "event";
  url: string;
  referrer?: string;
  name?: string;       // custom event name
  props?: Record<string, string | number | boolean>;
  screen?: string;     // e.g. "1920x1080"
  timestamp?: number;
}

/** Drop last octet (IPv4) or last 4 groups (IPv6) for privacy. */
function anonymizeIp(header: string | null): string | null {
  const raw = header?.split(",")[0]?.trim();
  if (!raw) return null;
  const v4 = raw.split(".");
  if (v4.length === 4) return `${v4[0]}.${v4[1]}.${v4[2]}.0`;
  const v6 = raw.split(":");
  if (v6.length > 4) return v6.slice(0, 4).join(":") + "::";
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body: AnalyticsEvent = await req.json();

    if (!body.type || !body.url) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const entry = {
      _analytics: true,
      type: body.type,
      url: body.url,
      referrer: body.referrer || null,
      name: body.name || null,
      props: body.props || null,
      screen: body.screen || null,
      ts: body.timestamp || Date.now(),
      ip: anonymizeIp(req.headers.get("x-forwarded-for")),
      ua: req.headers.get("user-agent") || null,
    };

    console.log(JSON.stringify(entry));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
