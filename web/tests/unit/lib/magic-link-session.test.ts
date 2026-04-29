import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  signSession,
  verifySession,
  generateMagicToken,
  storeMagicToken,
  consumeMagicToken,
} from "@/lib/magic-link";

describe("magic-link session + tokens", () => {
  beforeEach(() => {
    vi.stubEnv(
      "MAGIC_LINK_SECRET",
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("round-trips signed session JWT", () => {
    const token = signSession(
      { userId: "u1", email: "a@b.com", tier: "pro" },
      3600,
    );
    const payload = verifySession(token);
    expect(payload?.email).toBe("a@b.com");
    expect(payload?.tier).toBe("pro");
  });

  it("returns null for bad secret or malformed token", () => {
    expect(verifySession("not.a.jwt")).toBeNull();
    vi.stubEnv("MAGIC_LINK_SECRET", "");
    expect(verifySession("a.b.c")).toBeNull();
  });

  it("stores and consumes one-time magic tokens", () => {
    const t = generateMagicToken();
    expect(t.length).toBeGreaterThan(10);
    storeMagicToken(t, "user@test.com", "anon");
    expect(consumeMagicToken(t)).toEqual({ email: "user@test.com", anonId: "anon" });
    expect(consumeMagicToken(t)).toBeNull();
  });
});
