import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { trackPageview, trackEvent, initScrollTracking } from "@/lib/analytics";

describe("analytics", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "navigator",
      { ...navigator, sendBeacon: vi.fn(() => true) },
    );
    document.title = "";
    Object.defineProperty(document, "referrer", { value: "", configurable: true });
    history.replaceState({}, "", "/test-path");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sendBeacon sends pageview payload", () => {
    trackPageview("/foo");
    expect(navigator.sendBeacon).toHaveBeenCalledWith(
      "/api/analytics-event",
      expect.stringContaining('"type":"pageview"'),
    );
  });

  it("includes url for custom events", () => {
    trackEvent("click", { id: 1 });
    expect(navigator.sendBeacon).toHaveBeenCalledWith(
      "/api/analytics-event",
      expect.stringContaining('"name":"click"'),
    );
  });

  it("calls plausible bridge when present", () => {
    const plausible = vi.fn();
    (window as unknown as { plausible: typeof plausible }).plausible = plausible;
    trackEvent("custom");
    expect(plausible).toHaveBeenCalledWith("custom", undefined);
    trackEvent("with_props", { x: true });
    expect(plausible).toHaveBeenCalledWith("with_props", { props: { x: true } });
    delete (window as unknown as { plausible?: unknown }).plausible;
  });

  it("registers scroll listener with cleanup", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const rmSpy = vi.spyOn(window, "removeEventListener");
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 2000,
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 800 });

    const cleanup = initScrollTracking();
    expect(addSpy).toHaveBeenCalledWith("scroll", expect.any(Function), { passive: true });
    cleanup();
    expect(rmSpy).toHaveBeenCalled();

    addSpy.mockRestore();
    rmSpy.mockRestore();
  });

  it("falls back to fetch when sendBeacon is unavailable", () => {
    const fetchMock = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal(
      "navigator",
      { ...navigator, sendBeacon: undefined },
    );
    trackPageview("/fb");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/analytics-event",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
  });

  it("fires scroll depth milestones via requestAnimationFrame", () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
    const beacon = vi.spyOn(navigator, "sendBeacon").mockReturnValue(true);
    Object.defineProperty(document.documentElement, "scrollHeight", {
      configurable: true,
      value: 1100,
    });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 100 });
    Object.defineProperty(window, "scrollY", { configurable: true, value: 560, writable: true });

    const cleanup = initScrollTracking();
    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("scroll"));

    expect(beacon.mock.calls.some((c) => String(c[1]).includes("scroll_50"))).toBe(true);

    Object.defineProperty(window, "scrollY", { configurable: true, value: 920, writable: true });
    window.dispatchEvent(new Event("scroll"));
    expect(beacon.mock.calls.some((c) => String(c[1]).includes("scroll_90"))).toBe(true);

    cleanup();
    vi.mocked(window.requestAnimationFrame).mockRestore();
    beacon.mockRestore();
  });
});
