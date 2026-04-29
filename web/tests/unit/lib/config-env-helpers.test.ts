import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("config env helpers", () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allowDevTierUrlOverrides is true in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { allowDevTierUrlOverrides } = await import("@/lib/config");
    expect(allowDevTierUrlOverrides()).toBe(true);
  });

  it("allowDevTierUrlOverrides is true in production only when E2E flag is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SCROLLDOWN_E2E", "");
    let { allowDevTierUrlOverrides } = await import("@/lib/config");
    expect(allowDevTierUrlOverrides()).toBe(false);

    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SCROLLDOWN_E2E", "1");
    ({ allowDevTierUrlOverrides } = await import("@/lib/config"));
    expect(allowDevTierUrlOverrides()).toBe(true);
  });

  it("detects Playwright web server env", async () => {
    vi.stubEnv("SCROLLDOWN_PLAYWRIGHT_WEB_SERVER", "");
    let { isPlaywrightServerEnv } = await import("@/lib/config");
    expect(isPlaywrightServerEnv()).toBe(false);

    vi.resetModules();
    vi.stubEnv("SCROLLDOWN_PLAYWRIGHT_WEB_SERVER", "1");
    ({ isPlaywrightServerEnv } = await import("@/lib/config"));
    expect(isPlaywrightServerEnv()).toBe(true);
  });

  it("validates email format without ReDoS-prone nesting", async () => {
    const { isValidEmailFormat } = await import("@/lib/config");
    expect(isValidEmailFormat("a@b.co")).toBe(true);
    expect(isValidEmailFormat("")).toBe(false);
    expect(isValidEmailFormat("nope")).toBe(false);
    expect(isValidEmailFormat("a@@b.co")).toBe(false);
    expect(isValidEmailFormat("spaces in@local.dev")).toBe(false);
    expect(isValidEmailFormat(`${"x".repeat(65)}@b.co`)).toBe(false);
    expect(isValidEmailFormat("a@nodot")).toBe(false);
  });
});
