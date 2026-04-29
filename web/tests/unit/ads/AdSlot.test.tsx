import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";

async function loadAdSlot() {
  const mod = await import("@/components/ads/AdSlot");
  return mod.AdSlot;
}

describe("AdSlot", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_ADSENSE_CLIENT_ID", "ca-pub-test1234567890");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle;
  });

  it("renders an aria-hidden placeholder before client mount", async () => {
    const AdSlot = await loadAdSlot();
    const html = renderToString(<AdSlot slot="1234567890" minHeight={250} />);
    expect(html).toContain("aria-hidden");
    expect(html).not.toContain("adsbygoogle");
    expect(html).not.toContain("<ins");
  });

  it("does not crash when window.adsbygoogle is undefined", async () => {
    delete (window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle;
    const AdSlot = await loadAdSlot();
    expect(() => render(<AdSlot slot="1234567890" />)).not.toThrow();
    const w = window as unknown as { adsbygoogle?: unknown[] };
    expect(Array.isArray(w.adsbygoogle)).toBe(true);
  });
});
