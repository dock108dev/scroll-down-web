/**
 * Realtime transport layer: WebSocket primary, SSE fallback, offline degraded.
 *
 * Usage:
 *   import { getTransport } from "@/realtime/transport";
 *   const rt = getTransport();
 *   rt.subscribe("games:nba:2026-03-05");
 */

import { BACKEND_BASE_URL, REALTIME } from "@/lib/config";

// ── Event types ─────────────────────────────────────────────────

export interface GamePatchEvent {
  type: "game_patch";
  channel: string;
  ts: number;
  seq: number;
  gameId: string;
  patch: Record<string, unknown>;
}

export interface PbpAppendEvent {
  type: "pbp_append";
  channel: string;
  ts: number;
  seq: number;
  gameId: string;
  events: Record<string, unknown>[];
}

export interface FairbetPatchEvent {
  type: "fairbet_patch";
  channel: string;
  ts: number;
  seq: number;
  patch: Record<string, unknown>;
}

export type RealtimeEvent = GamePatchEvent | PbpAppendEvent | FairbetPatchEvent;

export type TransportMode = "ws" | "sse" | "offline";

export interface TransportStatus {
  mode: TransportMode;
  connected: boolean;
  lastEventAt: number;
}

type MessageHandler = (event: RealtimeEvent) => void;

// ── URL helpers ──────────────────────────────────────────────────

function toWsUrl(baseHttpUrl: string, path = "/v1/ws"): string {
  const u = new URL(baseHttpUrl);
  u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
  u.pathname = path;
  u.search = "";
  return u.toString();
}

function toSseUrl(baseHttpUrl: string, channels: string[]): string {
  const u = new URL("/v1/sse", baseHttpUrl);
  u.searchParams.set("channels", channels.join(","));
  return u.toString();
}

// ── Transport implementation ────────────────────────────────────

class RealtimeTransport {
  private mode: TransportMode = "offline";
  private connected = false;
  private lastEventAt = 0;

  private activeChannels = new Set<string>();
  private handlers = new Set<MessageHandler>();

  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;

  private wsFailCount = 0;
  private wsFailWindowStart = 0;

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs = REALTIME.BACKOFF_INITIAL_MS;

  private baseUrl: string;
  private disposed = false;

  constructor() {
    this.baseUrl = BACKEND_BASE_URL;
  }

  // ── Public API ──────────────────────────────────────────────

  connect(): void {
    if (this.disposed) return;
    if (this.connected) return;
    this.attemptWs();
  }

  disconnect(): void {
    this.disposed = true;
    this.clearReconnect();
    this.teardownWs();
    this.teardownSse();
    this.connected = false;
    this.mode = "offline";
  }

  subscribe(channel: string): void {
    if (this.activeChannels.has(channel)) return;
    this.activeChannels.add(channel);

    // Auto-connect on first subscription
    if (!this.connected && !this.disposed) {
      this.connect();
      return; // connect() will subscribe all channels once open
    }

    if (this.mode === "ws" && this.ws?.readyState === WebSocket.OPEN) {
      this.wsSend({ type: "subscribe", channels: [channel] });
    } else if (this.mode === "sse") {
      this.reconnectSse();
    }
  }

  unsubscribe(channel: string): void {
    if (!this.activeChannels.has(channel)) return;
    this.activeChannels.delete(channel);

    if (this.mode === "ws" && this.ws?.readyState === WebSocket.OPEN) {
      this.wsSend({ type: "unsubscribe", channels: [channel] });
    } else if (this.mode === "sse") {
      this.reconnectSse();
    }

    if (this.activeChannels.size === 0) {
      this.teardownWs();
      this.teardownSse();
      this.clearReconnect();
      this.connected = false;
      this.mode = "offline";
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  getStatus(): TransportStatus {
    return {
      mode: this.mode,
      connected: this.connected,
      lastEventAt: this.lastEventAt,
    };
  }

  // ── WebSocket ───────────────────────────────────────────────

  private attemptWs(): void {
    if (this.disposed) return;
    this.teardownWs();

    const wsUrl = toWsUrl(this.baseUrl);

    try {
      this.ws = new WebSocket(wsUrl);
    } catch {
      this.onWsFail();
      return;
    }

    const connectTimeout = setTimeout(() => {
      if (this.ws?.readyState !== WebSocket.OPEN) {
        this.ws?.close();
        this.onWsFail();
      }
    }, 5_000);

    this.ws.onopen = () => {
      clearTimeout(connectTimeout);
      this.mode = "ws";
      this.connected = true;
      this.backoffMs = REALTIME.BACKOFF_INITIAL_MS;
      this.wsFailCount = 0;

      this.teardownSse();

      if (this.activeChannels.size > 0) {
        this.wsSend({
          type: "subscribe",
          channels: Array.from(this.activeChannels),
        });
      }
    };

    this.ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as RealtimeEvent;
        this.dispatch(data);
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      clearTimeout(connectTimeout);
      this.connected = false;
      if (!this.disposed) this.onWsFail();
    };

    this.ws.onerror = () => {
      clearTimeout(connectTimeout);
    };
  }

  private onWsFail(): void {
    this.teardownWs();
    this.connected = false;

    const now = Date.now();
    if (now - this.wsFailWindowStart > REALTIME.WS_FAIL_WINDOW_MS) {
      this.wsFailCount = 0;
      this.wsFailWindowStart = now;
    }
    this.wsFailCount++;

    if (this.wsFailCount >= REALTIME.WS_FAIL_THRESHOLD) {
      this.attemptSse();
    } else {
      this.scheduleReconnect(() => this.attemptWs());
    }
  }

  private teardownWs(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private wsSend(msg: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // ── SSE ─────────────────────────────────────────────────────

  private attemptSse(): void {
    if (this.disposed) return;
    if (this.activeChannels.size === 0) {
      this.mode = "offline";
      return;
    }

    this.teardownSse();

    const sseUrl = toSseUrl(this.baseUrl, Array.from(this.activeChannels));

    try {
      this.sse = new EventSource(sseUrl);
    } catch {
      this.mode = "offline";
      this.scheduleReconnect(() => this.attemptWs());
      return;
    }

    this.sse.onopen = () => {
      this.mode = "sse";
      this.connected = true;
      this.backoffMs = REALTIME.BACKOFF_INITIAL_MS;
    };

    this.sse.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as RealtimeEvent;
        this.dispatch(data);
      } catch {
        // Ignore
      }
    };

    this.sse.onerror = () => {
      this.teardownSse();
      this.connected = false;
      this.mode = "offline";
      this.scheduleReconnect(() => this.attemptWs());
    };

    // After SSE_FALLBACK_DURATION, try WS again in the background
    setTimeout(() => {
      if (this.mode === "sse" && !this.disposed) {
        this.attemptWs();
      }
    }, REALTIME.SSE_FALLBACK_DURATION_MS);
  }

  private reconnectSse(): void {
    if (this.mode !== "sse") return;
    this.attemptSse();
  }

  private teardownSse(): void {
    if (this.sse) {
      this.sse.onopen = null;
      this.sse.onmessage = null;
      this.sse.onerror = null;
      this.sse.close();
      this.sse = null;
    }
  }

  // ── Reconnect ───────────────────────────────────────────────

  private scheduleReconnect(fn: () => void): void {
    if (this.disposed) return;
    this.clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      fn();
    }, this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, REALTIME.BACKOFF_MAX_MS);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // ── Dispatch ────────────────────────────────────────────────

  private dispatch(event: RealtimeEvent): void {
    this.lastEventAt = Date.now();
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch {
        // Handler errors shouldn't crash the transport
      }
    }
  }
}

// ── Singleton ─────────────────────────────────────────────────

let instance: RealtimeTransport | null = null;

export function getTransport(): RealtimeTransport {
  if (!instance) {
    instance = new RealtimeTransport();
  }
  return instance;
}
