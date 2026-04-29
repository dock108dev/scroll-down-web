import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

describe("magic-link accounts file helpers", () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = mkdtempSync(join(tmpdir(), "sd-acc-"));
    vi.stubEnv("DATA_DIR", dataDir);
    vi.stubEnv(
      "MAGIC_LINK_SECRET",
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    );
    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
  });

  afterEach(() => {
    rmSync(dataDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  it("creates and updates accounts on disk", async () => {
    const ml = await import("@/lib/magic-link");
    const a = ml.findOrCreateAccount("User@Test.COM", null);
    expect(a.email).toBe("user@test.com");
    expect(ml.findAccountByEmail("user@test.com")?.id).toBe(a.id);

    const merged = ml.findOrCreateAccount("user@test.com", "anon-123");
    expect(merged.anonId).toBe("anon-123");

    const updated = ml.updateAccountTier("user@test.com", "pro", "cus_ABC");
    expect(updated?.tier).toBe("pro");
    expect(ml.findAccountByStripeCustomerId("cus_ABC")?.email).toBe("user@test.com");
  });

  it("builds cookie headers with Secure flag only in production", async () => {
    let ml = await import("@/lib/magic-link");
    expect(ml.buildTierCookieHeader("free")).not.toContain("Secure");

    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    ml = await import("@/lib/magic-link");
    expect(ml.buildTierCookieHeader("pro")).toContain("Secure");
    expect(ml.buildSessionCookieHeader("jwt")).toContain("HttpOnly");
  });

  it("returns refreshed session when account exists", async () => {
    const ml = await import("@/lib/magic-link");
    ml.findOrCreateAccount("sess@test.com", null);
    const acct = ml.findAccountByEmail("sess@test.com")!;
    const refreshed = ml.buildRefreshedSessionCookie("sess@test.com", acct.id);
    expect(refreshed?.tier).toBe("free");
    expect(refreshed?.cookieValue.length).toBeGreaterThan(20);
    expect(ml.buildRefreshedSessionCookie("missing@test.com", "x")).toBeNull();
  });

  it("quarantines corrupt accounts JSON", async () => {
    writeFileSync(join(dataDir, "sd-accounts.json"), "{ not json");
    const ml = await import("@/lib/magic-link");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(ml.findAccountByEmail("any@test.com")).toBeNull();
    expect(existsSync(join(dataDir, "sd-accounts.json"))).toBe(false);
    spy.mockRestore();
  });

  it("logs magic link when RESEND_API_KEY missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const ml = await import("@/lib/magic-link");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    await ml.sendMagicLinkEmail("dev@test.com", "https://example.com/link");
    expect(info.mock.calls.some((c) => String(c).includes("sign-in link"))).toBe(true);
    info.mockRestore();
  });

  it("calls Resend when API key present", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, text: async () => "" }),
    );
    const ml = await import("@/lib/magic-link");
    await ml.sendMagicLinkEmail("u@test.com", "https://x");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
