import { describe, expect, it } from "vitest";
import { activeQuotas, parseConfig } from "../src/engine/config.ts";
import { loadDefaultConfig } from "./helpers.ts";

describe("parseConfig", () => {
  it("accepts the default config", () => {
    const config = loadDefaultConfig();
    expect(config.version).toBe("2026-10-proto-1");
    expect(config.profiles.feed.weights).toEqual({ recency: 1, popularity: 0.6, topics: 0.8, follows: 0.8 });
  });

  it("rejects an unknown criterion", () => {
    const raw = loadDefaultConfig();
    Object.assign(raw.profiles.feed.weights, { location: 0.8 });
    expect(() => parseConfig(raw)).toThrow(/location/);
  });

  it("rejects an unknown profile section", () => {
    const raw = loadDefaultConfig();
    Object.assign(raw.profiles.feed, { surprises: { share: 0.2 } });
    expect(() => parseConfig(raw)).toThrow(/surprises/);
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

  describe("quotas", () => {
    const valid = { enabled: true, topics: { climate: 0.1 }, follows: { communities: 0.2, publishers: 0.2 }, surprise: 0.2 };
    const withQuotas = (quotas: unknown) => {
      const raw = loadDefaultConfig();
      Object.assign(raw.profiles.feed, { quotas });
      return raw;
    };

    it("ships switched off with the work order's shares and an exploration pool", () => {
      const feed = loadDefaultConfig().profiles.feed;
      expect(feed.quotas).toEqual({ ...valid, enabled: false, topics: {}, follows: { communities: 0.4, publishers: 0.4 } });
      expect(feed.pools.exploration).toBe(60);
      expect(activeQuotas(feed)).toBeUndefined();
    });

    it("returns the block when switched on", () => {
      expect(activeQuotas(parseConfig(withQuotas(valid)).profiles.feed)).toEqual(valid);
    });

    it("treats a missing block as off", () => {
      const raw = loadDefaultConfig();
      delete raw.profiles.feed.quotas;
      expect(activeQuotas(parseConfig(raw).profiles.feed)).toBeUndefined();
    });

    it("rejects shares adding up to more than 1", () => {
      expect(() => parseConfig(withQuotas({ ...valid, surprise: 0.6 }))).toThrow(/more than 1/);
    });

    it("accepts shares adding up to 1 that floating point puts just above it", () => {
      // 0.2 + 0.4 + 0.3 + 0.1 is 1.0000000000000002 in this order.
      const exact = { enabled: true, topics: { a: 0.2, b: 0.4 }, follows: { communities: 0.3, publishers: 0.1 }, surprise: 0 };
      expect(() => parseConfig(withQuotas(exact))).not.toThrow();
    });

    it("rejects a share outside [0, 1]", () => {
      expect(() => parseConfig(withQuotas({ ...valid, topics: { climate: -0.1 } }))).toThrow(/Invalid config/);
      expect(() => parseConfig(withQuotas({ ...valid, surprise: 1.5 }))).toThrow(/Invalid config/);
    });

    it("rejects an unknown quota key", () => {
      expect(() => parseConfig(withQuotas({ ...valid, regions: {} }))).toThrow(/regions/);
    });

    it("accepts read next quotas only when switched off", () => {
      const raw = loadDefaultConfig();
      Object.assign(raw.profiles.readNext, { quotas: { enabled: false } });
      expect(() => parseConfig(raw)).not.toThrow();
      Object.assign(raw.profiles.readNext, { quotas: { enabled: true } });
      expect(() => parseConfig(raw)).toThrow(/enabled/);
    });
  });
});
