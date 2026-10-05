import { describe, expect, it, vi } from "vitest";
import { createMemoryRepository } from "../src/data/memoryRepository.ts";
import { buildFilter, feedPools, readNextPools, unionPools, userLanguages } from "../src/engine/candidates.ts";
import { DAY_MS, NOW, hoursAgo, loadDefaultConfig, makeArticle, makeUser } from "./helpers.ts";

const window = { fromDay: "2026-09-29", toDay: "2026-10-05" };

describe("buildFilter", () => {
  it("builds the feed filter from user and profile", () => {
    const user = makeUser({ language: "hr", fallbackLanguages: ["en"], readArticleIds: ["r1"] });
    expect(buildFilter(user, 60, NOW)).toEqual({
      statuses: ["published"],
      languages: ["hr", "en"],
      excludeIds: ["r1"],
      publishedSince: new Date(NOW.getTime() - 60 * DAY_MS),
    });
  });

  it("also excludes the anchor in read next", () => {
    expect(buildFilter(makeUser({ readArticleIds: ["r1"] }), 365, NOW, "anchor").excludeIds).toEqual(["r1", "anchor"]);
  });
});

describe("userLanguages", () => {
  it("is the main language followed by fallbacks", () => {
    expect(userLanguages(makeUser({ language: "de", fallbackLanguages: ["en", "fr"] }))).toEqual(["de", "en", "fr"]);
  });
});

describe("unionPools", () => {
  it("records every pool that returned an article", async () => {
    const union = await unionPools([
      { name: "recent", size: 5, run: async () => ["a", "b"] },
      { name: "popular", size: 5, run: async () => ["b"] },
    ]);
    expect(union).toEqual(new Map([["a", ["recent"]], ["b", ["recent", "popular"]]]));
  });

  it("skips a pool with size 0", async () => {
    const run = vi.fn(async () => ["a"]);
    expect((await unionPools([{ name: "off", size: 0, run }])).size).toBe(0);
    expect(run).not.toHaveBeenCalled();
  });

  it("passes the configured size to the pool", async () => {
    const run = vi.fn(async () => []);
    await unionPools([{ name: "recent", size: 7, run }]);
    expect(run).toHaveBeenCalledWith(7);
  });

  it("returns an empty union when every pool is empty", async () => {
    expect((await unionPools([{ name: "recent", size: 5, run: async () => [] }])).size).toBe(0);
  });
});

describe("pool definitions", () => {
  const anchor = makeArticle({ id: "anchor", publisherId: "p1", topics: ["x"] });
  const repo = createMemoryRepository({
    articles: [anchor, makeArticle({ id: "a", topics: ["x"], publishedAt: hoursAgo(2) })],
    reads: [{ articleId: "a", day: "2026-10-05", reads: 3 }],
    pins: [],
  });
  const config = loadDefaultConfig();

  it("feed uses the recent and popular pools", async () => {
    const filter = buildFilter(makeUser(), 60, NOW);
    const union = await unionPools(feedPools(repo, filter, config.profiles.feed, window));
    expect(union.get("a")).toEqual(["recent", "popular"]);
  });

  it("read next uses the similar, sameSource and popular pools", async () => {
    const filter = buildFilter(makeUser(), 365, NOW, "anchor");
    const union = await unionPools(readNextPools(repo, filter, config.profiles.readNext, anchor, window));
    expect(union.get("a")).toEqual(["similar", "sameSource", "popular"]);
    expect(union.has("anchor")).toBe(false);
  });
});
