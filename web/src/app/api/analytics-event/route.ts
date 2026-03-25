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

export async function POST(req: NextRequest) {
  try {
    const body: AnalyticsEvent = await req.json();

    // Basic validation
    if (!body.type || !body.url) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    // Structured log — Docker/journald captures stdout
    const entry = {
      _analytics: true,
      type: body.type,
      url: body.url,
      referrer: body.referrer || null,
      name: body.name || null,
      props: body.props || null,
      screen: body.screen || null,
      ts: body.timestamp || Date.now(),
      // IP anonymized: drop last octet for privacy (e.g. 192.168.1.100 → 192.168.1.0)
      ip: (() => {
        const raw = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
        if (!raw) return null;
        const parts = raw.split(".");
        if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
        // IPv6: truncate last 4 groups
        const v6 = raw.split(":");
        if (v6.length > 4) return v6.slice(0, 4).join(":") + "::";
        return null;
      })(),
      ua: req.headers.get("user-agent") || null,
    };

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(entry));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
}
