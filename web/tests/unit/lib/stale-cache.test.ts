import { describe, it, expect, beforeEach } from "vitest";
import { readCache, writeCache } from "@/lib/stale-cache";

describe("stale-cache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null for missing keys", () => {
    expect(readCache("nope")).toBeNull();
  });

  it("round-trips data with timestamp", () => {
    writeCache("k", { foo: 1 });
    const entry = readCache<{ foo: number }>("k");
    expect(entry?.data.foo).toBe(1);
    expect(entry?.savedAt).toBeTypeOf("number");
  });

  it("returns null for corrupt JSON and removes key", () => {
    localStorage.setItem("bad", "{");
    expect(readCache("bad")).toBeNull();
    expect(localStorage.getItem("bad")).toBeNull();
  });

  it("returns null when payload lacks required fields", () => {
    localStorage.setItem("partial", JSON.stringify({ data: null, savedAt: Date.now() }));
    expect(readCache("partial")).toBeNull();
  });
});
