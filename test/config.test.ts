import { describe, expect, it } from "vitest";
import { parseConfig } from "../src/engine/config.ts";
import { loadDefaultConfig } from "./helpers.ts";

describe("parseConfig", () => {
  it("accepts the default config", () => {
    const config = loadDefaultConfig();
    expect(config.version).toBe("2026-10-proto-1");
    expect(config.profiles.feed.weights).toEqual({ recency: 1, popularity: 0.6 });
  });

  it("rejects an unknown criterion", () => {
    const raw = loadDefaultConfig();
    Object.assign(raw.profiles.feed.weights, { topics: 0.8 });
    expect(() => parseConfig(raw)).toThrow(/topics/);
  });

  it("rejects an unknown profile section", () => {
    const raw = loadDefaultConfig();
    Object.assign(raw.profiles.feed, { quotas: { enabled: false } });
    expect(() => parseConfig(raw)).toThrow(/quotas/);
  });

  it("rejects a profile whose weights are all zero", () => {
    const raw = loadDefaultConfig();
    raw.profiles.feed.weights = { recency: 0, popularity: 0 };
    expect(() => parseConfig(raw)).toThrow(/at least one weight must be above 0/);
  });

  it("treats a missing weight as off", () => {
    const raw = loadDefaultConfig();
    delete raw.profiles.readNext.weights.popularity;
    expect(parseConfig(raw).profiles.readNext.weights.popularity).toBeUndefined();
  });

  it("rejects a negative pool size", () => {
    const raw = loadDefaultConfig();
    raw.profiles.feed.pools.recent = -1;
    expect(() => parseConfig(raw)).toThrow(/Invalid config/);
  });
});
